import mongoose from 'mongoose';

/**
 * Doc-code → department mapping. The code (e.g. '02B') is the primary key.
 *   department      — SHORT token that goes INSIDE the doc number (BT/วิศวะ/02B/069)
 *   recipientTitle  — full title of the addressee, for "เรียน"
 */
const DocCodeDepartmentSchema = new mongoose.Schema(
  {
    _id: { type: String }, // the doc code itself
    department: { type: String, required: true },
    recipientTitle: { type: String, default: null },
  },
  { _id: false } // we set _id explicitly (the code)
);

export default mongoose.model('DocCodeDepartment', DocCodeDepartmentSchema);
