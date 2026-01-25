# CSRF Protection Implementation Guide for Frontend

## Overview

CSRF (Cross-Site Request Forgery) protection has been added to the backend. The frontend must:

1. Get a CSRF token from `/csrf-token` endpoint when user logs in
2. Include the token in the `X-CSRF-Token` header for all POST/PUT/DELETE requests
3. Handle 403 CSRF token errors gracefully

## Implementation Steps

### Step 1: Add CSRF Token Storage

In [services/authService.ts](services/authService.ts) or similar:

```typescript
// Store CSRF token in session storage (cleared on logout)
let csrfToken: string | null = null;

export const setCsrfToken = (token: string) => {
    csrfToken = token;
    sessionStorage.setItem('csrf_token', token);
};

export const getCsrfToken = (): string | null => {
    if (!csrfToken) {
        csrfToken = sessionStorage.getItem('csrf_token');
    }
    return csrfToken;
};

export const clearCsrfToken = () => {
    csrfToken = null;
    sessionStorage.removeItem('csrf_token');
};
```

### Step 2: Fetch CSRF Token on Login

In your login/auth handler:

```typescript
// After successful login
async function handleLoginSuccess(user: any) {
    try {
        // Fetch fresh CSRF token
        const response = await fetch(`${BACKEND_URL}/csrf-token`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${user.token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            setCsrfToken(data.csrf_token);
            console.log('✅ CSRF token obtained');
        } else {
            console.warn('⚠️ Could not fetch CSRF token, requests may fail');
        }
    } catch (error) {
        console.error('Error fetching CSRF token:', error);
    }
}
```

### Step 3: Include CSRF Token in Requests

Create a helper function for authenticated requests:

```typescript
export async function authenticatedFetch(
    url: string,
    options: RequestInit = {}
): Promise<Response> {
    const headers = new Headers(options.headers || {});
    
    // Add CSRF token for state-changing requests
    if (['POST', 'PUT', 'DELETE'].includes(options.method || 'GET')) {
        const token = getCsrfToken();
        if (token) {
            headers.set('X-CSRF-Token', token);
        }
    }
    
    // Add auth header
    const authToken = localStorage.getItem('auth_token');
    if (authToken) {
        headers.set('Authorization', `Bearer ${authToken}`);
    }
    
    return fetch(url, {
        ...options,
        headers
    });
}
```

### Step 4: Update Service Calls

Example for subscription cancellation:

**Before (without CSRF):**
```typescript
export const cancelSubscription = async () => {
    const response = await fetch(`${BACKEND_URL}/cancel-subscription`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${getAuthToken()}`,
            'Content-Type': 'application/json'
        }
    });
    return response.json();
};
```

**After (with CSRF):**
```typescript
export const cancelSubscription = async () => {
    const response = await authenticatedFetch(
        `${BACKEND_URL}/cancel-subscription`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        }
    );
    
    if (response.status === 403) {
        throw new Error('CSRF protection: Invalid or missing token. Please refresh and try again.');
    }
    
    return response.json();
};
```

### Step 5: Update All Components

Update these files to use `authenticatedFetch`:

- [services/billingService.ts](services/billingService.ts)
  - `verifyBilling()` - POST request
  - Any billing update endpoints

- [services/jobService.ts](services/jobService.ts)
  - Any POST/PUT/DELETE endpoints

- [components/ApplicationModal.tsx](components/ApplicationModal.tsx)
  - Application submission if it's POST
  - Any form submissions

- [components/PlanUpgradeModal.tsx](components/PlanUpgradeModal.tsx)
  - Plan upgrade submissions

## Error Handling

Always handle CSRF token errors:

```typescript
try {
    const response = await authenticatedFetch(url, options);
    
    if (response.status === 403) {
        const error = await response.json();
        if (error.detail && error.detail.includes('CSRF')) {
            // Token expired or invalid
            console.error('CSRF token invalid, refreshing...');
            
            // Try to get new token
            try {
                const tokenResponse = await fetch(`${BACKEND_URL}/csrf-token`);
                if (tokenResponse.ok) {
                    const tokenData = await tokenResponse.json();
                    setCsrfToken(tokenData.csrf_token);
                    // Retry request
                    return authenticatedFetch(url, options);
                }
            } catch (e) {
                console.error('Could not refresh CSRF token');
            }
        }
    }
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
} catch (error) {
    console.error('Request failed:', error);
    throw error;
}
```

## Token Expiration

CSRF tokens expire after 1 hour. For long-lived applications:

```typescript
// Periodically refresh token
setInterval(async () => {
    try {
        const response = await fetch(`${BACKEND_URL}/csrf-token`);
        if (response.ok) {
            const data = await response.json();
            setCsrfToken(data.csrf_token);
        }
    } catch (e) {
        console.warn('Could not refresh CSRF token');
    }
}, 50 * 60 * 1000); // Refresh every 50 minutes
```

## Testing CSRF Protection

```bash
# Without CSRF token (should fail)
curl -X POST http://localhost:8000/cancel-subscription \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# With CSRF token (should work)
curl -X POST http://localhost:8000/cancel-subscription \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-CSRF-Token: YOUR_CSRF_TOKEN" \
  -H "Content-Type: application/json"
```

## Security Notes

1. **Session Storage Only**: CSRF token is stored in `sessionStorage` (not `localStorage`) so it's cleared when browser closes
2. **One-Time Use**: Optional enhancement - modify backend to consume token after first use
3. **HTTPS Required**: CSRF protection is ineffective without HTTPS
4. **SameSite Cookies**: Backend sets cookies with SameSite=Strict when applicable
5. **Token Rotation**: Consider rotating tokens every 30 minutes for high-security operations

## Affected Endpoints

These endpoints now require CSRF protection:

- ✅ `POST /cancel-subscription`
- ✅ `POST /verify-billing` (optional - GET data only)
- ✅ `POST /create-job` (if implemented)
- ✅ `PUT /update-job` (if implemented)
- ✅ `DELETE /delete-job` (if implemented)
- ✅ Any future POST/PUT/DELETE endpoints

## Implementation Checklist

- [ ] Add `setCsrfToken()`, `getCsrfToken()`, `clearCsrfToken()` helpers
- [ ] Fetch CSRF token on login success
- [ ] Create `authenticatedFetch()` helper
- [ ] Update [services/billingService.ts](services/billingService.ts)
- [ ] Update [services/jobService.ts](services/jobService.ts)
- [ ] Update all form submission components
- [ ] Add error handling for 403 CSRF errors
- [ ] Test with invalid/missing CSRF tokens
- [ ] Add token refresh mechanism
- [ ] Deploy and monitor for CSRF errors

## Support

If CSRF errors appear in production:
1. Check that `/csrf-token` endpoint is being called on login
2. Verify `X-CSRF-Token` header is included in POST/PUT/DELETE requests
3. Check browser console for 403 errors
4. Look at backend logs for "CSRF token missing" messages

---

**Backend CSRF endpoints ready for integration:**
- `GET /csrf-token` - Get new CSRF token
- Error response: `403 "CSRF token missing or invalid"`
