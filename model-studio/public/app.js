const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts, body: opts.body && JSON.stringify(opts.body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const state = { tool: 'create_image', models: [], generations: [], posts: [], inputs: {}, modelPhotos: [], postMedia: [] };

const HINTS = {
  create_image: 'New photos of your model from a description.',
  fashion_changer: 'Put your model in an outfit from any product or street photo.',
  carousel: 'A set of matching shots of one scene, ready for a swipe post.',
  image_to_video: 'Animate a still into a short clip. Pick a library image or drop one in.',
};

// ---------- navigation ----------
function show(view) {
  $$('nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
  if (view === 'planner') renderPosts();
}
$$('nav button, [data-goto]').forEach((b) => b.addEventListener('click', () => show(b.dataset.view || b.dataset.goto)));

// ---------- images in the browser: shrink before upload ----------
function readImage(file, max = 1536) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => reject(new Error('Could not read that image'));
    img.src = URL.createObjectURL(file);
  });
}

function pickFile(multiple) {
  return new Promise((resolve) => {
    const input = $('#file');
    input.multiple = !!multiple;
    input.value = '';
    input.onchange = () => resolve([...input.files]);
    input.click();
  });
}

function makeDrop(el, onFiles) {
  el.addEventListener('click', async () => onFiles(await pickFile(el.dataset.multiple)));
  el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('over'); });
  el.addEventListener('dragleave', () => el.classList.remove('over'));
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.classList.remove('over');
    const url = e.dataTransfer.getData('text/x-media');
    if (url) return onFiles([], url);
    onFiles([...e.dataTransfer.files].filter((f) => f.type.startsWith('image/')));
  });
}

// ---------- create ----------
function setTool(tool) {
  state.tool = tool;
  $$('#tool-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tool === tool));
  $$('.tool-only').forEach((el) => { el.style.display = el.dataset.for.split(' ').includes(tool) ? '' : 'none'; });
  $('#tool-hint').textContent = HINTS[tool];
  $('#model-select').closest('label').style.display = tool === 'image_to_video' ? 'none' : '';
  $('[name=prompt]').placeholder = tool === 'image_to_video' ? 'She turns to the camera and smiles, hair moving in the breeze' : 'Golden hour on a Lisbon rooftop, linen summer dress, laughing';
}
$$('#tool-tabs button').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));

function setInput(key, value) {
  state.inputs[key] = value;
  const drop = $(`.drop[data-input="${key}"]`);
  drop.innerHTML = value ? `<img src="${esc(value)}" alt=""><button type="button" class="small">Remove</button>` : `<span>${key === 'garment' ? 'Drop or click to add a photo of the outfit' : 'Drop an image, or pick one from the library'}</span>`;
  const rm = $('button', drop);
  if (rm) rm.addEventListener('click', (e) => { e.stopPropagation(); setInput(key, null); });
}
$$('.drop[data-input]').forEach((el) => makeDrop(el, async (files, url) => {
  if (url) return setInput(el.dataset.input, url);
  if (files[0]) setInput(el.dataset.input, await readImage(files[0]));
}));

