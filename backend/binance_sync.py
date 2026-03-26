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
        
        # We will delete old Binance assets matching this credential
        # Since our tracking natively tied assets to user_id (not credential_id), 
        # we need to be careful not to delete Alpaca assets!
        # For simplicity, we assume an asset belongs to a specific broker wrapper via `broker_credential_id`...
        # Wait, the Asset model doesn't currently store `broker_credential_id`! 
        # But we only have two brokers. We can differentiate by asset_class = 'Crypto'.
        
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
                
            # Current price in USD tracking (assuming XXXUSDT ticker)
            current_price = 1.0 # default for USDT/BUSD
            if asset_symbol not in ['USDT', 'BUSD', 'USDC']:
                pair = f"{asset_symbol}USDT"
                current_price = tickers.get(pair, 0.0)
                
            asset_usd_value = total_qty * current_price
            total_capital += asset_usd_value
            
            # Since Spot doesn't have an "average buy price", we set it to current price (0% PNL natively)
            # just so they appear neatly in the portfolio tables without massive false metrics.
            ast = models.Asset(
                user_id=user_id,
                symbol=asset_symbol,
                asset_class='Crypto',
                quantity=str(total_qty),
                average_buy_price=str(current_price),
                current_price=str(current_price),
                pnl="0",
                pnl_percent="0",
                broker_name="Binance Demo",
                credential_id=credential_id
            )
            db.add(ast)
            
        # Update credential total capital
        cred.total_capital = str(total_capital)
        db.commit()

        # Fetch Trade History for each active asset from Binance /api/v3/myTrades
        import datetime as dt
        for balance in active_balances:
            asset_sym = balance.get('asset', '')
            if not asset_sym or asset_sym in ('USDT', 'BUSD', 'USD'):
                continue
            trading_pair = f"{asset_sym}USDT"
            try:
                ts2 = int(time.time() * 1000)
                qs2 = f"symbol={trading_pair}&limit=50&timestamp={ts2}"
                sig2 = generate_signature(qs2, api_secret)
                trades_url = f"{base_endpoint}/api/v3/myTrades?{qs2}&signature={sig2}"
                trades_res = requests.get(trades_url, headers=headers, timeout=10)
                if trades_res.status_code != 200:
                    continue
                for trade in trades_res.json():
                    ext_id = f"binance-{trade['id']}"
                    exists = db.query(models.Transaction).filter(
                        models.Transaction.external_id == ext_id,
                        models.Transaction.user_id == user_id
                    ).first()
                    if exists:
                        continue
                    tx_type = 'BUY' if trade.get('isBuyer') else 'SELL'
                    try:
                        ts_ms = trade.get('time', 0)
                        tx_ts = dt.datetime.utcfromtimestamp(ts_ms / 1000)
                    except Exception:
                        tx_ts = dt.datetime.utcnow()
                    tx = models.Transaction(
                        user_id=user_id,
                        symbol=trading_pair,
                        transaction_type=tx_type,
                        quantity=str(trade.get('qty', 0)),
                        price=str(trade.get('price', 0)),
                        broker_name="Binance Demo",
                        credential_id=credential_id,
                        asset_class="Crypto",
                        external_id=ext_id,
                        timestamp=tx_ts
                    )
                    db.add(tx)
            except Exception as te:
                print(f"Binance trade history error for {trading_pair}: {te}")
        db.commit()

        return {"status": "success", "message": f"Successfully synchronized {len(active_balances)} crypto balances from Binance."}

        
    except requests.exceptions.HTTPError as he:
        print(f"Binance HTTP Error: {he}")
        try:
            err_msg = he.response.json().get("msg", str(he))
            return {"status": "error", "message": f"Binance Error: {err_msg}"}
        except:
            return {"status": "error", "message": f"Binance Refused Connection: {he}"}
    except Exception as e:
        print(f"Sync error: {e}")
        return {"status": "error", "message": "Failed to connect to Binance API"}
