import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPulse } from './src/pulse.js';
import { getSnapshots } from './src/snapshots.js';
import { resurrect } from './src/resurrect.js';
import { getGraveyard } from './src/graveyard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

// --- Static files -----------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));

// --- Health -----------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// --- Route stubs (to be wired in T5/T6/T12) ---------------------------------
app.get('/api/pulse', async (req, res) => {
  const url = req.query.url;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing required parameter: url' });
  }
  const outcome = await checkPulse(url);
  if (!outcome.ok) {
    return res.status(400).json({ error: outcome.reason });
  }
  res.json(outcome.result);
});

app.get('/api/snapshots', async (req, res) => {
  const url = req.query.url;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing required parameter: url' });
  }
  const outcome = await getSnapshots(url);
  if (!outcome.ok) {
    const code = outcome.code ?? 502;
    return res.status(code).json({ error: outcome.reason });
  }
  res.json(outcome.result);
});

app.get('/api/resurrect', async (req, res) => {
  const url = req.query.url;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing required parameter: url' });
  }
  const ts = req.query.ts;
  const outcome = await resurrect(url, ts);
  if (!outcome.ok) {
    const code = outcome.code ?? 502;
    return res.status(code).json({ error: outcome.reason });
  }
  res.json(outcome.result);
});

// --- Graveyard demos ---
app.get('/api/graveyard', (req, res) => {
  res.json({ graves: getGraveyard() });
});

// --- 404 for unknown API routes ---------------------------------------------
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// --- Central error handler --------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message || err);
  res.status(500).json({ error: 'Internal server error' });
});

// --- Start ------------------------------------------------------------------
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Séance listening on port ${PORT}`);
  });
}

export default app;
