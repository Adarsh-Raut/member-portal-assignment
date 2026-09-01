import { Router } from 'express';

import { listAllUsers } from '../controllers/adminController.js';

const router = Router();

router.get('/users', listAllUsers);

export default router;
