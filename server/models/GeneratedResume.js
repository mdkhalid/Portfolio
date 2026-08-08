const mongoose = require('mongoose');

const generatedResumeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', default: null },
    content: { type: String, default: '' },
    pdf: { type: Buffer, select: false, default: null },
    pdfFilename: { type: String, default: '' },
    coverLetter: { type: String, default: '' },
    baseTemplateId: { type: String, default: '' },
    jdUsed: { type: String, default: '' },
    keywordsMatched: [{ type: String, maxlength: 100 }],
    costBucket: { type: String, default: '' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

generatedResumeSchema.index({ userId: 1, deletedAt: 1 });
generatedResumeSchema.index({ applicationId: 1 });

module.exports = mongoose.model('GeneratedResume', generatedResumeSchema);
