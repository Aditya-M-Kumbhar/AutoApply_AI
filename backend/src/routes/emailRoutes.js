import express from 'express';
import { generateColdEmail, personalizeWithAI } from '../services/emailService.js';
import Job from '../models/Job.js';
import User from '../models/User.js';
import { protect } from '../middlewares/authMiddleware.js';
import { asyncHandler } from '../middlewares/errorMiddleware.js';

const router = express.Router();

// POST /api/email/generate - generate cold email programmatically
router.post('/generate', protect, asyncHandler(async (req, res) => {
    const { templateId, jobId } = req.body;
    
    if (!jobId) {
        return res.status(400).json({ status: 'error', message: 'jobId is required.' });
    }
    
    const job = await Job.findById(jobId);
    if (!job) {
        return res.status(404).json({ status: 'error', message: 'Job listing not found.' });
    }
    
    const user = await User.findById(req.user.id);
    if (!user) {
        return res.status(404).json({ status: 'error', message: 'User profile not found.' });
    }
    
    const emailData = await generateColdEmail(templateId, user, job);
    
    res.status(200).json({ status: 'success', data: emailData });
}));

// POST /api/email/personalize - personalize with AI
router.post('/personalize', protect, asyncHandler(async (req, res) => {
    const { emailBody, toneInstruction } = req.body;
    
    if (!emailBody || !toneInstruction) {
        return res.status(400).json({ status: 'error', message: 'emailBody and toneInstruction are required.' });
    }
    
    try {
        const personalizedBody = await personalizeWithAI(emailBody, toneInstruction);
        res.status(200).json({ status: 'success', data: { body: personalizedBody } });
    } catch (err) {
        res.status(500).json({ status: 'error', message: `AI Personalization failed: ${err.message}` });
    }
}));

export default router;
