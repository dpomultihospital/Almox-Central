import express from 'express';
import { initDatabase } from '../src/server/db.ts';
import { apiRouter } from '../src/server/routes.ts';

const app = express();

let isDbInitialized = false;

function ensureDbInitialized() {
  if (!isDbInitialized) {
    try {
      initDatabase();
      isDbInitialized = true;
    } catch (err) {
      console.error('[Vercel API] Erro na inicialização do banco SQLite:', err);
    }
  }
}

app.use(express.json({ limit: '10mb' }));

app.use((_req, _res, next) => {
  ensureDbInitialized();
  next();
});

// Suporta requisições roteadas como /api/* ou diretamente /* pela função Serverless da Vercel
app.use('/api', apiRouter);
app.use('/', apiRouter);

export default app;
