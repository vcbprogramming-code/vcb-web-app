import { Router } from 'express';
import authRoutes from './auth.routes.js';
import orgRoutes from './org.routes.js';
import projectRoutes from './projects.routes.js';
import documentRoutes from './documents.routes.js';
import approvalRoutes from './approvals.routes.js';
import adminRoutes from './admin.routes.js';

const router = Router();

router.get('/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

router.use('/auth', authRoutes);
router.use('/org', orgRoutes);

// Module 1: E-Memo & E-Signature
router.use('/projects', projectRoutes);
router.use('/documents', documentRoutes);
router.use('/approvals', approvalRoutes); // public (token-based) approval actions
router.use('/admin', adminRoutes); // admin-only: users + config

// Module routes still to be built:
// router.use('/performance', performanceRoutes); // Module 2: Reporting & Analytics
// router.use('/credit', creditRoutes);       // Module 3: Credit Facility
// router.use('/onboarding', onboardingRoutes); // Module 4: Onboarding 90 days

export default router;
