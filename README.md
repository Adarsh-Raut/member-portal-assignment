# Member Portal API

Accounts and sessions for the member portal: registration, login, a self-service profile, and an admin-only user list. Everything is stored in memory — no database or configuration required.

## Getting started

```bash
npm install
npm start
```

For auto-restart on file changes during development, use `npm run dev` instead.

## Checking your progress

```bash
npm run check
```

Prints your progress, e.g. `3/7 fixed — 4 to go.` Run it as often as you like.

The server listens on port 3000 by default (override with the `PORT` environment variable).

## Layout

```
server.js                        starts the HTTP listener
src/app.js                       express app, middleware, route mounting
src/config.js                    secret, token lifetime, password rules
src/routes/                      thin routers, one per area
src/controllers/                 request handling and responses
src/services/                    users, passwords, session tokens
src/middleware/                  requireAuth, requireRole
```

## Seeded accounts

| Email                 | Password        | Role     |
| --------------------- | --------------- | -------- |
| `admin@example.com`   | `adminpass123`  | `admin`  |
| `member@example.com`  | `memberpass123` | `member` |

Admin accounts are provisioned by the seed only. Anyone who registers gets the `member` role.

## Session tokens

A token is two base64url segments joined by a dot:

```
base64url(payload) . base64url(HMAC-SHA256(base64url(payload), SESSION_SECRET))
```

The payload is `{ "sub": <user id>, "role": <role>, "exp": <unix seconds> }`. A token is only acceptable if the signature matches the payload **and** `exp` is still in the future. Send it as `Authorization: Bearer <token>`.

## Endpoints

| Method | Path              | Auth           | Description                                        |
| ------ | ----------------- | -------------- | -------------------------------------------------- |
| POST   | `/auth/register`  | —              | Create an account, returns 201 with the new user    |
| POST   | `/auth/login`     | —              | Exchange email + password for a token               |
| GET    | `/me`             | Bearer         | The signed-in user's profile                        |
| PATCH  | `/me/password`    | Bearer         | Change password (requires the current one)          |
| GET    | `/admin/users`    | Bearer + admin | List every account                                  |

Passwords must be at least 8 characters. A user object never includes the password hash.

## Testing the API

Import [`postman_collection.json`](postman_collection.json) into Postman (or any compatible client) for ready-made requests covering every endpoint.

Prefer the terminal? Equivalent curl commands, each with the response a correctly working server returns. Examples assume a freshly started server (restart with `npm start` to reset the in-memory data).

**Register** — status `201`; new accounts are always `member`

```bash
curl -i -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"nia@example.com","password":"supersecret1","name":"Nia"}'
```

```json
{ "id": 3, "email": "nia@example.com", "name": "Nia", "role": "member", "createdAt": "<server timestamp>" }
```

Registering an email that already exists returns `409 {"error":"Email already registered"}`.

**Log in** — status `200`; wrong credentials return `401 {"error":"Invalid credentials"}`

```bash
curl -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"member@example.com","password":"memberpass123"}'
```

```json
{
  "token": "eyJzdWIiOjIsInJvbGUiOiJtZW1iZXIiLCJleHAiOjE3ODAwMDAwMDB9.QmFzZTY0dXJsU2lnbmF0dXJl",
  "user": { "id": 2, "email": "member@example.com", "name": "Milo Member", "role": "member", "createdAt": "2026-01-11T14:30:00.000Z" }
}
```

**Your profile** — no password material in the response

```bash
TOKEN=<paste the token from login>
curl http://localhost:3000/me -H "Authorization: Bearer $TOKEN"
```

```json
{ "id": 2, "email": "member@example.com", "name": "Milo Member", "role": "member", "createdAt": "2026-01-11T14:30:00.000Z" }
```

A missing, altered or expired token returns `401`.

**Change your password** — the current password must be correct

```bash
curl -i -X PATCH http://localhost:3000/me/password \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"currentPassword":"memberpass123","newPassword":"freshpass456"}'
```

```json
{ "updated": true }
```

A wrong `currentPassword` returns `401 {"error":"Current password is incorrect"}`.

**List all users (admin only)**

```bash
curl -i http://localhost:3000/admin/users -H "Authorization: Bearer $ADMIN_TOKEN"
```

```json
[
  { "id": 1, "email": "admin@example.com", "name": "Ada Admin", "role": "admin", "createdAt": "2026-01-04T09:00:00.000Z" },
  { "id": 2, "email": "member@example.com", "name": "Milo Member", "role": "member", "createdAt": "2026-01-11T14:30:00.000Z" }
]
```

A member's token returns `403 {"error":"Forbidden"}`.

Tip: add `-i` to any curl command to see the response status code and headers.
