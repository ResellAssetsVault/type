// Demo provider: no network, no key. Draws an SVG placeholder that embeds the
// first reference image and the prompt, so every screen of the app works.
export const name = 'demo';
export const configured = () => true;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function wrap(text, width = 34, maxLines = 6) {
  const words = String(text).split(/\s+/);
  const lines = [''];
  for (const w of words) {
    if ((lines.at(-1) + ' ' + w).trim().length > width) lines.push(w);
    else lines[lines.length - 1] = (lines.at(-1) + ' ' + w).trim();
  }
  return lines.slice(0, maxLines);
}

function card(job, n, hue) {
  const ref = job.images[0];
  const lines = wrap(job.prompt).map((l, i) => `<tspan x="40" dy="${i ? 30 : 0}">${esc(l)}</tspan>`).join('');
  const badge = job.kind === 'video' ? `DEMO VIDEO · ${job.duration || 5}s` : `DEMO IMAGE ${n + 1}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280" viewBox="0 0 720 1280">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="hsl(${hue},70%,55%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360},70%,30%)"/></linearGradient>
    <clipPath id="c"><rect x="110" y="200" width="500" height="620" rx="28"/></clipPath></defs>
  <rect width="720" height="1280" fill="url(#g)"/>
  ${ref ? `<image href="${ref}" x="110" y="200" width="500" height="620" preserveAspectRatio="xMidYMid slice" clip-path="url(#c)"/>` : ''}
  ${job.kind === 'video' ? '<circle cx="360" cy="510" r="70" fill="rgba(0,0,0,.45)"/><path d="M335 465 L405 510 L335 555 Z" fill="#fff"/>' : ''}
  <text x="40" y="110" font-family="system-ui,sans-serif" font-size="30" font-weight="700" fill="#fff">${badge}</text>
  <text x="40" y="900" font-family="system-ui,sans-serif" font-size="26" fill="#fff">${lines}</text>
</svg>`;
}

export async function submit(job) {
  return { demo: true, job };
}

export async function wait(handle, { onStatus } = {}) {
  onStatus?.('IN_PROGRESS');
  await new Promise((r) => setTimeout(r, 1200));
  const { job } = handle;
  const hue = Math.floor(Math.random() * 360);
  return Array.from({ length: job.kind === 'video' ? 1 : job.count || 1 }, (_, n) => ({
    url: `data:image/svg+xml;base64,${Buffer.from(card(job, n, (hue + n * 40) % 360)).toString('base64')}`,
    mime: 'image/svg+xml',
  }));
}
