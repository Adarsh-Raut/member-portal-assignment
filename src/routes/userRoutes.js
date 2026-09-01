import { Router } from 'express';

import { changePassword, getMe } from '../controllers/userController.js';

const router = Router();

router.get('/', getMe);
router.patch('/password', changePassword);

export default router;
