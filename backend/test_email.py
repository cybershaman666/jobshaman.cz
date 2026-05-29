#!/usr/bin/env python3
"""
Test script for Resend email functionality and team invitations
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.email import send_email, send_teammate_invitation_email
from app.core.config import RESEND_API_KEY

try:
    import resend
except ModuleNotFoundError:
    resend = None

def test_email():
    print("=" * 70)
    print("🧪 Testing Resend Email Configuration & Team Invitation Emails")
    print("=" * 70)
    
    # Check API key
    print("\n1️⃣  CHECKING RESEND_API_KEY:")
    print("-" * 70)
    if RESEND_API_KEY:
        print(f"✅ RESEND_API_KEY is set: {RESEND_API_KEY[:10]}...{RESEND_API_KEY[-4:]}")
    else:
        print("❌ RESEND_API_KEY is NOT set!")
        print("\nChecking environment variables:")
        print(f"  RESEND_API_KEY: {os.getenv('RESEND_API_KEY') or 'NOT SET'}")
        print(f"  VITE_RESEND_API_KEY: {os.getenv('VITE_RESEND_API_KEY') or 'NOT SET'}")
        print("\n⚠️  This is the ROOT CAUSE of emails not being sent!")
        return False
    
    # Check resend package
    print("\n2️⃣  CHECKING RESEND PACKAGE:")
    print("-" * 70)
    if resend is not None:
        print(f"✅ Resend package is installed")
        print(f"   Resend API Key set in module: {hasattr(resend, 'api_key') and bool(resend.api_key)}")
    else:
        print("❌ Resend package is NOT installed!")
        print("   Install with: pip install resend")
        return False
    
    # Test generic email send
    print("\n3️⃣  TESTING GENERIC EMAIL SEND:")
    print("-" * 70)
    test_recipient = "floki@jobshaman.cz"
    test_subject = "🧪 Test Email from JobShaman"
    test_html = """
    <h2>Test Email</h2>
    <p>This is a test email to verify Resend integration is working correctly.</p>
    <p>If you receive this, the email system is functioning properly! ✅</p>
    <hr/>
    <p><small>Sent from JobShaman email test script</small></p>
    """
    
    result = send_email(test_recipient, test_subject, test_html)
    
    if result:
        print(f"✅ Generic test email sent successfully to {test_recipient}")
    else:
        print(f"❌ Failed to send generic test email")
        return False
    
    # Test teammate invitation email
    print("\n4️⃣  TESTING TEAMMATE INVITATION EMAIL:")
    print("-" * 70)
    test_token = "test_token_12345abcdefghijklmnopqrstuvwxyz"
    test_recipient_invite = "testteammate@company.com"
    
    result = send_teammate_invitation_email(
        to_email=test_recipient_invite,
        invited_name="Test User",
        company_name="Test Company",
        inviter_name="Admin User",
        invitation_token=test_token,
        app_url="https://jobshaman.cz"
    )
    
    if result:
        print(f"✅ Invitation email sent successfully to {test_recipient_invite}")
        print(f"   Invitation URL: https://jobshaman.cz/accept-invitation?token={test_token}")
    else:
        print(f"❌ Failed to send invitation email")
        return False
    
    print("\n" + "=" * 70)
    print("✅ ALL TESTS PASSED! Email system is working correctly.")
    print("=" * 70)
    return True

if __name__ == "__main__":
    success = test_email()
    sys.exit(0 if success else 1)
