import express from 'express';
import Application from '../models/Application.js';
import Job from '../models/Job.js';
import { protect } from '../middlewares/authMiddleware.js';
import { asyncHandler } from '../middlewares/errorMiddleware.js';
import mongoose from 'mongoose';

const router = express.Router();

// POST /api/applications - create new application entry
router.post('/', protect, asyncHandler(async (req, res) => {
    const { jobId, status, notes } = req.body;
    
    if (!jobId) {
        return res.status(400).json({ status: 'error', message: 'jobId is required.' });
    }
    
    // Verify job exists
    const job = await Job.findById(jobId);
    if (!job) {
        return res.status(404).json({ status: 'error', message: 'Job not found.' });
    }
    
    // Check if application already exists for this job
    const existing = await Application.findOne({ userId: req.user.id, jobId });
    if (existing) {
        return res.status(400).json({ status: 'error', message: 'You are already tracking this job application.' });
    }
    
    const application = await Application.create({
        userId: req.user.id,
        jobId,
        status: status || 'Applied',
        notes: notes || '',
        appliedAt: new Date(),
        updatedAt: new Date()
    });
    
    res.status(201).json({ status: 'success', data: application });
}));

// GET /api/applications/:userId - get all applications for a user with populated job details
router.get('/:userId', protect, asyncHandler(async (req, res) => {
    const { userId } = req.params;
    
    // Defuse invalid user ID cast error
    if (!userId || userId === 'undefined' || userId === 'null' || !req.user || !req.user.id || req.user.id === 'undefined' || req.user.id === 'null') {
        return res.status(401).json({ status: 'error', message: 'Unauthenticated / Invalid User context.' });
    }
    
    // Authorization check
    if (userId !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ status: 'error', message: 'Unauthorized access to user applications.' });
    }
    
    const applications = await Application.find({ userId })
        .populate('jobId')
        .sort({ updatedAt: -1 });
        
    res.status(200).json({ status: 'success', data: applications });
}));

// PATCH /api/applications/:id/status - update status with one click
router.patch('/:id/status', protect, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, notes } = req.body;
    
    const application = await Application.findById(id);
    if (!application) {
        return res.status(404).json({ status: 'error', message: 'Application tracker entry not found.' });
    }
    
    // Ownership check
    if (application.userId.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ status: 'error', message: 'Unauthorized to modify this application.' });
    }
    
    if (status) {
        const allowedStatuses = ['Applied', 'Screening', 'Interviewing', 'Offer', 'Rejected'];
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ status: 'error', message: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` });
        }
        application.status = status;
    }
    
    if (notes !== undefined) {
        application.notes = notes;
    }
    
    application.updatedAt = new Date();
    await application.save();
    
    // Return populated application
    const populated = await Application.findById(application._id).populate('jobId');
    
    res.status(200).json({ status: 'success', data: populated });
}));

// DELETE /api/applications/:id - delete application entry
router.delete('/:id', protect, asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const application = await Application.findById(id);
    if (!application) {
        return res.status(404).json({ status: 'error', message: 'Application tracker entry not found.' });
    }
    
    if (application.userId.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ status: 'error', message: 'Unauthorized to delete this application.' });
    }
    
    await Application.findByIdAndDelete(id);
    
    res.status(200).json({ status: 'success', message: 'Application deleted successfully.' });
}));

export default router;
