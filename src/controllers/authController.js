import { MIN_PASSWORD_LENGTH } from '../config.js';
import { createUser, findByEmail, publicUser } from '../services/userService.js';
import { verifyPassword } from '../services/passwordService.js';
import { issueToken } from '../services/tokenService.js';

export function register(req, res) {
  const { email, password, name, role } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  if (String(password).length < MIN_PASSWORD_LENGTH) {
    return res
      .status(400)
      .json({ error: `password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }

  const result = createUser({ email, password, name, role: role ?? 'member' });

  if (result.error === 'EMAIL_TAKEN') {
    return res.status(409).json({ error: 'Email already registered' });
  }

  return res.status(201).json(publicUser(result.user));
}

export function login(req, res) {
  const { email, password } = req.body ?? {};
  const user = findByEmail(email ?? '');

  if (!user || !verifyPassword(user.passwordHash, password ?? '')) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  return res.json({ token: issueToken(user), user: publicUser(user) });
}
