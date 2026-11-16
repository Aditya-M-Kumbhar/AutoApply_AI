import jwt from 'jsonwebtoken';
import logger from '../config/logger.js';

export const protect = async (req, res, next) => {
  let token;

  // 1. Extract from HTTP-Only cookie
  if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }
  // 2. Fallback to Authorization Header Bearer token
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      status: 'error',
      code: 'UNAUTHORIZED',
      message: 'Access denied. No access token provided.'
    });
  }

  try {
    const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
    if (!JWT_ACCESS_SECRET) {
      logger.error('CRITICAL ENV CONFIG ERROR: JWT_ACCESS_SECRET is not defined.');
      return res.status(500).json({
        status: 'error',
        code: 'CONFIG_ERROR',
        message: 'Internal configuration error.'
      });
    }

    const decoded = jwt.verify(token, JWT_ACCESS_SECRET);
    
    // Bind token payload data to request user structure
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (error) {
    logger.warn(`JWT verification failure: ${error.message}`);
    return res.status(401).json({
      status: 'error',
      code: 'INVALID_TOKEN',
      message: 'Access token is invalid or has expired.'
    });
  }
};

// Strict role barrier checker middleware generator
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: 'Authentication required.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        code: 'FORBIDDEN',
        message: `Forbidden: User role '${req.user.role}' is not authorized to access this resource.`
      });
    }

    next();
  };
};
