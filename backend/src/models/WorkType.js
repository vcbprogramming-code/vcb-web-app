import mongoose from 'mongoose';

/**
 * Master index of work types for the operation daily log (Module 2).
 * The work-type picker is searchable and grouped by category.
 */
const WorkTypeSchema = new mongoose.Schema(
  {
    code: { type: String },
    name: { type: String, required: true },
    description: { type: String, default: null },
    category: { type: String, default: 'ทั่วไป', index: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// unique only among documents that actually have a code (string)
WorkTypeSchema.index(
  { code: 1 },
  { unique: true, partialFilterExpression: { code: { $type: 'string' } } }
);

export default mongoose.model('WorkType', WorkTypeSchema);
