import { createApp } from './app.js';
import { env } from './config/env.js';
import { ensureBucket } from './config/storage.js';

const app = createApp();

app.listen(env.port, async () => {
  console.log(`🚀 HR System API listening on http://localhost:${env.port} (${env.nodeEnv})`);
  try {
    await ensureBucket();
    console.log(`📦 Storage bucket "${env.s3.bucket}" ready`);
  } catch (err) {
    console.error('⚠️  Could not ensure storage bucket:', err.message);
  }
});
