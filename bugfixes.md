# Bug Fixes - Member Portal API

## Bug 1: Nobody can log in

**What was wrong:**
Login always returned 401 even with the right email and password. Both seeded accounts (admin and member) were affected. New accounts you just registered also could not log in.

**Where it was:**
`src/controllers/authController.js:32` and `src/services/passwordService.js:12`

The password check function is defined as `verifyPassword(password, storedHash)` - first argument is the plain password you typed, second is the hash saved in the database.

But the login code was calling it backwards: `verifyPassword(user.passwordHash, password)`. So it tried to split the plain password on `:` to get a salt, found nothing, and always returned false. Every login looked like a wrong password.

**How to test it:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"member@example.com","password":"memberpass123"}'
# Before fix: 401 Invalid credentials
# After fix: 200 with token

# Wrong password should still fail:
curl -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"member@example.com","password":"wrong"}'
# Always 401 - this is correct
```

**How to fix:**
Swap the arguments in `src/controllers/authController.js:32`:
```js
// before (broken)
verifyPassword(user.passwordHash, password ?? '')

// after (fixed)
verifyPassword(password ?? '', user.passwordHash)
```

**Why it matters:**
If nobody can log in, the whole service is useless. It breaks everything that needs a token.

---

## Bug 2: Fake tokens are accepted

**What was wrong:**
You could change a valid token's payload (like change user id from 2 to 1, or role from member to admin) and keep the old signature, and the server still accepted it. It never checked if the signature matched the payload. It also did not check if the token was expired.

**Where it was:**
`src/middleware/requireAuth.js:1,11` and `src/services/tokenService.js:21,31`

The file `tokenService.js` has two functions:
- `decodeToken` just base64-decodes the payload. No check.
- `verifyToken` does the real check: it re-creates the HMAC signature and compares it with timingSafeEqual, and checks `exp` is still in the future.

But `requireAuth.js` was using `decodeToken`, so it skipped both checks.

**How to test it:**
```bash
# login as member to get a real token
curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"member@example.com","password":"memberpass123"}'

# make a fake token - same signature, different payload (sub 1, admin)
node -e "
const tok='YOUR_TOKEN'.split('.');
const fakePayload=Buffer.from(JSON.stringify({sub:1,role:'admin',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
console.log(fakePayload+'.'+tok[1])
"

# try it
curl -i http://localhost:3000/me -H "Authorization: Bearer FAKE_TOKEN"
# Before fix: 200 and returns admin profile (bad)
# After fix: 401 Invalid or expired session (good)

# real token should still work:
curl -i http://localhost:3000/me -H "Authorization: Bearer REAL_TOKEN"
# 200
```

**How to fix:**
In `src/middleware/requireAuth.js:1,11` change the import and the call:
```js
// before (broken)
import { decodeToken } from '../services/tokenService.js';
const payload = decodeToken(token);

// after (fixed)
import { verifyToken } from '../services/tokenService.js';
const payload = verifyToken(token);
```

**Why it matters:**
Without signature check, anyone can make themselves an admin or pretend to be any user. It's a full login bypass. No secret needed.

---
