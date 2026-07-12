import { createApp } from './app.js';
import { env } from './config/env.js';
import { ensureBucket } from './config/storage.js';
import { runMigrations } from './config/migrate.js';

const app = createApp();

async function boot() {
  // Apply pending DB migrations BEFORE serving traffic, so a deploy can never run
  // new code against an old schema (Render's build-time migrate proved unreliable).
  // Best-effort: on failure we log and still start, so the service isn't bricked.
  try {
    await runMigrations();
  } catch (err) {
    console.error('⚠️  auto-migrate failed on boot (run `npm run migrate` manually):', err.message);
  }
  app.listen(env.port, async () => {
    console.log(`🚀 HR System API listening on http://localhost:${env.port} (${env.nodeEnv})`);
    try {
      await ensureBucket();
      console.log(`📦 Storage bucket "${env.s3.bucket}" ready`);
    } catch (err) {
      console.error('⚠️  Could not ensure storage bucket (it may already exist):', err.message);
    }
  });
}

boot();
