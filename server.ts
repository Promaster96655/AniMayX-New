import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { createApiRouter } from './server/routes.ts';
import { initFirebaseAdmin } from './server/firebaseAdmin.ts';
import { startSyncScheduler } from './server/syncService.ts';

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

async function bootstrapServer() {
  initFirebaseAdmin();

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', createApiRouter());

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir, { index: false }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AniMayX] Server running on http://0.0.0.0:${PORT} (${isProduction ? 'production' : 'development'})`);
    startSyncScheduler();
  });
}

bootstrapServer().catch((err) => {
  console.error('[AniMayX] Fatal server startup error:', err);
  process.exit(1);
});
