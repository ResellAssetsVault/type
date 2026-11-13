import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const here = path.dirname(fileURLToPath(import.meta.url));

// Load .env without a dependency.
const envFile = path.join(here, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
process.chdir(here);

const store = await import('./lib/store.js');
const { TOOLS } = await import('./lib/tools.js');
const fal = await import('./lib/providers/fal.js');
const mock = await import('./lib/providers/mock.js');
const provider = fal.configured() ? fal : mock;

const app = express();
app.use(express.json({ limit: '60mb' }));
app.use(express.static(path.join(here, 'public')));
app.use('/media', express.static(store.MEDIA_DIR, { maxAge: '1y', immutable: true }));

const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => res.status(400).json({ error: e.message }));

app.get('/api/status', (_req, res) => res.json({
  provider: provider.name,
  demo: provider === mock,
  imageModel: provider === fal ? fal.IMAGE_MODEL : null,
  videoModel: provider === fal ? fal.VIDEO_MODEL : null,
  tools: Object.fromEntries(Object.entries(TOOLS).map(([k, t]) => [k, t.label])),
}));

// ---- Models ---------------------------------------------------------------
app.get('/api/models', (_req, res) => res.json(store.table('models')));

app.post('/api/models', wrap((req, res) => {
  const { name, description = '', photos = [] } = req.body;
  if (!name?.trim()) throw new Error('Give the model a name');
  if (!photos.length) throw new Error('Add at least one reference photo');
  const saved = photos.slice(0, 6).map(store.saveDataUri);
  res.json(store.insert('models', { id: store.id(), name: name.trim(), description, photos: saved, headshot: saved[0], created_at: store.now() }));
}));

app.patch('/api/models/:id', wrap((req, res) => {
  const { name, description, headshot } = req.body;
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (description !== undefined) patch.description = description;
  if (headshot !== undefined) patch.headshot = headshot;
  const row = store.update('models', req.params.id, patch);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
}));

app.delete('/api/models/:id', wrap((req, res) => {
  const m = store.table('models').find((r) => r.id === req.params.id);
  if (!m) return res.status(404).json({ error: 'Not found' });
  m.photos.forEach(store.deleteMedia);
  store.remove('models', m.id);
  res.json({ ok: true });
}));

