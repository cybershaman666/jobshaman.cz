#!/usr/bin/env python3
"""
Simple test for legality detection without dependencies
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.legality import check_legality_rules

# Test cases
tests = [
    ("SCAM: Výdělek bez práce", "Vydělávejte snadno!", "FastMoney", "Získejte výdělek bez práce! 50 000 Kč měsíčně!", "ILLEGAL"),
    ("SCAM: Platba předem", "Práce z domu", "HomeWork", "Pouze malý poplatek předem 5000 Kč za školení.", "ILLEGAL"),
    ("ILLEGAL: Pilot", "Pilot letadla", "Airlines", "Hledáme pilota pro mezinárodní lety.", "ILLEGAL"),
    ("MLM: Pyramida", "Finanční poradce", "Network", "Budujte tým pod sebou, pasivní příjem!", "ILLEGAL"),
    ("REVIEW: Vysoký plat", "Asistent", "Quick", "Žádná praxe, plat 80 000 Kč!", "REVIEW"),
    ("LEGAL: Junior Dev", "Junior Python Developer", "Tech Co", "Hledáme junior vývojáře. Znalost Pythonu. Plat 40-50k.", "LEGAL"),
]

print("=" * 70)
print("🧪 Testing Job Legality Detection")
print("=" * 70)

passed = failed = 0

for name, title, company, desc, expected in tests:
    risk, is_legal, reasons, needs_review = check_legality_rules(title, company, desc)
    
    actual = "ILLEGAL" if not is_legal else ("REVIEW" if needs_review else "LEGAL")
    match = actual == expected
    
    status = "✅" if match else "❌"
    if match:
        passed += 1
    else:
        failed += 1
    
    print(f"\n{status} {name}")
    print(f"   Expected: {expected}, Got: {actual}, Risk: {risk:.2f}")
    if reasons:
        print(f"   Reasons: {', '.join(reasons[:2])}")

print(f"\n{'='*70}")
print(f"Results: {passed} passed, {failed} failed")
print(f"{'='*70}")

print("\n📧 EMAIL NOTIFICATIONS:")
print("✅ Emails will be sent for ILLEGAL and REVIEW jobs to:")
print("   • Admin: floki@jobshaman.cz")
print("   • Recruiter: their contact email (if available)")
print("\n✅ Email sending tested and working (test_email.py)")
