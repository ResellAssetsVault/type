// fal.ai provider, using its queue API: submit → poll status → fetch result.
// Docs: https://docs.fal.ai/model-endpoints/queue
const QUEUE = 'https://queue.fal.run';

export const IMAGE_MODEL = process.env.FAL_IMAGE_MODEL || 'fal-ai/nano-banana/edit';
export const VIDEO_MODEL = process.env.FAL_VIDEO_MODEL || 'fal-ai/kling-video/v2.1/standard/image-to-video';

const headers = () => ({ Authorization: `Key ${process.env.FAL_KEY}`, 'Content-Type': 'application/json' });

async function call(url, init) {
  const res = await fetch(url, { ...init, headers: headers() });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!res.ok) {
    const detail = body?.detail ? JSON.stringify(body.detail) : text;
    throw new Error(`fal.ai ${res.status}: ${detail.slice(0, 400)}`);
  }
  return body;
}

export const name = 'fal.ai';
export const configured = () => Boolean(process.env.FAL_KEY);

// Returns a handle that can be stored and resumed after a restart.
export async function submit(job) {
  const model = job.kind === 'video' ? VIDEO_MODEL : IMAGE_MODEL;
  const input = job.kind === 'video'
    ? { prompt: job.prompt, image_url: job.images[0], duration: String(job.duration || 5) }
    : { prompt: job.prompt, image_urls: job.images, num_images: job.count || 1, aspect_ratio: job.aspect || '9:16', output_format: 'png' };
  const r = await call(`${QUEUE}/${model}`, { method: 'POST', body: JSON.stringify(input) });
  return { request_id: r.request_id, status_url: r.status_url, response_url: r.response_url, model };
}

// Resolves to [{ url, mime }] once the job is done; throws if it failed.
export async function wait(handle, { onStatus, intervalMs = 2000, timeoutMs = 20 * 60_000 } = {}) {
  const started = Date.now();
  for (;;) {
    const s = await call(handle.status_url, { method: 'GET' });
    onStatus?.(s.status);
    if (s.status === 'COMPLETED') break;
    if (s.status === 'FAILED' || s.error) throw new Error(s.error || 'Generation failed');
    if (Date.now() - started > timeoutMs) throw new Error('Timed out waiting for fal.ai');
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  const out = await call(handle.response_url, { method: 'GET' });
  if (out.video?.url) return [{ url: out.video.url, mime: out.video.content_type || 'video/mp4' }];
  const images = out.images || (out.image ? [out.image] : []);
  if (!images.length) throw new Error('fal.ai returned no output');
  return images.map((i) => ({ url: i.url, mime: i.content_type || 'image/png' }));
}