// ---- Wardrobe ---------------------------------------------------------------
const CATEGORIES = ['tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'accessories', 'sets', 'other'];

app.get('/api/wardrobe', (_req, res) => res.json(store.table('wardrobe')));

app.post('/api/wardrobe', wrap((req, res) => {
  const { name, category = 'other', notes = '', photo } = req.body;
  if (!name?.trim()) throw new Error('Give the item a name');
  if (!photo) throw new Error('Add a photo of the item');
  res.json(store.insert('wardrobe', {
    id: store.id(), name: name.trim(), category: CATEGORIES.includes(category) ? category : 'other',
    notes, image: store.saveDataUri(photo), created_at: store.now(),
  }));
}));

app.patch('/api/wardrobe/:id', wrap((req, res) => {
  const patch = Object.fromEntries(Object.entries(req.body).filter(([k]) => ['name', 'category', 'notes'].includes(k)));
  const row = store.update('wardrobe', req.params.id, patch);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
}));

app.delete('/api/wardrobe/:id', wrap((req, res) => {
  const w = store.table('wardrobe').find((r) => r.id === req.params.id);
  if (!w) return res.status(404).json({ error: 'Not found' });
  // Keep the photo if a generation still points at it.
  const used = store.table('generations').some((g) => g.inputs?.garment === w.image);
  if (!used) store.deleteMedia(w.image);
  store.remove('wardrobe', w.id);
  res.json({ ok: true });
}));

// ---- Generations ------------------------------------------------------------
app.get('/api/generations', (req, res) => {
  let rows = store.table('generations');
  if (req.query.model) rows = rows.filter((g) => g.model_id === req.query.model);
  if (req.query.kind) rows = rows.filter((g) => g.kind === req.query.kind);
  res.json(rows);
});

app.post('/api/generate', wrap((req, res) => {
  const { tool, modelId, ...params } = req.body;
  const t = TOOLS[tool];
  if (!t) throw new Error(`Unknown tool: ${tool}`);
  const model = store.table('models').find((m) => m.id === modelId);
  if (!model && tool !== 'image_to_video') throw new Error('Pick a model');

  const refs = model ? [model.headshot, ...model.photos.filter((p) => p !== model.headshot)].slice(0, 4).map(store.mediaToDataUri) : [];
  const resolved = { ...params };
  if (params.garment) resolved.garment = params.garment.startsWith('data:') ? params.garment : store.mediaToDataUri(params.garment);
  if (params.image) resolved.image = params.image.startsWith('data:') ? params.image : store.mediaToDataUri(params.image);
  // Keep uploaded inputs so the library can show what was used.
  const inputs = {};
  if (params.garment?.startsWith('data:')) inputs.garment = store.saveDataUri(params.garment);
  else if (params.garment) inputs.garment = params.garment;
  if (params.image?.startsWith('data:')) inputs.image = store.saveDataUri(params.image);
  else if (params.image) inputs.image = params.image;

  const jobs = t.build(resolved, refs);
  const group = store.id();
  const rows = jobs.map((job, i) => store.insert('generations', {
    id: store.id(),
    group_id: group,
    tool,
    tool_label: t.label,
    kind: job.kind,
    model_id: model?.id || null,
    prompt: params.prompt || '',
    params: { ...params, garment: undefined, image: undefined, slide: jobs.length > 1 ? i + 1 : undefined },
    inputs,
    status: 'queued',
    outputs: [],
    error: null,
    provider: provider.name,
    created_at: store.now(),
  }));
  rows.forEach((row, i) => run(row.id, jobs[i]));
  res.json(rows);
}));

app.delete('/api/generations/:id', wrap((req, res) => {
  const g = store.table('generations').find((r) => r.id === req.params.id);
  if (!g) return res.status(404).json({ error: 'Not found' });
  g.outputs.forEach((o) => store.deleteMedia(o.url));
  store.remove('generations', g.id);
  res.json({ ok: true });
}));

async function run(genId, job, existingHandle) {
  try {
    const handle = existingHandle || await provider.submit(job);
    // Store the fal request (not the inputs) so polling survives a restart.
    store.update('generations', genId, { status: 'processing', handle: handle.demo ? null : handle });
    const outs = await provider.wait(handle, {
      onStatus: (s) => store.update('generations', genId, { provider_status: s }),
    });
    const outputs = [];
    for (const o of outs) outputs.push({ url: await download(o.url, o.mime), mime: o.mime });
    store.update('generations', genId, { status: 'completed', outputs, completed_at: store.now(), handle: null });
  } catch (e) {
    console.error(`[generation ${genId}]`, e.message);
    store.update('generations', genId, { status: 'failed', error: e.message, handle: null });
  }
}

async function download(url, mime) {
  if (url.startsWith('data:')) {
    const [, b64] = url.split(',');
    return store.saveMedia(Buffer.from(b64, 'base64'), mime);
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not download result (${r.status})`);
  return store.saveMedia(Buffer.from(await r.arrayBuffer()), r.headers.get('content-type')?.split(';')[0] || mime);
}

// ---- Post planner -----------------------------------------------------------
app.get('/api/posts', (_req, res) => res.json([...store.table('posts')].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))));

app.post('/api/posts', wrap((req, res) => {
  const { model_id, media = [], caption = '', platforms = [], scheduled_at } = req.body;
  if (!media.length) throw new Error('Pick at least one image or video');
  if (!scheduled_at) throw new Error('Pick a date and time');
  res.json(store.insert('posts', { id: store.id(), model_id, media, caption, platforms, scheduled_at, status: 'planned', created_at: store.now() }));
}));

app.patch('/api/posts/:id', wrap((req, res) => {
  const allowed = ['caption', 'platforms', 'scheduled_at', 'status', 'media'];
  const patch = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  const row = store.update('posts', req.params.id, patch);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
}));

app.delete('/api/posts/:id', (req, res) => res.json({ ok: store.remove('posts', req.params.id) }));

// ---- Startup: resume or fail jobs interrupted by a restart -----------------
for (const g of store.table('generations')) {
  if (g.status !== 'queued' && g.status !== 'processing') continue;
  if (g.handle && provider === fal) run(g.id, null, g.handle);
  else store.update('generations', g.id, { status: 'failed', error: 'Interrupted by a restart' });
}

const port = Number(process.env.PORT) || 5173;
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Model Studio running at http://localhost:${port}`);
  console.log(provider === mock ? 'Demo mode: set FAL_KEY in .env to generate real images.' : `Using fal.ai (${fal.IMAGE_MODEL}, ${fal.VIDEO_MODEL})`);
});
server.on('error', (e) => {
  if (e.code !== 'EADDRINUSE') throw e;
  console.error(`\nPort ${port} is already in use: Model Studio (or another app) is probably still running in another Terminal window.`);
  console.error(`Stop it with Control + C in that window, or run:  lsof -ti tcp:${port} | xargs kill\n`);
  process.exit(1);
});
