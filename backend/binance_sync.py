import requests
import time
import hashlib
import hmac
import models
import encryption
from sqlalchemy.orm import Session

# Binance Spot Demo API Base endpoint (https://developers.binance.com/docs/binance-spot-api-docs/demo-mode/general-info)
BINANCE_API_BASE = "https://demo-api.binance.com"

def generate_signature(query_string: str, api_secret: str) -> str:
    """Generates HMAC SHA256 signature required by Binance API."""
    return hmac.new(
        api_secret.encode('utf-8'),
        query_string.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

def sync_binance_account(credential_id: int, user_id: int, db: Session) -> dict:
    """
    Attempts to sync portfolio balances from Binance Spot Demo API.
    Fetches account balances from /api/v3/account and current ticker prices from /api/v3/ticker/price.
    API keys are created at https://demo.binance.com/en/my/settings/api-management
    """
    cred = db.query(models.BrokerCredential).filter(
        models.BrokerCredential.id == credential_id,
        models.BrokerCredential.user_id == user_id
    ).first()
    
    if not cred:
        return {"status": "error", "message": "Credential not found"}
        
    api_secret = encryption.decrypt(cred.encrypted_secret)
    base_endpoint = cred.endpoint.strip('/') if cred.endpoint else BINANCE_API_BASE
    
    headers = {
        "X-MBX-APIKEY": cred.api_key
    }
    
    try:
        # 1. Fetch Account Balances
        timestamp = int(time.time() * 1000)
        query_string = f"timestamp={timestamp}"
        signature = generate_signature(query_string, api_secret)

        account_url = f"{base_endpoint}/api/v3/account?{query_string}&signature={signature}"

        account_res = requests.get(account_url, headers=headers, timeout=10)
        account_res.raise_for_status()
        account_data = account_res.json()

        balances = account_data.get('balances', [])

        # Filter out dust (0 balances)
        active_balances = [b for b in balances if float(b.get('free', 0)) > 0 or float(b.get('locked', 0)) > 0]

        # 2. Fetch all Ticker Prices (no auth required)
        price_res = requests.get(f"{base_endpoint}/api/v3/ticker/price", timeout=10)
        price_res.raise_for_status()
        tickers = {item['symbol']: float(item['price']) for item in price_res.json()}

        # 3. Fetch Trade History for each active asset and compute weighted avg buy price
        import datetime as dt

        # avg_buy_prices[symbol] = (total_cost, total_qty_bought) for weighted avg
        avg_buy_data: dict[str, tuple[float, float]] = {}

        for balance in active_balances:
            asset_sym = balance.get('asset', '')
            if not asset_sym or asset_sym in ('USDT', 'BUSD', 'USDC', 'USD'):
                continue
            trading_pair = f"{asset_sym}USDT"
            try:
                ts2 = int(time.time() * 1000)
                qs2 = f"symbol={trading_pair}&limit=500&timestamp={ts2}"
                sig2 = generate_signature(qs2, api_secret)
                trades_url = f"{base_endpoint}/api/v3/myTrades?{qs2}&signature={sig2}"
                trades_res = requests.get(trades_url, headers=headers, timeout=10)
                if trades_res.status_code != 200:
                    continue

                total_cost = 0.0
                total_qty_bought = 0.0

                for trade in trades_res.json():
                    ext_id = f"binance-{trade['id']}"
                    is_buyer = trade.get('isBuyer', False)
                    trade_qty = float(trade.get('qty', 0))
                    trade_price = float(trade.get('price', 0))

                    # Accumulate BUY trades to compute weighted average entry
                    if is_buyer and trade_qty > 0 and trade_price > 0:
                        total_cost += trade_qty * trade_price
                        total_qty_bought += trade_qty

                    # Store transaction if not already present
                    exists = db.query(models.Transaction).filter(
                        models.Transaction.external_id == ext_id,
                        models.Transaction.user_id == user_id
                    ).first()
                    if not exists:
                        tx_type = 'BUY' if is_buyer else 'SELL'
                        try:
                            ts_ms = trade.get('time', 0)
                            tx_ts = dt.datetime.utcfromtimestamp(ts_ms / 1000)
                        except Exception:
                            tx_ts = dt.datetime.utcnow()
                        tx = models.Transaction(
                            user_id=user_id,
                            symbol=trading_pair,
                            transaction_type=tx_type,
                            quantity=str(trade_qty),
                            price=str(trade_price),
                            broker_name="Binance Demo",
                            credential_id=credential_id,
                            asset_class="Crypto",
                            external_id=ext_id,
                            timestamp=tx_ts
                        )
                        db.add(tx)

                if total_qty_bought > 0:
                    avg_buy_data[asset_sym] = (total_cost, total_qty_bought)

            except Exception as te:
                print(f"Binance trade history error for {trading_pair}: {te}")

        db.commit()

        # 4. Clear old Binance assets for this credential and rebuild with correct avg price
        db.query(models.Asset).filter(
            models.Asset.user_id == user_id,
            models.Asset.credential_id == credential_id
        ).delete()

        total_capital = 0.0

        for bal in active_balances:
            asset_symbol = bal.get('asset')
            free_qty = float(bal.get('free', 0))
            locked_qty = float(bal.get('locked', 0))
            total_qty = free_qty + locked_qty

            if total_qty <= 0:
                continue

            # Current price in USD (assuming XXXUSDT pair; stablecoins default to 1.0)
            current_price = 1.0
            if asset_symbol not in ['USDT', 'BUSD', 'USDC']:
                pair = f"{asset_symbol}USDT"
                current_price = tickers.get(pair, 0.0)

            asset_usd_value = total_qty * current_price
            total_capital += asset_usd_value

            # Compute weighted average buy price from trade history
            if asset_symbol in avg_buy_data:
                total_cost, total_qty_bought = avg_buy_data[asset_symbol]
                avg_entry = total_cost / total_qty_bought if total_qty_bought > 0 else current_price
            else:
                # No trade history available — fall back to current price (0% PNL)
                avg_entry = current_price

            # Compute PNL
            pnl_abs = (current_price - avg_entry) * total_qty
            pnl_pct = ((current_price - avg_entry) / avg_entry * 100) if avg_entry > 0 else 0.0

            ast = models.Asset(
                user_id=user_id,
                symbol=asset_symbol,
                asset_class='Crypto',
                quantity=str(total_qty),
                average_buy_price=str(avg_entry),
                current_price=str(current_price),
                pnl=str(round(pnl_abs, 8)),
                pnl_percent=str(round(pnl_pct, 4)),
                broker_name="Binance Demo",
                credential_id=credential_id
            )
            db.add(ast)

        # Update credential total capital
        cred.total_capital = str(total_capital)
        db.commit()

        return {"status": "success", "message": f"Successfully synchronized {len(active_balances)} crypto balances from Binance."}

    except requests.exceptions.HTTPError as he:
        print(f"Binance HTTP Error: {he}")
        try:
            err_msg = he.response.json().get("msg", str(he))
            return {"status": "error", "message": f"Binance Error: {err_msg}"}
        except Exception:
            return {"status": "error", "message": f"Binance Refused Connection: {he}"}
    except Exception as e:
        print(f"Sync error: {e}")
        return {"status": "error", "message": "Failed to connect to Binance API"}
