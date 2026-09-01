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
