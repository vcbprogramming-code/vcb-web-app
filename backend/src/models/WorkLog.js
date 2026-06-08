import mongoose from 'mongoose';

/**
 * One daily work-log cell (Module 2). One document per (employee, date).
 * Stored as a date-only string `ymd` ("2026-06-09") so day lookups are exact
 * regardless of timezone.
 *
 * operation (OP): team + workType (+ workTypeName snapshot) + otHours + reason
 * support  (SUP): detail (diary) + note
 * Either kind may mark the day as leave (ลา) or off (พัก/หยุด).
 */
const WorkLogSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    unitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true, index: true },
    ymd: { type: String, required: true }, // YYYY-MM-DD
    kind: { type: String, enum: ['operation', 'support'], required: true },

    // operation fields
    team: { type: String, default: null },
    workTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkType', default: null },
    workTypeName: { type: String, default: null }, // snapshot for display/export
    otHours: { type: Number, default: null },
    otRate: { type: Number, default: null },
    otAmount: { type: Number, default: null },
    reason: { type: String, default: null },

    // support fields
    detail: { type: String, default: null },
    note: { type: String, default: null },

    // day status: '' (worked) | 'leave' (ลา) | 'off' (พัก/วันหยุด)
    status: { type: String, enum: ['', 'leave', 'off'], default: '' },

    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', default: null },
  },
  { timestamps: true }
);

// one log per employee per day
WorkLogSchema.index({ employeeId: 1, ymd: 1 }, { unique: true });
// fast month/coverage scans by unit
WorkLogSchema.index({ unitId: 1, ymd: 1 });

export default mongoose.model('WorkLog', WorkLogSchema);
