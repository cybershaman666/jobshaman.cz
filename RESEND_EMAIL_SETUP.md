# JobShaman - Resend Email Setup & Troubleshooting

## Problem: Team Collaboration Invitations Not Being Sent

Emails with collaboration invitations for team members are not being sent from the company profile. This document helps diagnose and fix the issue.

## Root Causes

### 1. **RESEND_API_KEY is NOT SET** ⚠️ (Most Common)
The `RESEND_API_KEY` environment variable is missing or not properly configured.

**Location in code:** `backend/app/core/config.py` (line 118)
```python
RESEND_API_KEY = _env_str("RESEND_API_KEY") or _env_str("VITE_RESEND_API_KEY")
```

### 2. **Resend Package Not Installed**
The `resend` Python package is required but not installed.

**Fix:** 
```bash
pip install resend
```

### 3. **Email Send Function Returning Wrong Status** ✅ FIXED
Previously, the `send_email()` function returned `True` in DEV mode even when resend package wasn't installed.

**Fixed in:** `backend/app/services/email.py` (lines 88-94)
- Now returns `False` when email cannot be sent
- Better error logging

### 4. **Resend Invitation Not Checking Email Status** ✅ FIXED
The `resend_company_invitation()` endpoint was not checking if the email was actually sent.

**Fixed in:** `backend/app/domains/reality/service.py` (lines 1710-1725)
- Now captures email send result
- Returns "email_failed" status if email could not be sent
- Matches the logic in `invite_company_member()`

## How to Setup RESEND_API_KEY

### Option A: Local Development (.env file)
1. Get your Resend API key from [resend.com](https://resend.com)
2. Create `.env` file in `backend/` directory:
```bash
RESEND_API_KEY="re_your_api_key_here"
```

### Option B: Azure Cloud (Production)
1. Get your Resend API key from [resend.com](https://resend.com)
2. Store in Azure Key Vault:
```bash
az keyvault secret set --vault-name YOUR_KEYVAULT_NAME \
  --name "RESEND-API-KEY" \
  --value "re_your_api_key_here"
```

3. Ensure it's referenced in Azure Container App deployment:
   - File: `scripts/deploy_azure_container_app.sh`
   - Already configured with KeyVault reference

## Testing Email System

### Run Diagnostic Test
```bash
cd backend
python test_email.py
```

This will check:
1. ✅ RESEND_API_KEY is set
2. ✅ Resend package is installed  
3. ✅ Generic email sending works
4. ✅ Teammate invitation email works

### Expected Output
```
✅ RESEND_API_KEY is set: re_xxxxx...xxxxx
✅ Resend package is installed
✅ Generic test email sent successfully
✅ Invitation email sent successfully
✅ ALL TESTS PASSED! Email system is working correctly.
```

### If Tests Fail

**Error: "RESEND_API_KEY is NOT set!"**
- Check your `.env` file exists in `backend/` directory
- Or check Azure Key Vault has the secret
- Restart the application after adding the key

**Error: "Resend package is NOT installed!"**
```bash
pip install resend
pip install -r requirements.txt  # This includes resend
```

**Error: "Failed to send generic test email"**
- Verify your Resend API key is valid at [resend.com](https://resend.com)
- Check Resend dashboard for any account issues
- Look at detailed error messages in test output

## Code Changes Made

### 1. Fixed `send_email()` function
**File:** `backend/app/services/email.py`
- Changed DEV mode to return `False` instead of `True`
- Added success logging when email is sent
- Now correctly indicates when email cannot be sent

### 2. Fixed `resend_company_invitation()` 
**File:** `backend/app/domains/reality/service.py`
- Now captures the return value from `send_teammate_invitation_email()`
- Returns "email_failed" status if email send fails
- Matches the logic in `invite_company_member()`

### 3. Enhanced API Error Handling
**File:** `backend/app/api/v2/endpoints/company.py`
- Added check for "email_failed" status
- Returns 500 error with proper message when email fails

### 4. Improved Test Script
**File:** `backend/test_email.py`
- Comprehensive diagnostics for both generic and invitation emails
- Detailed step-by-step checking
- Better error messages

## API Response Examples

### Successful Team Invitation Send
```json
{
  "status": "success",
  "data": {
    "status": "invited",
    "email": "teammate@company.com"
  }
}
```

### Failed Email Send (Now Catches This!)
```json
{
  "status": 500,
  "detail": "Email service unavailable. Please try again later."
}
```

## Frontend Changes

The frontend error handling for `resendCompanyInvitation()` should now properly receive:
- Success (2xx) when email sends successfully
- Error (5xx) when email fails

**File:** `frontend/src/services/v2UserService.ts`
```typescript
export const resendCompanyInvitation = async (
    companyId: string,
    memberId: string
): Promise<any> => {
    const response = await ApiService.post<any>(
        `/company/${encodeURIComponent(companyId)}/members/${encodeURIComponent(memberId)}/resend-invitation`, 
        {}
    );
    return response?.data || null;
};
```

## Verification Checklist

- [ ] Resend API key is obtained from https://resend.com
- [ ] RESEND_API_KEY is set in `.env` (local) or Azure Key Vault (production)
- [ ] Backend `test_email.py` passes all tests
- [ ] Team member can successfully be invited
- [ ] Invited member receives email with acceptance link
- [ ] Acceptance link in email works correctly

## Need Help?

1. Run `python backend/test_email.py` for diagnostics
2. Check logs with `docker logs` if running in container
3. Verify Resend account status at https://resend.com/dashboard
4. Check that `RESEND_API_KEY` environment variable is properly set

