import Redis from 'ioredis';


const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Create and export a Redis connection with the correct options for BullMQ
export const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // This is required by BullMQ
  enableReadyCheck: false,
  connectTimeout: 30000
}); 