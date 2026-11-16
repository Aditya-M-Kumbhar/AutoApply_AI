import mongoose from 'mongoose';

const JobSchema = new mongoose.Schema({
    title: { type: String, required: true },
    company: { type: String, required: true },
    location: { type: String, default: 'Remote' },
    description: { type: String, required: true },
    skillsRequired: [{ type: String }],
    salaryRange: { type: String, default: 'Not Disclosed' },
    applyLink: { type: String, required: true },
    sourcePlatform: { type: String, default: 'Public Scrape' },
    postedAt: { type: Date, default: Date.now }
});

JobSchema.index({ title: 1, company: 1, location: 1 }, { unique: true });

const Job = mongoose.model('Job', JobSchema);
export default Job;
