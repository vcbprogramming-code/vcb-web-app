import mongoose from 'mongoose';

/** หน่วยงาน — top-level business unit. */
const UnitSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, default: null },
  },
  { timestamps: true }
);

// code is optional but unique when present
UnitSchema.index({ code: 1 }, { unique: true, sparse: true });

export default mongoose.model('Unit', UnitSchema);
