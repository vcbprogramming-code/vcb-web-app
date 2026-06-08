import mongoose from 'mongoose';

/**
 * A reusable 30-60-90 onboarding task template item (Module 4).
 * `phase` is the milestone day (30/60/90). New-hire journeys are seeded from
 * the active templates.
 */
const OnboardingPlanTemplateSchema = new mongoose.Schema(
  {
    phase: { type: Number, enum: [30, 60, 90], default: 30, index: true },
    title: { type: String, required: true },
    description: { type: String, default: null },
    owner: { type: String, default: null }, // who's responsible (HR/หัวหน้างาน/พนักงาน)
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('OnboardingPlanTemplate', OnboardingPlanTemplateSchema);
