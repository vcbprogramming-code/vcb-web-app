import { Router } from 'express';
import authRoutes from './auth.routes.js';
import orgRoutes from './org.routes.js';
import projectRoutes from './projects.routes.js';
import documentRoutes from './documents.routes.js';
import approvalRoutes from './approvals.routes.js';
import adminRoutes from './admin.routes.js';
import performanceRoutes from './performance.routes.js';
import creditRoutes from './credit.routes.js';
import onboardingRoutes from './onboarding.routes.js';

const router = Router();

router.get('/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

router.use('/auth', authRoutes);
router.use('/org', orgRoutes);

// Module 1: E-Memo & E-Signature
router.use('/projects', projectRoutes);
router.use('/documents', documentRoutes);
router.use('/approvals', approvalRoutes); // public (token-based) approval actions
router.use('/admin', adminRoutes); // admin-only: users + config

// Module 2: Reporting & Analytics (daily work + OT)
router.use('/performance', performanceRoutes);
// Module 3: Credit Facility (financial — admin/executive only, guarded in-route)
router.use('/credit', creditRoutes);
// Module 4: Onboarding 90 days
router.use('/onboarding', onboardingRoutes);

export default router;
