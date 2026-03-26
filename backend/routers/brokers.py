from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Annotated
import models, schemas, encryption, database, alpaca_sync, binance_sync
from auth import get_current_user, db_dependency

router = APIRouter(
    prefix="/brokers",
    tags=["Brokers"]
)

db_dependency = Annotated[Session, Depends(database.get_db)]

@router.post("/credentials", response_model=schemas.BrokerCredentialResponse, status_code=status.HTTP_201_CREATED)
def create_broker_credential(
    credential: schemas.BrokerCredentialCreate,
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: db_dependency
):
    # Encrypt the Secret before storing
    encrypted_secret = encryption.encrypt(credential.api_secret)
    
    new_cred = models.BrokerCredential(
        user_id=current_user.id,
        broker_name=credential.broker_name,
        nickname=credential.nickname,
        api_key=credential.api_key,
        identifier=credential.identifier,
        endpoint=credential.endpoint,
        encrypted_secret=encrypted_secret
    )
    
    db.add(new_cred)
    db.commit()
    db.refresh(new_cred)
    
    # Send masked API key in response for security
    masked_cred = schemas.BrokerCredentialResponse(
        id=new_cred.id,
        user_id=new_cred.user_id,
        broker_name=new_cred.broker_name,
        nickname=new_cred.nickname,
        api_key=f"****{new_cred.api_key[-4:]}" if len(new_cred.api_key) > 4 else "****",
        identifier=new_cred.identifier,
        endpoint=new_cred.endpoint
    )
    return masked_cred

@router.get("/credentials", response_model=List[schemas.BrokerCredentialResponse])
def get_broker_credentials(
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: db_dependency
):
    creds = db.query(models.BrokerCredential).filter(models.BrokerCredential.user_id == current_user.id).all()
    # Mask api key
    for cred in creds:
        cred.api_key = f"****{cred.api_key[-4:]}" if len(cred.api_key) > 4 else "****"
    return creds

@router.delete("/credentials/{credential_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_broker_credential(
    credential_id: int,
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: db_dependency
):
    cred = db.query(models.BrokerCredential).filter(
        models.BrokerCredential.id == credential_id,
        models.BrokerCredential.user_id == current_user.id
    ).first()
    
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")
        
    db.delete(cred)
    db.commit()

@router.post("/credentials/{credential_id}/sync")
def sync_broker_credential(
    credential_id: int,
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: db_dependency
):
    cred = db.query(models.BrokerCredential).filter(
        models.BrokerCredential.id == credential_id,
        models.BrokerCredential.user_id == current_user.id
    ).first()
    
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")
        
    if cred.broker_name == "Alpaca":
        result = alpaca_sync.sync_alpaca_account(credential_id, current_user.id, db)
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        return {"message": result["message"]}
    elif cred.broker_name == "Binance Demo":
        result = binance_sync.sync_binance_account(credential_id, current_user.id, db)
        if result["status"] == "error":
            raise HTTPException(status_code=400, detail=result["message"])
        return {"message": result["message"]}
    else:
        raise HTTPException(status_code=400, detail="Broker sync not implemented for this broker")
