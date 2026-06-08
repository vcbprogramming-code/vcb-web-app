import mongoose from 'mongoose';

/** One 30-60-90 task instance for a specific new hire (embedded). */
const JourneyTaskSchema = new mongoose.Schema(
  {
    phase: { type: Number, enum: [30, 60, 90], default: 30 },
    title: { type: String, required: true },
    description: { type: String, default: null },
    owner: { type: String, default: null },
    done: { type: Boolean, default: false },
    doneAt: { type: Date, default: null },
  },
  { _id: true }
);

/** Probation review (embedded) — filled by supervisor/HR at the end. */
const ProbationReviewSchema = new mongoose.Schema(
  {
    reviewer: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    // criterion → score (1-5)
    scores: { type: mongoose.Schema.Types.Mixed, default: null },
    strengths: { type: String, default: null },
    improvements: { type: String, default: null },
    // 'pass' | 'extend' | 'fail' | null (not yet decided)
    result: { type: String, enum: ['pass', 'extend', 'fail', null], default: null },
    note: { type: String, default: null },
  },
  { _id: false }
);

/**
 * A new hire's 90-day onboarding journey (Module 4) — the aggregate root.
 * Tasks (seeded from templates) and the probation review are embedded.
 */
const NewHireJourneySchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    employeeCode: { type: String, default: null },
    position: { type: String, default: null },
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', default: null, index: true },
    email: { type: String, default: null },
    phone: { type: String, default: null },
    startDate: { type: Date, required: true },
    // 'active' | 'completed' | 'left'
    status: { type: String, enum: ['active', 'completed', 'left'], default: 'active', index: true },
    tasks: [JourneyTaskSchema],
    review: { type: ProbationReviewSchema, default: () => ({}) },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', default: null },
  },
  { timestamps: true }
);

export default mongoose.model('NewHireJourney', NewHireJourneySchema);
