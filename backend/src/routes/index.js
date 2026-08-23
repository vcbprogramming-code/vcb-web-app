import { Router } from 'express';
import authRoutes from './auth.routes.js';
import orgRoutes from './org.routes.js';
import projectRoutes from './projects.routes.js';
import documentRoutes from './documents.routes.js';
import verifyRoutes from './verify.routes.js';
import shareRoutes from './share.routes.js';
import adminRoutes from './admin.routes.js';
import performanceRoutes from './performance.routes.js';
import creditRoutes from './credit.routes.js';
import onboardingRoutes from './onboarding.routes.js';
import announcementRoutes from './announcements.routes.js';
import supportRoutes from './support.routes.js';
import sopRoutes from './sop.routes.js';
import sysmapRoutes from './sysmap.routes.js';
import meetingRoutes from './meetings.routes.js';
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
// NOTE: the public token-based /approvals routes were retired — approval is now
// login-gated in-app (email links go to /memos/:id). Removing the mount closes an
// unauthenticated mutation/download surface. Any pending step is still actionable
// via the in-app POST /documents/:id/approve. (approvals.routes.js kept for history.)
router.use('/verify', verifyRoutes); // public (token-based) document authenticity check
// public (token-based) read-only copy for สำเนาเรียน recipients without an account
router.use('/share', shareRoutes);
router.use('/admin', adminRoutes); // admin-only: users + config
router.use('/announcements', announcementRoutes); // portal notices (read: all, write: admin)
router.use('/support', supportRoutes); // portal "report an issue" → emails admins

// Modules 2–4 are soft-disabled at launch (E-Memo + Admin only). The gate
// returns 404 for their APIs so a disabled module can't be driven directly.
// Module 2: Reporting & Analytics (daily work + OT)
router.use('/performance', moduleGate('performance'), performanceRoutes);
// Module 3: Credit Facility (financial — admin/executive only, guarded in-route)
router.use('/credit', moduleGate('credit'), creditRoutes);
// Module 4: Onboarding 90 days
router.use('/onboarding', moduleGate('onboarding'), onboardingRoutes);
// Module 5: SOP (คู่มือปฏิบัติงาน) — reference content, gated like the rest
router.use('/sop', moduleGate('sop'), sopRoutes);
// แผนผังระบบ: how the group works, as data. Read by everyone, edited by admins.
router.use('/sysmap', moduleGate('sysmap'), sysmapRoutes);
// รายงานการประชุม: minutes per project, versioned
router.use('/meetings', moduleGate('meetings'), meetingRoutes);

export default router;
