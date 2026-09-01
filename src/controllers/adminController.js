import { listUsers, publicUser } from '../services/userService.js';

export function listAllUsers(req, res) {
  return res.json(listUsers().map(publicUser));
}
