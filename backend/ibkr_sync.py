import requests
import models
import encryption
from sqlalchemy.orm import Session
import datetime as dt

# Default IBKR Client Portal API loopback
IBKR_API_BASE = "https://localhost:5000/v1/api"

def sync_ibkr_account(credential_id: int, user_id: int, db: Session) -> dict:
    """
    Attempts to sync portfolio positions from Interactive Brokers Client Portal API.
    Assumes a local CPAPI gateway is running on the provided endpoint.
    """
    cred = db.query(models.BrokerCredential).filter(
        models.BrokerCredential.id == credential_id,
        models.BrokerCredential.user_id == user_id
    ).first()
    
    if not cred:
        return {"status": "error", "message": "Credential not found"}
        
    api_secret = encryption.decrypt(cred.encrypted_secret) if cred.encrypted_secret else ""
    base_endpoint = cred.endpoint.strip('/') if cred.endpoint else IBKR_API_BASE
    
    headers = {
        "accept": "application/json"
    }

    # If the user provides an API key, inject it, though IBKR CPAPI usually uses cookies/sessions
    if cred.api_key:
        headers["Authorization"] = f"Bearer {cred.api_key}"
    
    try:
        # Check authentication / server status
        # Endpoint: /iserver/auth/status or /tickle ping
        status_res = requests.get(f"{base_endpoint}/iserver/auth/status", headers=headers, timeout=10, verify=False)
        status_res.raise_for_status()

        # 1. Fetch Accounts
        accounts_res = requests.get(f"{base_endpoint}/portfolio/accounts", headers=headers, timeout=10, verify=False)
        accounts_res.raise_for_status()
        accounts_data = accounts_res.json()
        
        if not accounts_data:
             return {"status": "error", "message": "No IBKR accounts returned from the gateway."}
             
        # Use primary account (or iterate if multiple)
        primary_account = accounts_data[0].get("accountId")
        
        # 2. Fetch Ledger / Capital details for Total Capital (Equity)
        ledger_res = requests.get(f"{base_endpoint}/portfolio/{primary_account}/ledger", headers=headers, timeout=10, verify=False)
        ledger_res.raise_for_status()
        
        # Extract net liquidation value (total equity)
        ledger_data = ledger_res.json()
        equity = 0.0
        if "USD" in ledger_data and "netliquidationvalue" in ledger_data["USD"]:
            equity = ledger_data["USD"]["netliquidationvalue"]
        
        cred.total_capital = str(equity)
        
        # 3. Fetch Active Positions
        page = 0
        all_positions = []
        while True:
            pos_res = requests.get(f"{base_endpoint}/portfolio/{primary_account}/positions/{page}", headers=headers, timeout=10, verify=False)
            if pos_res.status_code != 200:
                break
            pos_page = pos_res.json()
            if not pos_page:
                break
            all_positions.extend(pos_page)
            page += 1
            
        # Clear old assets from this SPECIFIC credential
        db.query(models.Asset).filter(
            models.Asset.user_id == user_id,
            models.Asset.credential_id == credential_id
        ).delete()
        
        # Parse IBKR Response
        for p in all_positions:
            sym = p.get('ticker', 'UNKNOWN')
            ast_class = p.get('assetClass', 'STK').upper() # IB uses STK, OPT, CASH, etc.
            
            # Map classes for dashboard
            dashboard_class = "Stock"
            if ast_class == "OPT": dashboard_class = "Options"
            elif ast_class == "CASH": dashboard_class = "Crypto/Forex"
            elif ast_class == "BOND": dashboard_class = "Bonds"

            qty = str(p.get('position', 0))
            if float(p.get('position', 0)) == 0:
                continue

            buy_price = str(p.get('avgPrice', 0))
            current_price = str(p.get('mktPrice', 0))
            
            p_nl = str(p.get('unrealizedPnl', 0))
            
            buy_val = float(buy_price)
            cur_val = float(current_price)
            pnl_percent = str(((cur_val - buy_val) / buy_val * 100) if buy_val > 0 else "0")
            
            ast = models.Asset(
                user_id=user_id,
                symbol=sym,
                asset_class=dashboard_class,
                quantity=qty,
                average_buy_price=buy_price,
                current_price=current_price,
                pnl=p_nl,
                pnl_percent=pnl_percent,
                broker_name=cred.broker_name,
                credential_id=credential_id
            )
            db.add(ast)
            
        db.commit()

        # 4. Fetch Order History for Trade History section (last 7 days usually available in CPAPI)
        try:
            trades_res = requests.get(f"{base_endpoint}/iserver/account/trades", headers=headers, timeout=10, verify=False)
            if trades_res.status_code == 200:
                trades_data = trades_res.json()
                for trade in trades_data:
                    ext_id = str(trade.get('execution_id', ''))
                    # Skip if already stored
                    exists = db.query(models.Transaction).filter(
                        models.Transaction.external_id == ext_id,
                        models.Transaction.user_id == user_id
                    ).first()
                    if exists:
                        continue
                        
                    side = trade.get('side', 'BUY').upper()
                    tx_type = 'BUY' if side in ('B', 'BUY') else 'SELL'
                    filled_qty = str(trade.get('size', 0))
                    filled_price = str(trade.get('price', 0))
                    sym = trade.get('symbol', 'UNKNOWN')
                    
                    raw_ts = trade.get('trade_time') 
                    try:
                        ts = dt.datetime.strptime(raw_ts, "%Y%m%d-%H:%M:%S") if raw_ts else dt.datetime.utcnow()
                    except Exception:
                        ts = dt.datetime.utcnow()
                        
                    tx = models.Transaction(
                        user_id=user_id,
                        symbol=sym,
                        transaction_type=tx_type,
                        quantity=filled_qty,
                        price=filled_price,
                        broker_name=cred.broker_name,
                        credential_id=credential_id,
                        asset_class="Stock",
                        external_id=ext_id,
                        timestamp=ts
                    )
                    db.add(tx)
                db.commit()
        except Exception as order_err:
            print(f"IBKR order history fetch error: {order_err}")

        return {"status": "success", "message": f"Successfully synchronized {len(all_positions)} positions from Interactive Brokers."}

    except requests.exceptions.RequestException as req_err:
        print(f"IBKR Gateway Error: {req_err}")
        return {"status": "error", "message": f"Failed to connect to IBKR gateway at {base_endpoint}. Is it running?"}
    except Exception as e:
        print(f"Sync error: {e}")
        return {"status": "error", "message": f"IBKR API Error: {str(e)}"}
