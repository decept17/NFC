"""
utils/email_service.py — Thin email dispatch wrapper for the N3XO API.

Defaults to SendGrid (free tier: 100 emails/day).
Falls back to a console log if EMAIL_SERVICE_API_KEY is not set,
so local development works without a real API key.

Required env vars:
    EMAIL_SERVICE_API_KEY   SendGrid API key (starts with SG.)
    EMAIL_FROM              Sender address (e.g. no-reply@n3xo.app)
"""

import os
import logging

logger = logging.getLogger(__name__)


def send_password_reset_email(to_email: str, reset_url: str) -> None:
    """
    Send a password-reset email containing `reset_url` to `to_email`.

    Uses SendGrid if EMAIL_SERVICE_API_KEY is set; otherwise logs the
    reset URL to stdout so developers can test locally without a key.
    """
    api_key = os.getenv("EMAIL_SERVICE_API_KEY", "")
    from_email = os.getenv("EMAIL_FROM", "no-reply@n3xo.app")

    subject = "Reset your N3XO password"
    body_html = f"""
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #0A0E1A;">Reset your N3XO password</h2>
        <p>We received a request to reset the password for your N3XO account.</p>
        <p>
            <a href="{reset_url}"
               style="display:inline-block;padding:12px 24px;background:#00B4FF;
                      color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
                Reset Password
            </a>
        </p>
        <p style="color:#666;font-size:13px;">
            This link expires in <strong>30 minutes</strong> and can only be used once.<br>
            If you didn't request this, you can safely ignore this email.
        </p>
        <hr style="border:none;border-top:1px solid #eee;">
        <p style="color:#999;font-size:11px;">N3XO — NFC Family Payments</p>
    </div>
    """

    if not api_key:
        # Dev fallback — print to console so developer can click the link
        logger.warning("[EMAIL] EMAIL_SERVICE_API_KEY not set — printing reset URL to console.")
        print(f"\n[DEV] Password reset URL for {to_email}:\n  {reset_url}\n")
        return

    try:
        import sendgrid
        from sendgrid.helpers.mail import Mail

        message = Mail(
            from_email=from_email,
            to_emails=to_email,
            subject=subject,
            html_content=body_html,
        )
        sg = sendgrid.SendGridAPIClient(api_key=api_key)
        response = sg.send(message)
        logger.info(f"[EMAIL] Reset email sent to {to_email}. Status: {response.status_code}")

    except ImportError:
        # sendgrid package not installed — shouldn't happen in Docker but be safe
        logger.error("[EMAIL] sendgrid package is not installed. Run: pip install sendgrid")
        print(f"\n[FALLBACK] Password reset URL for {to_email}:\n  {reset_url}\n")

    except Exception as exc:
        # Log but don't crash the API — leaking email send failures to the caller
        # would confirm whether an email address exists in our system.
        logger.error(f"[EMAIL] Failed to send reset email to {to_email}: {exc}")
