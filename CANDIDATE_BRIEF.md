# Candidate Brief — Member Portal API

## Your task

You have joined the team that owns the member portal API. This service handles accounts and login sessions. It has registration, login, a user profile, and an admin-only list of all users.

A security review found several problems. The QA team then confirmed them. Your job is to fix the code so the service works as described below.

The server starts. Every endpoint answers. Nothing crashes. This makes the task harder, because there is no error message to follow.

Most of the problems are the same type: the code **allows** something that it should **refuse**. Two problems are the opposite: the code refuses someone who should be allowed.

You have **1 hour**.

- Fix the existing code. Do not rewrite the project.
- Do not change the framework. Do not add new features.
- Test while you work. You can use curl, Postman, or a browser.
- Please explain your thinking out loud while you work.

## How an account looks

```json
{ "id": 2, "email": "member@example.com", "name": "Milo Member", "role": "member", "createdAt": "2026-01-11T14:30:00.000Z" }
```

There are two roles: `member` and `admin`.

Two accounts already exist when the server starts. Their email addresses and passwords are in the README.

A password must be 8 characters or longer. Passwords are never saved as plain text. They are saved as a scrypt hash with a salt.

## How the API should work

| Method | Path             | Who can call it       | What it should do                                                       |
| ------ | ---------------- | --------------------- | ----------------------------------------------------------------------- |
| POST   | `/auth/register` | Anyone                | Create an account. Return 201. The role is **always** `member`. If the email already exists, return 409 |
| POST   | `/auth/login`    | Anyone                | If the email and password are correct, return 200 and a token. If not, return 401 |
| GET    | `/me`            | Any signed-in user    | Return the profile of the signed-in user. It must **not** contain the password or the hash |
| PATCH  | `/me/password`   | Any signed-in user    | Change the password. The user must send the correct current password. If it is wrong, return 401 |
| GET    | `/admin/users`   | Admin users only      | Return the list of all accounts. A member must get 403                  |

To call a protected endpoint, send the token in a header:

```
Authorization: Bearer <token>
```

A token is only valid when **both** of these are true:

1. Its signature matches its payload.
2. It has not expired.

The README explains how a token is built.

## Please read this before you start

**The token is not a JWT.**
It looks similar, but it is not the same thing. A JWT has three parts. This token has only two parts. Tools like jwt.io, `jsonwebtoken` and `jose` will **not** work with it. The exact format is in the README. Please do not spend time trying to make a JWT library work.

**Normally you get a token by logging in.**
You call `POST /auth/login` and it gives you a token.

**But login is broken right now. This is problem 1 in the list below.**
So you cannot get a token that way until you fix it. Four of the seven problems are on endpoints that need a token. For this reason, we suggest you look at problem 1 first.

**You can also make a token yourself.**
If you want to test the protected endpoints before you fix login, run this command. It prints a valid token:

```bash
node -e "const{createHmac}=require('node:crypto');const p=Buffer.from(JSON.stringify({sub:2,role:'member',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');console.log(p+'.'+createHmac('sha256','dev-session-secret').update(p).digest('base64url'))"
```

Use `sub:2, role:'member'` for the member account. Use `sub:1, role:'admin'` for the admin account. Then send it like this:

```bash
curl http://localhost:3000/me -H "Authorization: Bearer <the token>"
```

This command is only a testing helper. It does not fix anything, and it is not one of the 7 problems.

## The problems QA reported

QA listed these in the order they found them. This is not the best order to fix them in.

**1. Nobody can log in.**
`POST /auth/login` returns `401 Invalid credentials`, even when the email and password are correct. This happens for both of the accounts that already exist. Registration still returns 201. So new accounts are created, but nobody can use them.

**2. The profile shows the password hash.**
`GET /me` returns a `passwordHash` field together with the normal fields. This field must never be sent to the client.

**3. Anyone can make themselves an admin.**
If you send `{"role":"admin"}` to `POST /auth/register`, you get an account with the `admin` role. Anyone can call this endpoint, so the caller must not be allowed to choose the role.

**4. The admin check works the wrong way round.**
A member's token gets `200` from `GET /admin/users` and can read every account. The admin's own token gets `403`.

**5. Fake tokens are accepted.**
Take a real token. Change the payload so it points to a different user id and role. Do **not** change the signature. Now call `GET /me`. It returns that other user's profile. This means the signature is not being checked.

**6. The same email can register many times.**
Send `POST /auth/register` twice with the same details. Both calls return `201`. Now two accounts have the same email address. The second call should return `409`.

**7. A password can be changed without the old password.**
Send `PATCH /me/password` with a `currentPassword` that is wrong. It still returns `{"updated":true}` and it still changes the password.

## What we want to see

- Fix the problems one at a time.
- After each fix, call the endpoint again and check the result yourself. Do not only read the code.
- Test the negative case too. For example: a wrong password must fail, and a member must be refused by the admin endpoint.
- Many of these problems are security problems. Please explain **why** each one is dangerous. We want to hear how you think, not only the fix.
- Keep your changes small. The structure of the app is good. The problems are small details inside it.

## Check your progress

Run this command at any time:

```bash
npm run check
```

It prints how many of the 7 problems you have fixed, for example `3/7 fixed — 4 to go`.

It only gives you the number. It never tells you which problem, what is wrong, or where. Use the QA list above to guide you.

Please do not edit `check.js`.

Good luck!