$('#create-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const btn = $('#generate-btn');
  $('#create-error').textContent = '';
  btn.disabled = true;
  try {
    const rows = await api('/api/generate', {
      method: 'POST',
      body: {
        tool: state.tool,
        modelId: f.get('modelId'),
        prompt: f.get('prompt'),
        count: Number(f.get('count')),
        slides: Number(f.get('slides')),
        aspect: f.get('aspect'),
        duration: Number(f.get('duration')),
        garment: state.tool === 'fashion_changer' ? state.inputs.garment : undefined,
        image: state.tool === 'image_to_video' ? state.inputs.image : undefined,
      },
    });
    state.generations.unshift(...rows);
    renderGenerations();
    poll();
  } catch (err) {
    $('#create-error').textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

// ---------- generations ----------
function mediaTag(o, attrs = '') {
  return o.mime?.startsWith('video/') ? `<video src="${esc(o.url)}" muted loop playsinline ${attrs}></video>` : `<img src="${esc(o.url)}" alt="" loading="lazy" ${attrs}>`;
}

function card(g, o, i) {
  const model = state.models.find((m) => m.id === g.model_id);
  const done = g.status === 'completed';
  const media = done ? mediaTag(o, 'draggable="true"') : g.status === 'failed' ? `<span class="status failed">Failed</span>` : '<div class="spinner"></div>';
  const slide = g.params?.slide ? ` · slide ${g.params.slide}` : g.outputs.length > 1 ? ` · ${i + 1}/${g.outputs.length}` : '';
  return `<div class="card" data-id="${g.id}" data-url="${esc(o?.url || '')}">
    <div class="media">${media}${g.kind === 'video' && done ? '<span class="badge">Video</span>' : ''}</div>
    <div class="meta">
      <span class="t">${esc(g.tool_label)}${slide}</span>
      <span>${esc(model?.name || '')} · ${new Date(g.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
      ${g.status === 'failed' ? `<span class="status failed" title="${esc(g.error)}">${esc(g.error).slice(0, 90)}</span>` : ''}
      <div class="actions">
        ${done ? `<a class="small" href="${esc(o.url)}" download>Download</a>
          <button class="small" data-act="post">Add to post</button>
          ${g.kind === 'image' ? '<button class="small" data-act="animate">Animate</button>' : ''}` : ''}
        <button class="small danger" data-act="delete">Delete</button>
      </div>
    </div>
  </div>`;
}

function cards(list) {
  return list.flatMap((g) => (g.outputs.length ? g.outputs : [null]).map((o, i) => card(g, o, i))).join('');
}

function renderGenerations() {
  const recent = state.generations.slice(0, 12);
  $('#recent').innerHTML = recent.length ? cards(recent) : '<div class="empty">Nothing yet. Create a model, then generate.</div>';
  const mf = $('#lib-model').value;
  const kf = $('#lib-kind').value;
  const lib = state.generations.filter((g) => (!mf || g.model_id === mf) && (!kf || g.kind === kf));
  $('#library').innerHTML = lib.length ? cards(lib) : '<div class="empty">No generations match.</div>';
}
$('#lib-model').addEventListener('change', renderGenerations);
$('#lib-kind').addEventListener('change', renderGenerations);

document.addEventListener('click', async (e) => {
  const c = e.target.closest('.card');
  if (!c) return;
  const g = state.generations.find((x) => x.id === c.dataset.id);
  const url = c.dataset.url;
  const act = e.target.dataset.act;
  if (act === 'delete') {
    if (!confirm('Delete this generation and its files?')) return;
    await api(`/api/generations/${g.id}`, { method: 'DELETE' });
    state.generations = state.generations.filter((x) => x.id !== g.id);
    renderGenerations();
  } else if (act === 'animate') {
    setTool('image_to_video');
    setInput('image', url);
    show('create');
  } else if (act === 'post') {
    const o = g.outputs.find((x) => x.url === url);
    if (!state.postMedia.some((m) => m.url === url)) state.postMedia.push(o);
    if (g.model_id) $('#post-model').value = g.model_id;
    renderPostMedia();
    show('planner');
  } else if (e.target.closest('.media') && g.status === 'completed') {
    const o = g.outputs.find((x) => x.url === url);
    $('#viewer-body').innerHTML = (o.mime?.startsWith('video/') ? `<video src="${esc(o.url)}" controls autoplay loop playsinline></video>` : `<img src="${esc(o.url)}" alt="">`) + `<p>${esc(g.prompt)}</p>`;
    $('#viewer').showModal();
  }
});
$('#viewer').addEventListener('close', () => { $('#viewer-body').innerHTML = ''; });
document.addEventListener('dragstart', (e) => {
  const c = e.target.closest?.('.card');
  if (c?.dataset.url) e.dataTransfer.setData('text/x-media', c.dataset.url);
});

let pollTimer = null;
async function poll() {
  clearTimeout(pollTimer);
  state.generations = await api('/api/generations');
  renderGenerations();
  if (state.generations.some((g) => g.status === 'queued' || g.status === 'processing')) pollTimer = setTimeout(poll, 2000);
}

// ---------- models ----------
function renderModels() {
  const opts = state.models.map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('');
  $('#model-select').innerHTML = opts || '<option value="">Create a model first</option>';
  $('#post-model').innerHTML = opts;
  const lm = $('#lib-model').value;
  $('#lib-model').innerHTML = `<option value="">All models</option>${opts}`;
  $('#lib-model').value = lm;
  $('#models').innerHTML = state.models.length ? state.models.map((m) => {
    const n = state.generations.filter((g) => g.model_id === m.id && g.status === 'completed').length;
    return `<div class="model"><img src="${esc(m.headshot)}" alt="">
      <div><div class="n">${esc(m.name)}</div><div class="s">${m.photos.length} reference photo${m.photos.length > 1 ? 's' : ''} · ${n} generation${n === 1 ? '' : 's'}</div>
      <button class="small danger" data-del-model="${m.id}">Delete</button></div></div>`;
  }).join('') : '<div class="empty">No models yet.</div>';
}

document.addEventListener('click', async (e) => {
  const id = e.target.dataset.delModel;
  if (!id || !confirm('Delete this model and its reference photos? Its generations stay in the library.')) return;
  await api(`/api/models/${id}`, { method: 'DELETE' });
  state.models = state.models.filter((m) => m.id !== id);
  renderModels();
});

function renderModelPhotos() {
  $('#model-photos').innerHTML = state.modelPhotos.map((p, i) => `<div class="thumb"><img src="${p}" alt=""><button type="button" class="x" data-i="${i}">×</button></div>`).join('');
}
$('#model-photos').addEventListener('click', (e) => {
  if (e.target.dataset.i === undefined) return;
  state.modelPhotos.splice(Number(e.target.dataset.i), 1);
  renderModelPhotos();
});
makeDrop($('#model-drop'), async (files) => {
  for (const f of files.slice(0, 6 - state.modelPhotos.length)) state.modelPhotos.push(await readImage(f, 1280));
  renderModelPhotos();
});

$('#model-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  $('#model-error').textContent = '';
  try {
    const m = await api('/api/models', { method: 'POST', body: { name: f.get('name'), description: f.get('description'), photos: state.modelPhotos } });
    state.models.unshift(m);
    state.modelPhotos = [];
    e.target.reset();
    renderModelPhotos();
    renderModels();
    $('#model-select').value = m.id;
  } catch (err) {
    $('#model-error').textContent = err.message;
  }
});

// ---------- planner ----------
function renderPostMedia() {
  $('#post-media').innerHTML = state.postMedia.length
    ? state.postMedia.map((o, i) => `<div class="thumb">${mediaTag(o)}<button type="button" class="x" data-i="${i}">×</button></div>`).join('')
    : '<span class="hint">Pick items in the library with “Add to post”.</span>';
}
$('#post-media').addEventListener('click', (e) => {
  if (e.target.dataset.i === undefined) return;
  state.postMedia.splice(Number(e.target.dataset.i), 1);
  renderPostMedia();
});

$('#post-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  $('#post-error').textContent = '';
  try {
    const when = f.get('scheduled_at');
    const p = await api('/api/posts', { method: 'POST', body: {
      model_id: f.get('model_id'), media: state.postMedia, caption: f.get('caption'),
      platforms: f.getAll('platforms'), scheduled_at: when ? new Date(when).toISOString() : '',
    } });
    state.posts.push(p);
    state.postMedia = [];
    e.target.reset();
    renderPostMedia();
    renderPosts();
  } catch (err) {
    $('#post-error').textContent = err.message;
  }
});

