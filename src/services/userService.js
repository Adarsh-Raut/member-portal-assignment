import { hashPassword } from './passwordService.js';

let users = [
  {
    id: 1,
    email: 'admin@example.com',
    name: 'Ada Admin',
    role: 'admin',
    passwordHash: hashPassword('adminpass123'),
    createdAt: '2026-01-04T09:00:00.000Z',
  },
  {
    id: 2,
    email: 'member@example.com',
    name: 'Milo Member',
    role: 'member',
    passwordHash: hashPassword('memberpass123'),
    createdAt: '2026-01-11T14:30:00.000Z',
  },
];

const nextId = () => users.reduce((highest, user) => Math.max(highest, user.id), 0) + 1;

export const publicUser = ({ id, email, name, role, createdAt }) => ({
  id,
  email,
  name,
  role,
  createdAt,
});

export const listUsers = () => [...users];

export function findByEmail(email) {
  const wanted = String(email).trim().toLowerCase();

  return users.find((user) => user.email.toLowerCase() === wanted) ?? null;
}

export function findById(id) {
  return users.find((user) => user.id === id) ?? null;
}

export function createUser({ email, password, name, role }) {
  const user = {
    id: nextId(),
    email: String(email).trim(),
    name: name ?? '',
    role,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };

  users = [...users, user];

  return { user };
}

export function replacePassword(id, newPassword) {
  const passwordHash = hashPassword(newPassword);

  users = users.map((user) => (user.id === id ? { ...user, passwordHash } : user));

  return findById(id);
}
