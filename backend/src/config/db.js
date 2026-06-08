import mongoose from 'mongoose';
import { env } from './env.js';

/**
 * Connect to MongoDB Atlas via Mongoose. A single shared connection serves the
 * whole API (Mongoose pools internally). Call once at startup.
 */
export async function connectDb() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri);
  return mongoose.connection;
}

export { mongoose };
