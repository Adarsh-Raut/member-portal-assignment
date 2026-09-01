import { createHmac, timingSafeEqual } from 'node:crypto';

import { SESSION_SECRET, SESSION_TTL_SECONDS } from '../config.js';

const encodePayload = (payload) => Buffer.from(JSON.stringify(payload)).toString('base64url');

const signPayload = (encoded) =>
  createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');

export function issueToken(user) {
  const payload = {
    sub: user.id,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encoded = encodePayload(payload);

  return `${encoded}.${signPayload(encoded)}`;
}

export function decodeToken(token) {
  const [encoded] = String(token).split('.');

  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function verifyToken(token) {
  const [encoded, provided] = String(token).split('.');

  if (!encoded || !provided) {
    return null;
  }

  const expected = signPayload(encoded);

  if (expected.length !== provided.length) {
    return null;
  }

  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(provided))) {
    return null;
  }

  const payload = decodeToken(token);

  if (!payload || typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) {
    return null;
  }

  return payload;
}
