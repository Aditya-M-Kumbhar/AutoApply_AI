import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import User from '../models/User.js';
import redisManager from '../config/redis.js';
import logger from '../config/logger.js';
import { asyncHandler } from '../middlewares/errorMiddleware.js';

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const generateTokens = (user) => {
  const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
  const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

  if (!JWT_ACCESS_SECRET || !JWT_REFRESH_SECRET) {
    throw new Error('CRITICAL CONFIG ERROR: JWT secrets are missing.');
  }

  const accessToken = jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    JWT_ACCESS_SECRET,
    { expiresIn: '7d' }
  );

  const refreshToken = jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/'
};

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

export const register = asyncHandler(async (req, res) => {
  // Validate and sanitize data
  const data = registerSchema.parse(req.body);

  const existingUser = await User.findOne({ email: data.email });
  if (existingUser) {
    return res.status(409).json({
      status: 'error',
      code: 'DUPLICATE_EMAIL',
      message: 'A candidate with this email address already exists.'
    });
  }

  const user = await User.create({
    name: data.name,
    email: data.email,
    password: data.password,
    role: 'organiser', // Default to organiser as requested
    profileVault: {
      skills: [],
      experience: [],
      contactDetails: {},
      resumePath: ''
    }
  });

  const { accessToken, refreshToken } = generateTokens(user);
  const refreshTokenHash = hashToken(refreshToken);

  // Store in Redis (TTL: 7 days = 604800 seconds)
  const redisClient = redisManager.getClient();
  await redisClient.setex(`active_session:${user._id}:${refreshTokenHash}`, 604800, 'active');

  res.cookie('accessToken', accessToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

  res.status(201).json({
    status: 'success',
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    }
  });
});

export const login = asyncHandler(async (req, res) => {
  const data = loginSchema.parse(req.body);

  const user = await User.findOne({ email: data.email });
  if (!user || !(await user.comparePassword(data.password))) {
    return res.status(401).json({
      status: 'error',
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password.'
    });
  }

  const { accessToken, refreshToken } = generateTokens(user);
  const refreshTokenHash = hashToken(refreshToken);

  // Store active session token hash in Redis
  const redisClient = redisManager.getClient();
  await redisClient.setex(`active_session:${user._id}:${refreshTokenHash}`, 604800, 'active');

  res.cookie('accessToken', accessToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

  res.status(200).json({
    status: 'success',
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    }
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) {
    return res.status(401).json({
      status: 'error',
      code: 'MISSING_REFRESH_TOKEN',
      message: 'Refresh token is required.'
    });
  }

  const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
  if (!JWT_REFRESH_SECRET) {
    logger.error('CRITICAL ENV CONFIG ERROR: JWT_REFRESH_SECRET is not defined.');
    return res.status(500).json({
      status: 'error',
      code: 'CONFIG_ERROR',
      message: 'Internal configuration error.'
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (error) {
    logger.warn(`JWT Refresh Token signature verification failed: ${error.message}`);
    return res.status(401).json({
      status: 'error',
      code: 'INVALID_REFRESH_TOKEN',
      message: 'Refresh token is invalid or has expired.'
    });
  }

  const redisClient = redisManager.getClient();
  const tokenHash = hashToken(token);
  const sessionKey = `active_session:${decoded.id}:${tokenHash}`;

  const isActive = await redisClient.get(sessionKey);

  // REUSE DETECTION (Cookie Theft/Hijacking Protection)
  if (!isActive) {
    logger.error(`POTENTIAL COOKIE HIJACK ATTEMPT DETECTED! Re-used refresh token family for userId: ${decoded.id}`);
    
    // Revoke all sessions belonging to the user family
    const userSessionKeys = await redisClient.keys(`active_session:${decoded.id}:*`);
    if (userSessionKeys.length > 0) {
      await redisClient.del(userSessionKeys);
      logger.info(`Revoked all ${userSessionKeys.length} active sessions for userId: ${decoded.id}`);
    }

    // Clear client cookies
    res.clearCookie('accessToken', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);

    return res.status(403).json({
      status: 'error',
      code: 'SESSION_REVOKED',
      message: 'Breach detected. Session revoked. Please log in again.'
    });
  }

  // If active, rotate it: Delete the old token session to prevent double refresh
  await redisClient.del(sessionKey);

  // Retrieve user to make sure user still exists and role hasn't changed
  const user = await User.findById(decoded.id);
  if (!user) {
    return res.status(401).json({
      status: 'error',
      code: 'USER_NOT_FOUND',
      message: 'The user session no longer exists.'
    });
  }

  // Issue new tokens
  const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(user);
  const newRefreshTokenHash = hashToken(newRefreshToken);

  // Register new token session in Redis
  await redisClient.setex(`active_session:${user._id}:${newRefreshTokenHash}`, 604800, 'active');

  res.cookie('accessToken', newAccessToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
  res.cookie('refreshToken', newRefreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

  res.status(200).json({
    status: 'success',
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    }
  });
});

export const logout = asyncHandler(async (req, res) => {
  const token = req.cookies.refreshToken;
  if (token) {
    const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
    try {
      const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
      const tokenHash = hashToken(token);
      const redisClient = redisManager.getClient();
      await redisClient.del(`active_session:${decoded.id}:${tokenHash}`);
      logger.info(`Session cleared from Redis for user: ${decoded.id}`);
    } catch (error) {
      logger.warn(`Failed to cleanly delete Redis session during logout: ${error.message}`);
    }
  }

  res.clearCookie('accessToken', cookieOptions);
  res.clearCookie('refreshToken', cookieOptions);

  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully.'
  });
});
