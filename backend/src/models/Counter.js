import mongoose from 'mongoose';

/**
 * Atomic per-project running-number counter. `_id` is the project id (string).
 * Allocation uses findByIdAndUpdate({$inc:{seq:1}}, {upsert:true}) — atomic at
 * the database level, replacing the Postgres SELECT ... FOR UPDATE approach.
 */
const CounterSchema = new mongoose.Schema(
  {
    _id: { type: String }, // projectId as string
    seq: { type: Number, default: 0 },
  },
  { _id: false }
);

export default mongoose.model('Counter', CounterSchema);
