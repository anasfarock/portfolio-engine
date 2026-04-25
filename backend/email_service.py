import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp-relay.brevo.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "noreply@portfolio-engine.com")
FROM_NAME = os.getenv("FROM_NAME", "Portfolio Engine")

def send_email(to_email: str, subject: str, html_body: str):
    """
    Synchronous base method to send an email via SMTP.
    Used within FastAPI BackgroundTasks.
    """
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        print(f"⚠️ [Email Disabled] Would have sent to {to_email}: {subject}")
        print(html_body)
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{FROM_NAME} <{FROM_EMAIL}>"
    msg["To"] = to_email

    part = MIMEText(html_body, "html")
    msg.attach(part)

    try:
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.sendmail(FROM_EMAIL, to_email, msg.as_string())
        server.quit()
        print(f"📧 Email sent to {to_email}: {subject}")
    except Exception as e:
        print(f"❌ Failed to send email to {to_email}: {e}")

# ==========================================
# Notification Templates
# ==========================================

def send_registration_otp(to_email: str, otp_code: str):
    subject = "Verify Your Email - Portfolio Engine"
    body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #333; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4F46E5;">Welcome to Portfolio Engine!</h2>
        <p>Thank you for registering. Please use the following 6-digit verification code to complete your signup:</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #111;">{otp_code}</span>
        </div>
        <p>This code will expire in 15 minutes.</p>
        <p style="font-size: 12px; color: #888; margin-top: 30px;">If you didn't request this, you can safely ignore this email.</p>
      </body>
    </html>
    """
    send_email(to_email, subject, body)

def send_mfa_otp(to_email: str, otp_code: str):
    subject = "Your Two-Factor Authentication Code"
    body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #333; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #10B981;">Sign In Attempt</h2>
        <p>We noticed a login attempt to your account. Please use the following code to verify your identity:</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #111;">{otp_code}</span>
        </div>
        <p>This code will expire in 10 minutes.</p>
      </body>
    </html>
    """
    send_email(to_email, subject, body)

def send_password_reset_otp(to_email: str, otp_code: str):
    subject = "Password Reset Request"
    body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #333; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #F59E0B;">Reset Your Password</h2>
        <p>You requested a password reset. Please use the following verification code to choose a new password:</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #111;">{otp_code}</span>
        </div>
        <p>This code will expire in 30 minutes.</p>
        <p style="font-size: 12px; color: #888; margin-top: 30px;">If you didn't request this reset, your account is safe and you can ignore this email.</p>
      </body>
    </html>
    """
    send_email(to_email, subject, body)

def send_login_alert(to_email: str, timestamp_str: str):
    subject = "Security Alert: New Login"
    body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #333; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #6366F1;">New Login Detected</h2>
        <p>Your Portfolio Engine account was just accessed.</p>
        <p><strong>Time:</strong> {timestamp_str} (UTC)</p>
        <p style="margin-top: 20px;">If this was you, no further action is required. If you did not authorize this login, please reset your password immediately.</p>
      </body>
    </html>
    """
    send_email(to_email, subject, body)

def send_broker_integration_alert(to_email: str, broker_name: str, nickname: str):
    subject = f"Broker Linked: {broker_name}"
    display_name = f"{nickname} ({broker_name})" if nickname else broker_name
    body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #333; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #8B5CF6;">New Broker Connected</h2>
        <p>A new API connection has been established on your account.</p>
        <p><strong>Account:</strong> {display_name}</p>
        <p>Your portfolio will now begin synchronizing assets and transactions from this broker.</p>
      </body>
    </html>
    """
    send_email(to_email, subject, body)
