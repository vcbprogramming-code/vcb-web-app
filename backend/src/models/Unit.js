import mongoose from 'mongoose';

/** หน่วยงาน — top-level business unit. */
const UnitSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String },
    // Module 2: company that owns the site + UI accent color + backdate lock window
    company: { type: String, default: null },
    color: { type: String, default: null },
    lockDays: { type: Number, default: 3 },
  },
  { timestamps: true }
);

// code is optional but unique when present (string)
UnitSchema.index(
  { code: 1 },
  { unique: true, partialFilterExpression: { code: { $type: 'string' } } }
);

export default mongoose.model('Unit', UnitSchema);
