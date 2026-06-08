import mongoose from 'mongoose';

/** ประเภทเอกสาร — the document-type filter options. */
const DocumentTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model('DocumentType', DocumentTypeSchema);
