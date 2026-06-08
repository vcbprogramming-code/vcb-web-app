import mongoose from 'mongoose';

/** ตำแหน่ง — job title, optionally under a department. */
const PositionSchema = new mongoose.Schema(
  {
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    name: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model('Position', PositionSchema);
