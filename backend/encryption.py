from cryptography.fernet import Fernet
import os
import base64

def get_fernet():
    key = os.getenv("ENCRYPTION_KEY")
    if not key:
        raise ValueError("CRITICAL: No ENCRYPTION_KEY found in environment variables. Backend refused to start insecurely.")
    
    key = key.encode('utf-8')
    return Fernet(key)

def encrypt(plaintext: str) -> str:
    """Encrypts a plaintext string and returns the ciphertext as a string."""
    if not plaintext:
        return plaintext
    f = get_fernet()
    ciphertext_bytes = f.encrypt(plaintext.encode('utf-8'))
    return ciphertext_bytes.decode('utf-8')

def decrypt(ciphertext: str) -> str:
    """Decrypts a ciphertext string and returns the plaintext as a string."""
    if not ciphertext:
        return ciphertext
    f = get_fernet()
    plaintext_bytes = f.decrypt(ciphertext.encode('utf-8'))
    return plaintext_bytes.decode('utf-8')
