import requests
import models
import encryption
from sqlalchemy.orm import Session

# Alpaca Paper API Base endpoint for testing.
ALPACA_API_BASE = "https://paper-api.alpaca.markets/v2"

def sync_alpaca_account(credential_id: int, user_id: int, db: Session) -> dict:
    """
    Attempts to sync portfolio positions from Alpaca paper trading API.
    """
    cred = db.query(models.BrokerCredential).filter(
        models.BrokerCredential.id == credential_id,
        models.BrokerCredential.user_id == user_id
    ).first()
    
    if not cred:
        return {"status": "error", "message": "Credential not found"}
        
    api_secret = encryption.decrypt(cred.encrypted_secret)
    base_endpoint = cred.endpoint.strip('/') if cred.endpoint else ALPACA_API_BASE
    
    headers = {
        "APCA-API-KEY-ID": cred.api_key,
        "APCA-API-SECRET-KEY": api_secret,
        "accept": "application/json"
    }
    
    try:
        # Fetch Account details for Total Capital (Equity)
        account_res = requests.get(f"{base_endpoint}/account", headers=headers, timeout=10)
        account_res.raise_for_status()
        account_data = account_res.json()
        
        # Save equity natively to DB credential
        cred.total_capital = str(account_data.get('equity', 0))
        
        # Fetch Active Positions from Alpaca
        positions_res = requests.get(f"{base_endpoint}/positions", headers=headers, timeout=10)
        positions_res.raise_for_status()
        positions_data = positions_res.json()
        
        # Clear old assets from this user
        db.query(models.Asset).filter(models.Asset.user_id == user_id).delete()
        
        # Parse Alpaca Response
        for p in positions_data:
            sym = p.get('symbol', 'UNKNOWN')
            ast_class = p.get('asset_class', 'us_equity').title()
            qty = str(p.get('qty', 0))
            buy_price = str(p.get('avg_entry_price', 0))
            
            # Fetch native actual price and returns
            current = str(p.get('current_price', 0))
            p_nl = str(p.get('unrealized_pl', 0))
            
            # Convert decimal percentage e.g 0.015 to 1.5% for visual scaling
            plpc = p.get('unrealized_plpc', 0)
            p_nl_percent = str(float(plpc) * 100) if plpc else "0"
            
            ast = models.Asset(
                user_id=user_id,
                symbol=sym,
                asset_class=ast_class,
                quantity=qty,
                average_buy_price=buy_price,
                current_price=current,
                pnl=p_nl,
                pnl_percent=p_nl_percent
            )
            db.add(ast)
            
        db.commit()
        
        return {"status": "success", "message": f"Successfully synchronized {len(positions_data)} positions from Alpaca."}
        
    except requests.exceptions.HTTPError as he:
        print(f"Alpaca HTTP Error: {he}")
        try:
            err_msg = he.response.json().get("message", str(he))
        except:
            err_msg = str(he)
        return {"status": "error", "message": f"Alpaca Refused Connection: {err_msg}"}
    except Exception as e:
        print(f"Sync error: {e}")
        return {"status": "error", "message": "Failed to connect to Alpaca API"}
