import mongoose from 'mongoose';

const ApplicationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    status: { type: String, enum: ['Applied', 'Screening', 'Interviewing', 'Offer', 'Rejected'], default: 'Applied' },
    appliedAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    notes: { type: String, default: '' }
});

const Application = mongoose.model('Application', ApplicationSchema);
export default Application;
