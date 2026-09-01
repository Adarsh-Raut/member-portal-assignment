import { MIN_PASSWORD_LENGTH } from '../config.js';
import { findById, publicUser, replacePassword } from '../services/userService.js';

export function getMe(req, res) {
  const user = findById(req.auth.sub);

  if (!user) {
    return res.status(404).json({ error: 'Account not found' });
  }

  return res.json(publicUser(user));
}

export function changePassword(req, res) {
  const { newPassword } = req.body ?? {};
  const user = findById(req.auth.sub);

  if (!user) {
    return res.status(404).json({ error: 'Account not found' });
  }

  if (!newPassword || String(newPassword).length < MIN_PASSWORD_LENGTH) {
    return res
      .status(400)
      .json({ error: `newPassword must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }

  replacePassword(user.id, newPassword);

  return res.json({ updated: true });
}
