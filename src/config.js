export const SESSION_SECRET = process.env.SESSION_SECRET ?? 'dev-session-secret';

export const SESSION_TTL_SECONDS = 60 * 60;

export const MIN_PASSWORD_LENGTH = 8;

export const PORT = Number(process.env.PORT ?? 3000);
