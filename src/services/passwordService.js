import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 32;

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(String(password), salt, KEY_LENGTH).toString('hex');

  return `${salt}:${derived}`;
}

export function verifyPassword(password, stored) {
  const [salt, derived] = String(stored).split(':');

  if (!salt || !derived) {
    return false;
  }

  const candidate = scryptSync(String(password), salt, KEY_LENGTH);
  const expected = Buffer.from(derived, 'hex');

  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
