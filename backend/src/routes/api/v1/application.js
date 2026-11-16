import express from 'express';
import { z } from 'zod';
import { protect } from '../../../middlewares/authMiddleware.js';
import ApplicationSession from '../../../models/ApplicationSession.js';
import JobListing from '../../../models/JobListing.js';
import { addApplicationJob, addCrawlJob } from '../../../queues/applicationQueue.js';
import { confirmSubmission, cancelSubmission } from '../../../services/playwrightService.js';
import { asyncHandler } from '../../../middlewares/errorMiddleware.js';

const router = express.Router();

const applySchema = z.object({
  jobListingId: z.string().trim().min(1, 'jobListingId is required')
});

const crawlSchema = z.object({
  url: z.string().trim().url('Invalid URL format'),
  maxPages: z.number().int().min(1).default(3).optional(),
  sessionId: z.string().trim().optional()
});

// Retrieve all scraped job listings and sessions
router.get('/listings', protect, asyncHandler(async (req, res) => {
  const listings = await JobListing.find().sort({ createdAt: -1 });
  const sessions = await ApplicationSession.find({ userId: req.user.id })
    .populate('jobListingId')
    .sort({ createdAt: -1 });
  
  res.status(200).json({
    status: 'success',
    data: {
      listings,
      sessions
    }
  });
}));

// Trigger crawler scraping job to extract listing details
router.post('/crawl', protect, asyncHandler(async (req, res) => {
  const { url, maxPages, sessionId } = crawlSchema.parse(req.body);

  // Push crawling task into BullMQ with maxPages and sessionId
  const jobId = await addCrawlJob(req.user.id, url, maxPages, sessionId);

  res.status(202).json({
    status: 'success',
    message: 'Scraping and crawl task successfully queued.',
    data: {
      jobId
    }
  });
}));

// Trigger automated form-filling job
router.post('/apply', protect, asyncHandler(async (req, res) => {
  const { jobListingId } = applySchema.parse(req.body);

  const jobListing = await JobListing.findById(jobListingId);
  if (!jobListing) {
    return res.status(404).json({
      status: 'error',
      code: 'JOB_NOT_FOUND',
      message: 'The requested job listing does not exist.'
    });
  }

  // Pre-create ApplicationSession record to register tracking immediately
  const session = await ApplicationSession.create({
    userId: req.user.id,
    jobListingId: jobListing._id,
    status: 'pending',
    currentStep: 'initialized',
    realTimeLogs: [{ message: 'Auto-apply session initialized.' }]
  });

  // Enqueue job to BullMQ
  const bullMQJobId = await addApplicationJob(req.user.id, jobListing._id, session._id);
  
  // Link the BullMQ Job ID to the session record
  session.bullMQJobId = bullMQJobId;
  await session.save();

  res.status(202).json({
    status: 'success',
    message: 'Application job successfully queued.',
    data: {
      sessionId: session._id,
      bullMQJobId
    }
  });
}));

// User manually approves form validation to trigger final submit click
router.post('/:sessionId/confirm', protect, asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  const session = await ApplicationSession.findById(sessionId);
  if (!session) {
    return res.status(404).json({
      status: 'error',
      code: 'SESSION_NOT_FOUND',
      message: 'Application session not found.'
    });
  }

  if (session.userId.toString() !== req.user.id) {
    return res.status(403).json({
      status: 'error',
      code: 'FORBIDDEN',
      message: 'You are not authorized to confirm this application.'
    });
  }

  const success = confirmSubmission(sessionId);
  if (!success) {
    return res.status(400).json({
      status: 'error',
      code: 'CONFIRM_FAILED',
      message: 'Session is not currently awaiting manual confirmation.'
    });
  }

  res.status(200).json({
    status: 'success',
    message: 'Manual confirmation accepted. Proceeding to submit.'
  });
}));

// User cancels application on final review stage
router.post('/:sessionId/cancel', protect, asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  const session = await ApplicationSession.findById(sessionId);
  if (!session) {
    return res.status(404).json({
      status: 'error',
      code: 'SESSION_NOT_FOUND',
      message: 'Application session not found.'
    });
  }

  if (session.userId.toString() !== req.user.id) {
    return res.status(403).json({
      status: 'error',
      code: 'FORBIDDEN',
      message: 'You are not authorized to cancel this application.'
    });
  }

  const success = cancelSubmission(sessionId);
  if (!success) {
    return res.status(400).json({
      status: 'error',
      code: 'CANCEL_FAILED',
      message: 'Session is not currently awaiting manual confirmation.'
    });
  }

  res.status(200).json({
    status: 'success',
    message: 'Manual application cancelled.'
  });
}));

// Query session metrics, logs, and screenshots
router.get('/:sessionId/status', protect, asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  const session = await ApplicationSession.findById(sessionId).populate('jobListingId');
  if (!session) {
    return res.status(404).json({
      status: 'error',
      code: 'SESSION_NOT_FOUND',
      message: 'Application session not found.'
    });
  }

  if (session.userId.toString() !== req.user.id) {
    return res.status(403).json({
      status: 'error',
      code: 'FORBIDDEN',
      message: 'You are not authorized to access this session.'
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      session
    }
  });
}));

export default router;
