import express from 'express';
import redisManager from '../config/redis.js';
import Job from '../models/Job.js';
import User from '../models/User.js';
import { protect } from '../middlewares/authMiddleware.js';
import { asyncHandler } from '../middlewares/errorMiddleware.js';
import logger from '../config/logger.js';

const router = express.Router();

// GET /api/market/trending-skills
router.get('/trending-skills', protect, asyncHandler(async (req, res) => {
    const cacheKey = 'market:trending-skills';
    const redis = redisManager.getClient();
    
    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            logger.info('Trending skills retrieved from Redis cache.');
            return res.status(200).json({ status: 'success', data: JSON.parse(cached) });
        }
    } catch (err) {
        logger.warn(`Redis get failed: ${err.message}`);
    }
    
    const pipeline = [
        { $unwind: '$skillsRequired' },
        { $group: { _id: '$skillsRequired', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 }
    ];
    
    const result = await Job.aggregate(pipeline);
    
    try {
        await redis.set(cacheKey, JSON.stringify(result), 'EX', 21600); // 6 hours
    } catch (err) {
        logger.warn(`Redis set failed: ${err.message}`);
    }
    
    res.status(200).json({ status: 'success', data: result });
}));

// GET /api/market/trending-roles
router.get('/trending-roles', protect, asyncHandler(async (req, res) => {
    const cacheKey = 'market:trending-roles';
    const redis = redisManager.getClient();
    
    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            logger.info('Trending roles retrieved from Redis cache.');
            return res.status(200).json({ status: 'success', data: JSON.parse(cached) });
        }
    } catch (err) {
        logger.warn(`Redis get failed: ${err.message}`);
    }
    
    const pipeline = [
        { $group: { _id: '$title', count: { $sum: 1 }, avgSalary: { $first: '$salaryRange' } } },
        { $sort: { count: -1 } },
        { $limit: 15 }
    ];
    
    const result = await Job.aggregate(pipeline);
    
    try {
        await redis.set(cacheKey, JSON.stringify(result), 'EX', 21600); // 6 hours
    } catch (err) {
        logger.warn(`Redis set failed: ${err.message}`);
    }
    
    res.status(200).json({ status: 'success', data: result });
}));

// GET /api/market/source-breakdown
router.get('/source-breakdown', protect, asyncHandler(async (req, res) => {
    const cacheKey = 'market:source-breakdown';
    const redis = redisManager.getClient();
    
    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            logger.info('Source breakdown retrieved from Redis cache.');
            return res.status(200).json({ status: 'success', data: JSON.parse(cached) });
        }
    } catch (err) {
        logger.warn(`Redis get failed: ${err.message}`);
    }
    
    const pipeline = [
        { $group: { _id: '$sourcePlatform', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ];
    
    const result = await Job.aggregate(pipeline);
    
    try {
        await redis.set(cacheKey, JSON.stringify(result), 'EX', 21600); // 6 hours
    } catch (err) {
        logger.warn(`Redis set failed: ${err.message}`);
    }
    
    res.status(200).json({ status: 'success', data: result });
}));

// GET /api/market/jobs-by-skill?skill=react
router.get('/jobs-by-skill', protect, asyncHandler(async (req, res) => {
    const { skill } = req.query;
    if (!skill) {
        return res.status(400).json({ status: 'error', message: 'skill parameter is required.' });
    }
    const cacheKey = `jobs:skill:${skill.toLowerCase()}:${req.user?.id || 'public'}`;
    const redis = redisManager.getClient();
    
    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            return res.json(JSON.parse(cached));
        }
    } catch (err) {
        logger.warn(`Redis get failed: ${err.message}`);
    }
    
    const rawJobs = await Job.find({ skillsRequired: skill.toLowerCase() })
                          .select('title company location description applyLink')
                          .limit(50);
                          
    const user = req.user ? await User.findById(req.user.id) : null;
    const userSkills = user?.skills || user?.profileVault?.skills || [];
    
    const { computeTFIDF } = await import('../utils/matchingEngine.js');
    const jobs = rawJobs.map(j => {
        const obj = j.toObject();
        obj.fitScore = computeTFIDF(userSkills, obj.description || '');
        return {
            _id: obj._id,
            title: obj.title,
            company: obj.company,
            location: obj.location,
            fitScore: obj.fitScore,
            applyLink: obj.applyLink
        };
    });
    
    try {
        await redis.set(cacheKey, JSON.stringify(jobs), 'EX', 21600);
    } catch (err) {
        logger.warn(`Redis set failed: ${err.message}`);
    }
    
    res.json(jobs);
}));

export default router;
