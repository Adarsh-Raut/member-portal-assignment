import express from 'express';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { requireAuth } from './middleware/requireAuth.js';
import { requireRole } from './middleware/requireRole.js';

const app = express();

app.use(express.json());

app.use('/auth', authRoutes);
app.use('/me', requireAuth, userRoutes);
app.use('/admin', requireAuth, requireRole('admin'), adminRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((error, req, res, next) => {
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
