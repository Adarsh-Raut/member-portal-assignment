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

## Bug 3: Admin check is backwards

**What was wrong:**
`GET /admin/users` let a normal member see all users (200) but blocked a real admin (403). The check was flipped.

**Where it was:**
`src/middleware/requireRole.js:2` and `src/app.js:15`

`requireRole('admin')` is used on the `/admin` routes. The code inside was:
`if (req.auth?.role === role) return 403` - so if your role matched the required role, you got blocked. If it did not match, you got in.

**How to test it:**
```bash
# login as admin and member to get two tokens
curl -s -X POST http://localhost:3000/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@example.com","password":"adminpass123"}'
curl -s -X POST http://localhost:3000/auth/login -H 'Content-Type: application/json' -d '{"email":"member@example.com","password":"memberpass123"}'

curl -i http://localhost:3000/admin/users -H "Authorization: Bearer ADMIN_TOKEN"
# Before fix: 403 (wrong)
# After fix: 200 with list of users

curl -i http://localhost:3000/admin/users -H "Authorization: Bearer MEMBER_TOKEN"
# Before fix: 200 with all users leaked (bad)
# After fix: 403 Forbidden
```

**How to fix:**
In `src/middleware/requireRole.js:2` flip the check:
```js
// before (broken)
if (req.auth?.role === role) {

// after (fixed)
if (req.auth?.role !== role) {
```

**Why it matters:**
Members could see every account in the system. Admins could not do their job. It leaks user data and breaks access control.

---

## Bug 4: Profile shows the password hash

**What was wrong:**
`GET /me` returned the password hash along with the normal profile data. You could see a `passwordHash` field like `"a1b2c3:9f8e..."` in the response.

**Where it was:**
`src/controllers/userController.js:11` and `src/services/userService.js:24`

The project already has a helper `publicUser` that picks only the safe fields: `id, email, name, role, createdAt`. The admin list used it, but `getMe` just did `res.json(user)` and sent the whole database row including the hash.

**How to test it:**
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login -H 'Content-Type: application/json' -d '{"email":"member@example.com","password":"memberpass123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -s http://localhost:3000/me -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
# Before fix: has "passwordHash"
# After fix: only id, email, name, role, createdAt
```

**How to fix:**
In `src/controllers/userController.js:2,11` import and use the filter:
```js
// before (broken)
import { findById, replacePassword } from '../services/userService.js';
return res.json(user);

// after (fixed)
import { findById, publicUser, replacePassword } from '../services/userService.js';
return res.json(publicUser(user));
```

**Why it matters:**
If the hash leaves the server, an attacker who steals a token or watches logs can try to crack the password offline. The hash should never leave the database.

---

## Bug 5: Anyone can make themselves an admin

**What was wrong:**
If you sent `{"role":"admin"}` when registering, you got an admin account. Since anyone can register, this means anyone could become admin.

**Where it was:**
`src/controllers/authController.js:7,19` and `src/services/userService.js:44`

`authController` took `role` straight from the request body and passed it to `createUser`. `userService` then saved whatever role it got. No check.

**How to test it:**
```bash
curl -i -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"sneaky@example.com","password":"supersecret1","name":"Sneaky","role":"admin"}'
# Before fix: 201 with "role":"admin" (bad)
# After fix: 201 with "role":"member" (good)

# Normal register should still be member:
curl -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"normal@example.com","password":"supersecret1","name":"Normal"}'
# 201 with "role":"member"
```

**How to fix:**
Remove `role` from the client input and hardcode it:
```js
// src/controllers/authController.js:7,19
// before
const { email, password, name, role } = req.body ?? {};
createUser({ email, password, name, role: role ?? 'member' });

// after
const { email, password, name } = req.body ?? {};
createUser({ email, password, name });

// src/services/userService.js:44
// before
export function createUser({ email, password, name, role }) {
  const user = { ..., role, ... }

// after
export function createUser({ email, password, name }) {
  const user = { ..., role: 'member', ... }
```

**Why it matters:**
Anyone could give themselves admin rights and then read all users or do anything admin can do. It's a full privilege escalation.

---

## Bug 6: Same email can register many times

**What was wrong:**
You could register the same email twice and both times got 201. Now two accounts have the same email. The second one should have been 409.

**Where it was:**
`src/services/userService.js:44` and `src/controllers/authController.js:21`

`authController` already had code to handle `EMAIL_TAKEN` -> 409, but `userService.createUser` never returned that error. It just created a new user every time without checking if the email already exists. The helper `findByEmail` existed but was not used in `createUser`.

**How to test it:**
```bash
curl -i -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"dup@example.com","password":"supersecret1","name":"Dup"}'
# First time: 201

curl -i -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"dup@example.com","password":"supersecret1","name":"Dup"}'
# Before fix: 201 again (bad)
# After fix: 409 Email already registered

# Case should also count - findByEmail is case-insensitive:
curl -i -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"DUP@example.com","password":"supersecret1","name":"Dup2"}'
# After fix: 409
```

**How to fix:**
At the top of `createUser` in `src/services/userService.js:44` add a check:
```js
// before (broken)
export function createUser({ email, password, name }) {
  const user = { ...

// after (fixed)
export function createUser({ email, password, name }) {
  if (findByEmail(email)) {
    return { error: 'EMAIL_TAKEN' };
  }
  const user = { ...
```
`authController` already maps that error to 409, so no other change needed.

**Why it matters:**
If the same email can exist twice, login becomes confusing (which account do you get?), and it breaks the rule that email is unique. It can also be used to block someone else from registering or to create confusion.

---

## Bug 7: Password can be changed without the old password

**What was wrong:**
`PATCH /me/password` let you set a new password even if you sent a wrong `currentPassword`. It did not check the old password at all.

**Where it was:**
`src/controllers/userController.js:15` and `src/services/passwordService.js:12`

The code only read `newPassword` from the body. It never read `currentPassword` and never called `verifyPassword`. It just called `replacePassword` directly.

**How to test it:**
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login -H 'Content-Type: application/json' -d '{"email":"member@example.com","password":"memberpass123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

# wrong current should fail
curl -i -X PATCH http://localhost:3000/me/password \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"currentPassword":"wrong-one","newPassword":"hijacked12345"}'
# Before fix: 200 updated true and password changed (bad)
# After fix: 401 Current password is incorrect

# correct should work
curl -i -X PATCH http://localhost:3000/me/password \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"currentPassword":"memberpass123","newPassword":"freshpass456"}'
# 200 updated true, then login with new password works
```

**How to fix:**
In `src/controllers/userController.js:1,15` import the check and add it:
```js
// before (broken)
import { findById, publicUser, replacePassword } from '../services/userService.js';
const { newPassword } = req.body ?? {};
// ... length check then replacePassword

// after (fixed)
import { findById, publicUser, replacePassword } from '../services/userService.js';
import { verifyPassword } from '../services/passwordService.js';
const { currentPassword, newPassword } = req.body ?? {};
// after finding user:
if (!currentPassword || !verifyPassword(currentPassword, user.passwordHash)) {
  return res.status(401).json({ error: 'Current password is incorrect' });
}
```

**Why it matters:**
If someone gets your token for a short time (shared computer, XSS), they can lock you out forever by changing the password without knowing the old one. Asking for the old password proves you are the real owner.

---
