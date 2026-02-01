# Job Legality Detection - Improvements Summary

## What Was Improved

### Previous System (Basic)
- Only 4 simple patterns
- All patterns had same weight (0.5)
- Threshold: 0.7 for illegal
- Limited scam detection

### New System (Comprehensive)

#### 🚨 Critical Patterns (Auto-Reject, Risk >= 1.0)
**Scams & Fraud:**
- Výdělek bez práce/úsilí/investice
- Rychlé peníze
- Poplatek/platba předem
- Garantovaný výdělek

**Illegal Activities:**
- Pilot letadla (mimo zaměření portálu)
- Pašování, nelegální činnost
- Práce na černo, bez smlouvy

**MLM & Pyramid Schemes:**
- Multi-level marketing, síťový marketing
- Budování týmu pod sebou
- Pasivní příjem, zisk ve spánku

**Cryptocurrency Scams:**
- Bitcoin/krypto s garantovaným ziskem
- Investice bez rizika

#### ⚠️ High Risk Patterns (Manual Review, Risk 0.3-0.6)
**Unrealistic Promises:**
- Nerealistický plat pro začátečníky (80k+ bez zkušeností)
- Práce z domu s podezřelými sliby

**Suspicious Requirements:**
- Vyžaduje investici od zaměstnance
- Vyžaduje nákup produktů
- Placené školení před nástupem

**MLM Indicators:**
- Neomezený výdělek
- "Buď svým šéfem", "finanční svoboda"

**Other Red Flags:**
- Příliš krátký popis (<50 znaků)
- Podezřelý kontakt (pouze SMS/WhatsApp)
- Gambling, casino, sázky
- Adult content
- Anonymní společnost

#### Additional Checks
- **Spam Detection:** Nadměrné vykřičníky (>5)
- **Spam Detection:** Titulek celý VELKÝMI PÍSMENY
- **Professionalism:** Osobní email místo firemního

## Risk Score Thresholds

```
>= 1.0  → ILLEGAL (auto-reject, email to admin + recruiter)
0.5-0.99 → NEEDS REVIEW (manual check, email to admin)
< 0.5   → LEGAL (auto-approve, no email)
```

## Email Notification Flow

When job is flagged (ILLEGAL or REVIEW):

1. **Admin Email** (`floki@jobshaman.cz`):
   - Subject: 🚨 [ZAKÁZÁNO] or ⚠️ [REVIZE]
   - Contains: Company, Position, Risk Score, Reasons
   - Link to view job

2. **Recruiter Email** (if contact_email exists):
   - Subject: ❌ Zamítnut or ⚠️ Čeká na revizi
   - Explains why job was flagged
   - Lists specific reasons

3. **Database Update**:
   - `legality_status`: 'illegal', 'review', or 'legal'
   - `risk_score`: numerical score
   - `verification_notes`: reasons joined

## Testing

Run: `python test_legality.py`

Tests cover:
- ✅ Scams (výdělek bez práce, platba předem)
- ✅ Illegal content (pilot letadla)
- ✅ MLM schemes (pyramidový systém)
- ✅ Suspicious offers (vysoký plat bez zkušeností)
- ✅ Legitimate jobs (normal developer positions)

## Production Deployment

Make sure `RESEND_API_KEY` is set on Render.io:
- Key: `RESEND_API_KEY`
- Value: `re_8e5t1i6j_MbS1pmYYPY64uuA9Tkjj4Cha`

Emails are now properly configured and tested! ✅
