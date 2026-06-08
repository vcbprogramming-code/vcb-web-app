import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDb } from './config/db.js';
import { syncIndexes } from './models/index.js';

async function start() {
  await connectDb();
  console.log('🗄️  Connected to MongoDB');
  await syncIndexes();
  console.log('🔑 Indexes ready');

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`🚀 HR System API listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });
}

start().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