function renderPosts() {
  const now = Date.now();
  const list = [...state.posts].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  $('#posts').innerHTML = list.length ? list.map((p) => {
    const due = p.status === 'planned' && new Date(p.scheduled_at).getTime() <= now;
    const model = state.models.find((m) => m.id === p.model_id);
    return `<div class="post ${due ? 'due' : ''} ${p.status === 'posted' ? 'posted' : ''}" data-post="${p.id}">
      ${p.media[0] ? mediaTag(p.media[0]) : ''}
      <div class="body">
        <div class="when">${new Date(p.scheduled_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} ${due ? '· due now' : ''} ${p.status === 'posted' ? '· posted' : ''}</div>
        <div class="s">${esc(model?.name || '')} · ${esc(p.platforms.join(', ') || 'no platform')} · ${p.media.length} item${p.media.length > 1 ? 's' : ''}</div>
        <div class="cap">${esc(p.caption)}</div>
        <div class="actions">
          <button class="small" data-post-act="copy">Copy caption</button>
          ${p.media.map((m, i) => `<a class="small" href="${esc(m.url)}" download>Media ${i + 1}</a>`).join('')}
          ${p.status !== 'posted' ? '<button class="small" data-post-act="done">Mark posted</button>' : ''}
          <button class="small danger" data-post-act="delete">Delete</button>
        </div>
      </div></div>`;
  }).join('') : '<div class="empty">No posts planned.</div>';
}

$('#posts').addEventListener('click', async (e) => {
  const act = e.target.dataset.postAct;
  if (!act) return;
  const id = e.target.closest('[data-post]').dataset.post;
  const p = state.posts.find((x) => x.id === id);
  if (act === 'copy') {
    await navigator.clipboard.writeText(p.caption);
    e.target.textContent = 'Copied';
  } else if (act === 'done') {
    Object.assign(p, await api(`/api/posts/${id}`, { method: 'PATCH', body: { status: 'posted' } }));
    renderPosts();
  } else if (act === 'delete') {
    await api(`/api/posts/${id}`, { method: 'DELETE' });
    state.posts = state.posts.filter((x) => x.id !== id);
    renderPosts();
  }
});

// Remind about due posts once a minute.
setInterval(() => {
  const due = state.posts.filter((p) => p.status === 'planned' && new Date(p.scheduled_at) <= new Date() && !p._notified);
  for (const p of due) {
    p._notified = true;
    if (Notification?.permission === 'granted') new Notification('Post due', { body: p.caption.slice(0, 80) || 'A planned post is due' });
  }
  if ($('#view-planner').classList.contains('active')) renderPosts();
}, 60_000);
if (window.Notification && Notification.permission === 'default') {
  $('#post-form').addEventListener('submit', () => Notification.requestPermission(), { once: true });
}

// ---------- boot ----------
(async () => {
  const s = await api('/api/status');
  const pill = $('#provider');
  pill.textContent = s.demo ? 'Demo mode, add FAL_KEY for real images' : `fal.ai connected`;
  pill.classList.toggle('demo', s.demo);
  [state.models, state.generations, state.posts] = await Promise.all([api('/api/models'), api('/api/generations'), api('/api/posts')]);
  setTool('create_image');
  renderModels();
  renderGenerations();
  renderPosts();
  if (!state.models.length) show('models');
  poll();
})();
