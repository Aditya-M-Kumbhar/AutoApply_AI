import redisManager from '../../../config/redis.js';
import logger from '../../../config/logger.js';

export const registerSocketHandlers = (io, socket) => {
  socket.on('abort_session', async ({ sessionId }) => {
    logger.warn(`[Socket] Received abort_session request for session ID: ${sessionId}`);
    
    if (!sessionId) {
      logger.error('[Socket] Cannot abort session: sessionId is undefined.');
      return;
    }

    try {
      const redis = redisManager.getClient();
      // Set circuit breaker abort flag with 5 minutes (300 seconds) expiration time
      await redis.set(`session:${sessionId}:abort`, 'true', 'EX', 300);
      logger.info(`[Socket] Time-restricted abort flag written to Redis for session: ${sessionId}`);

      // Broadcast aborted status to the session's socket room
      const room = `session:${sessionId}`;
      io.to(room).emit('status', {
        status: 'aborted',
        message: 'Session scan aborted by candidate.'
      });
      io.to(room).emit(`${room}:status`, {
        status: 'aborted',
        message: 'Session scan aborted by candidate.'
      });
    } catch (err) {
      logger.error(`[Socket] Failed to set abort session flag in Redis: ${err.message}`);
    }
  });
};
