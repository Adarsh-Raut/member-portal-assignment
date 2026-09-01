export const requireRole = (role) => (req, res, next) => {
  if (req.auth?.role !== role) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  return next();
};
