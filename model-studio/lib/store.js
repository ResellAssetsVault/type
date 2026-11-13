// Tiny JSON-file database plus a media folder. No native dependencies.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const DATA_DIR = path.resolve(process.env.DATA_DIR || 'data');
export const MEDIA_DIR = path.join(DATA_DIR, 'media');
const DB_FILE = path.join(DATA_DIR, 'db.json');

fs.mkdirSync(MEDIA_DIR, { recursive: true });

const empty = { models: [], generations: [], posts: [] };
let db = fs.existsSync(DB_FILE) ? { ...empty, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) } : structuredClone(empty);

let saveTimer = null;
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, DB_FILE);
  }, 50);
}

export const id = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const table = (name) => db[name];

export function insert(name, row) {
  db[name].unshift(row);
  save();
  return row;
}

export function update(name, rowId, patch) {
  const row = db[name].find((r) => r.id === rowId);
  if (!row) return null;
  Object.assign(row, patch);
  save();
  return row;
}

export function remove(name, rowId) {
  const before = db[name].length;
  db[name] = db[name].filter((r) => r.id !== rowId);
  save();
  return db[name].length !== before;
}

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'video/mp4': 'mp4', 'video/webm': 'webm' };

// Save bytes into the media folder and return the public path (/media/…).
export function saveMedia(buffer, mime) {
  const name = `${id()}.${EXT[mime] || 'bin'}`;
  fs.writeFileSync(path.join(MEDIA_DIR, name), buffer);
  return `/media/${name}`;
}

export function saveDataUri(dataUri) {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUri || '');
  if (!m) throw new Error('Expected a base64 data URI');
  if (!m[1].startsWith('image/')) throw new Error('Only images can be uploaded');
  return saveMedia(Buffer.from(m[2], 'base64'), m[1]);
}

// Read a /media/… file back as a data URI (to send to the AI service).
export function mediaToDataUri(publicPath) {
  const file = path.join(MEDIA_DIR, path.basename(publicPath));
  const ext = path.extname(file).slice(1);
  const mime = Object.entries(EXT).find(([, e]) => e === ext)?.[0] || 'application/octet-stream';
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

export function deleteMedia(publicPath) {
  if (!publicPath?.startsWith('/media/')) return;
  fs.rmSync(path.join(MEDIA_DIR, path.basename(publicPath)), { force: true });
}
