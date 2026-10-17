import { Router } from 'express';
import { UserService } from '../services/UserService';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth';
import { User } from '../models/User';
import { generateToken } from '../utils/jwt';
import { config } from '../config';
import mfaRouter from './mfa';

const router = Router();
const userService = new UserService();

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const result = await userService.register(username, email, password);
    res.status(201).json({
      user: { id: result.user._id, username: result.user.username, email: result.user.email },
      token: result.token
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    if (!config.security.mfaDisabled && user.totpEnabled) {
      return res.status(403).json({
        success: false,
        mfaRequired: true,
        userId: user._id,
        email: user.email,
      });
    }

    const token = generateToken(user);
    res.json({
      success: true,
      token,
      user: { id: user._id, username: user.username, email: user.email, role: user.role },
    });
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : 'Login failed' });
  }
});

router.get('/me', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await userService.getUserById(req.user!.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      totpEnabled: !!(user as any).totpEnabled,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.use('/mfa', mfaRouter);

export default router;
