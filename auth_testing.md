# Auth Testing Playbook — Araxyss

Two auth systems live side-by-side. Test both.

## 1. Legacy email/password (existing users)
```
POST /api/auth/signup {name, email, password}   # returns {token, user}
POST /api/auth/login  {email, password}         # returns {token, user}
```
The `token` is a legacy HS256 JWT with 7-day exp. Send as `Authorization: Bearer <jwt>`.

Test account:
- email: `reviewer@example.com`
- password: `reviewpass1`
- name: Test Reviewer

## 2. Emergent-managed Google Auth
Frontend flow (do NOT test by opening `auth.emergentagent.com` directly — use a seeded session):
```
window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(window.location.origin + "/dashboard")}`
```
Callback lands at `<origin>/dashboard#session_id=<id>`. AppRouter detects the hash synchronously and mounts AuthCallback, which POSTs the session_id to:
```
POST /api/auth/google/session      Header: X-Session-ID: <session_id>
    → 200 {user:{id,email,name,picture}, session_token}
    Sets cookie: session_token (httpOnly, secure, samesite=none, 7 days)
```

## Seed a Google-style session for tests (no real OAuth round-trip)
```
mongosh --eval "
use('test_database');
var uid = 'test-user-' + Date.now();
var tok = 'test_session_' + Date.now();
db.users.insertOne({
  id: uid,
  email: 'google.tester+' + Date.now() + '@example.com',
  name: 'Google Tester',
  picture: 'https://ui-avatars.com/api/?name=Google+Tester',
  google_id: 'g-' + uid,
  auth_provider: 'google',
  created_at: new Date().toISOString()
});
db.user_sessions.insertOne({
  user_id: uid,
  session_token: tok,
  expires_at: new Date(Date.now() + 7*24*3600*1000),
  created_at: new Date()
});
print('user_id: ' + uid);
print('session_token: ' + tok);
"
```

## Playwright — seed cookie + verify workspace
```javascript
await page.context.add_cookies([{
    "name": "session_token",
    "value": "<paste session_token here>",
    "domain": "essay-authenticity.preview.emergentagent.com",
    "path": "/",
    "httpOnly": true,
    "secure": true,
    "sameSite": "None"
}]);
await page.goto("https://essay-authenticity.preview.emergentagent.com/dashboard");
```
Then confirm workspace renders without redirect to /login.

## curl checks

Cookie-based:
```
curl -s -X GET https://.../api/auth/me \
  -H "Cookie: session_token=<paste token>" -b cookies.txt

curl -s -X POST https://.../api/v1/analyze \
  -H "Cookie: session_token=<token>" -H "Content-Type: application/json" \
  -d '{"text":"..."}'
```

Bearer-based (both JWT and session_token accepted):
```
curl -s -X GET https://.../api/auth/me -H "Authorization: Bearer <jwt-or-session_token>"
```

## Logout
```
POST /api/auth/logout             # clears cookie + deletes session row
```

## Success indicators
- `/api/auth/me` returns 200 with `{user, auth_via: "google_cookie" | "jwt"}`
- Reviewer can navigate `/dashboard`, `/reports`, `/batch` without login redirect
- `/api/v1/reports` works using cookie alone (no Authorization header needed)
- Logout invalidates the session_token — subsequent `/auth/me` returns 401

## Failure indicators
- 401 on `/auth/me` when a cookie is present → cookie samesite/domain misconfigured
- 502 on `/api/auth/google/session` → Emergent auth endpoint unreachable
- Redirect loop back to /login after Google callback → AppRouter is not detecting session_id fragment before Protected wrapper runs
