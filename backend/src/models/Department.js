import mongoose from 'mongoose';

/** แผนก — belongs to a unit. */
const DepartmentSchema = new mongoose.Schema(
  {
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true, index: true },
    name: { type: String, required: true },
  },
  { timestamps: true }
);

// no two departments with the same name under one unit
DepartmentSchema.index({ unitId: 1, name: 1 }, { unique: true });

export default mongoose.model('Department', DepartmentSchema);
