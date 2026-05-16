# Security Policy

Financial credential safety is a core design principle of the Smart Portfolio Analysis & Insights Engine.

## Security Features

### 1. At-Rest Encryption
Broker API keys and secrets are encrypted using AES-256 (via the Fernet specification) before they ever touch the database. This ensures that even if the database is compromised, your financial credentials remain secure.

### 2. Two-Factor Authentication (MFA)
Users can enable MFA in App Settings for an extra layer of login security. This is backed by real OTP email delivery using production-grade SMTP services.

### 3. JWT Session Tokens
We use stateless, signed JSON Web Tokens (JWT) with configurable expiry for all authenticated routes. This ensures secure session management without storing session state on the server.

### 4. Password Sovereignty
Dedicated, mobile-responsive screens are provided for password recovery and account rotation, following security best practices.

### 5. Rate Limiting
API request queuing and rate limiting protect both the backend and external broker APIs from abuse and brute-force attacks.

## Reporting a Vulnerability

If you discover a security vulnerability within this project, please open an issue or contact the maintainers directly. We take all security reports seriously.
