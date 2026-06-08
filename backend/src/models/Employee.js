import mongoose from 'mongoose';

/** พนักงาน — staff record (HR master data). */
const EmployeeSchema = new mongoose.Schema(
  {
    employeeCode: { type: String, default: null },
    fullName: { type: String, required: true },
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', default: null, index: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
    positionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Position', default: null },
    email: { type: String, default: null },
    phone: { type: String, default: null },
    startDate: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

EmployeeSchema.index({ employeeCode: 1 }, { unique: true, sparse: true });

export default mongoose.model('Employee', EmployeeSchema);
