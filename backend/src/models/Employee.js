import mongoose from 'mongoose';

export const EMPLOYEE_KINDS = ['operation', 'support'];

/** พนักงาน — staff record (HR master data). */
const EmployeeSchema = new mongoose.Schema(
  {
    employeeCode: { type: String },
    fullName: { type: String, required: true },
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', default: null, index: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
    positionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Position', default: null },
    // Module 2: operation (OP, has OT + team) vs support (SUP, daily diary)
    kind: { type: String, enum: EMPLOYEE_KINDS, default: 'operation', index: true },
    // free-text role/position label used in the daily log (operation employees)
    team: { type: String, default: null },
    email: { type: String, default: null },
    phone: { type: String, default: null },
    startDate: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

EmployeeSchema.index(
  { employeeCode: 1 },
  { unique: true, partialFilterExpression: { employeeCode: { $type: 'string' } } }
);

export default mongoose.model('Employee', EmployeeSchema);
