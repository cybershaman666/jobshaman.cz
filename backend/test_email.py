#!/usr/bin/env python3
"""
Test script for Resend email functionality
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.email import send_email
from app.core.config import RESEND_API_KEY

def test_email():
    print("=" * 60)
    print("🧪 Testing Resend Email Configuration")
    print("=" * 60)
    
    # Check API key
    if RESEND_API_KEY:
        print(f"✅ RESEND_API_KEY is set: {RESEND_API_KEY[:10]}...{RESEND_API_KEY[-4:]}")
    else:
        print("❌ RESEND_API_KEY is NOT set!")
        print("\nChecking environment variables:")
        print(f"  RESEND_API_KEY: {os.getenv('RESEND_API_KEY')}")
        print(f"  VITE_RESEND_API_KEY: {os.getenv('VITE_RESEND_API_KEY')}")
        return False
    
    # Test email send
    print("\n📧 Sending test email...")
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
        print(f"\n✅ Test email sent successfully to {test_recipient}")
        print("📬 Please check your inbox (and spam folder)")
        return True
    else:
        print(f"\n❌ Failed to send test email")
        return False

if __name__ == "__main__":
    success = test_email()
    sys.exit(0 if success else 1)
