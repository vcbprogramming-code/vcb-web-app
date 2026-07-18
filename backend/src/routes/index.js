import { Router } from 'express';
import authRoutes from './auth.routes.js';
import orgRoutes from './org.routes.js';
import projectRoutes from './projects.routes.js';
import documentRoutes from './documents.routes.js';
import approvalRoutes from './approvals.routes.js';
import verifyRoutes from './verify.routes.js';
import adminRoutes from './admin.routes.js';
import performanceRoutes from './performance.routes.js';
import creditRoutes from './credit.routes.js';
import onboardingRoutes from './onboarding.routes.js';
import { ApiError } from '../middleware/errorHandler.js';
import { env } from '../config/env.js';

const router = Router();

/** Blocks a soft-disabled module's API entirely (not just hidden in the UI). */
const moduleGate = (name) => (req, res, next) => {
  if (env.disabledModules.includes(name)) {
    return next(new ApiError(404, 'โมดูลนี้ยังไม่เปิดให้ใช้งาน'));
  }
  next();
};

router.get('/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

router.use('/auth', authRoutes);
router.use('/org', orgRoutes);

// Module 1: E-Memo & E-Signature
router.use('/projects', projectRoutes);
router.use('/documents', documentRoutes);
router.use('/approvals', approvalRoutes); // public (token-based) approval actions
router.use('/verify', verifyRoutes); // public (token-based) document authenticity check
router.use('/admin', adminRoutes); // admin-only: users + config

// Modules 2–4 are soft-disabled at launch (E-Memo + Admin only). The gate
// returns 404 for their APIs so a disabled module can't be driven directly.
// Module 2: Reporting & Analytics (daily work + OT)
router.use('/performance', moduleGate('performance'), performanceRoutes);
// Module 3: Credit Facility (financial — admin/executive only, guarded in-route)
router.use('/credit', moduleGate('credit'), creditRoutes);
// Module 4: Onboarding 90 days
router.use('/onboarding', moduleGate('onboarding'), onboardingRoutes);

export default router;
