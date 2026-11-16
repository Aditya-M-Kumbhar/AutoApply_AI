import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import redisManager from './src/config/redis.js';
import mongoose from 'mongoose';
import ApplicationSession from './src/models/ApplicationSession.js';

async function flush() {
  console.log('Connecting to Redis...');
  const connection = redisManager.getClient();
  
  console.log('Flushing all keys in Redis...');
  await connection.flushall();
  console.log('Redis flushed successfully.');
  
  // Clear database sessions that are active/running or stuck
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  const result = await ApplicationSession.updateMany(
    { status: { $in: ['running', 'paused_awaiting_submit', 'pending'] } },
    { $set: { status: 'failed', errorDetails: 'Queue flushed manually.' } }
  );
  console.log(`Updated ${result.modifiedCount} database sessions to failed.`);
  
  await mongoose.disconnect();
  await connection.quit();
  console.log('Done!');
  process.exit(0);
}

flush().catch(err => {
  console.error(err);
  process.exit(1);
});
