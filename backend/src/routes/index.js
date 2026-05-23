import { Router } from 'express';
import authRoutes from './auth.routes.js';
import orgRoutes from './org.routes.js';

const router = Router();

router.get('/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

router.use('/auth', authRoutes);
router.use('/org', orgRoutes);

// Module routes will be mounted here as they are built:
// router.use('/memos', memoRoutes);          // Module 1: E-Memo & E-Signature
// router.use('/performance', performanceRoutes); // Module 2: Reporting & Analytics
// router.use('/credit', creditRoutes);       // Module 3: Credit Facility
// router.use('/onboarding', onboardingRoutes); // Module 4: Onboarding 90 days

export default router;
