/* =====================================================
   akkrazzo di cane — motor de la web
   Todo el contenido vive en /data/*.json.
   Este script solo lee esos JSON y pinta las pantallas:
   nada del contenido está escrito aquí.
   ===================================================== */

const cache = {};

async function loadJSON(path) {
  if (!cache[path]) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`No se pudo cargar ${path}`);
    cache[path] = await res.json();
  }
  return cache[path];
}

let UI = {}; // recursos compartidos (data/assets.json), accesibles por id
const app = document.getElementById('app');
const tooltip = document.getElementById('tooltip');

/* ---------- arranque y rutas ----------
   Rutas por hash, así funciona en cualquier hosting estático:
   #/                      → welcome
   #/comics                → sección
   #/comics/proyecto       → proyecto
   #/comics/proyecto/cap-1 → capítulo
*/

window.addEventListener('hashchange', route);

(async function init() {
  const assets = await loadJSON('data/assets.json');
  UI = Object.fromEntries(assets.resources.map((r) => [r.id, r]));
  route();
})();

async function route() {
  stopMotion();
  hideTooltip();
  window.scrollTo(0, 0);
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);

  try {
    if (parts.length === 0) return renderWelcome();

    const section = await loadJSON(`data/${parts[0]}.json`);
    if (parts.length === 1) return renderSection(section);

    const project = section.projects.find((p) => p.id === parts[1]);
    if (!project) return renderNotFound();
    if (parts.length === 2) return renderProject(section, project);

    const chapter = (project.chapters || []).find((c) => c.id === parts[2]);
    if (!chapter) return renderNotFound();
    return renderChapter(section, project, chapter);
  } catch (err) {
    console.error(err);
    renderNotFound();
  }
}

/* ---------- pantallas ---------- */

async function renderWelcome() {
  const data = await loadJSON('data/welcome.json');
  app.className = 'cosmos';
  app.innerHTML = '';
  app.appendChild(titleEl(UI.welcomeTitle, 'akkrazzo di cane'));
  starfield(
    data.sections.map((s) => ({
      icon: s.icon,
      label: s.name,
      synopsis: s.synopsis,
      motion: s.motion,
      href: `#/${s.id}`,
    })),
    data.decor
  );
  startMotion();
}

function renderSection(section) {
  app.className = 'cosmos';
  app.innerHTML = '';
  app.appendChild(titleEl(section.title, section.title?.text || section.id));
  starfield(
    section.projects.map((p) => ({
      icon: p.icon,
      label: p.name,
      synopsis: p.synopsis,
      motion: p.motion,
      href: `#/${section.id}/${p.id}`,
    })),
    section.decor
  );
  app.appendChild(backButton('#/'));
  startMotion();
}

/* Un proyecto pinta solo los bloques que existen en su JSON,
   en este orden: portada → texto → vídeos → pistas → capítulos → galería.
   Así la misma plantilla sirve para cómic, ilustración, animación y música. */
function renderProject(section, project) {
  app.className = 'page';
  app.innerHTML = '';
  const main = document.createElement('main');
  main.className = 'project';

  main.appendChild(heading(project.name));
  if (project.cover) main.appendChild(coverEl(project.cover));
  if (project.text) main.appendChild(textBlock(project.text));
  if (project.videos) main.appendChild(videoBlock(project.videos));
  if (project.tracks) main.appendChild(trackBlock(project.tracks));
  if (project.chapters) main.appendChild(chapterList(section, project));
  if (project.gallery) main.appendChild(galleryEl(project.gallery));

  app.appendChild(main);
  app.appendChild(backButton(`#/${section.id}`));
}

function renderChapter(section, project, chapter) {
  app.className = 'page';
  app.innerHTML = '';
  const main = document.createElement('main');
  main.className = 'project';

  main.appendChild(heading(project.name));
  const sub = document.createElement('h2');
  sub.className = 'project-subtitle blend';
  sub.textContent = chapter.name;
  main.appendChild(sub);

  if (chapter.cover) main.appendChild(coverEl(chapter.cover));
  if (chapter.text) main.appendChild(textBlock(chapter.text));
  if (chapter.gallery) main.appendChild(galleryEl(chapter.gallery));

  app.appendChild(main);
  app.appendChild(backButton(`#/${section.id}/${project.id}`));
}

function renderNotFound() {
  app.className = 'page';
  app.innerHTML = '';
  const main = document.createElement('main');
  main.className = 'project';
  main.appendChild(heading('esta estrella no existe'));
  app.appendChild(main);
  app.appendChild(backButton('#/'));
}

/* ---------- cielo de estrellas ---------- */

function starfield(items, decor = []) {
  const placed = [];
  for (const item of items) {
    app.appendChild(starEl(item, placed));
  }
  // recursos decorativos: no llevan enlace ni texto, solo flotan
  for (const d of decor || []) {
    for (let i = 0; i < (d.count || 1); i++) {
      const el = starEl({ icon: { src: d.src, name: d.name }, motion: d.motion }, placed);
      el.classList.add('decor');
      app.appendChild(el);
    }
  }
}

function starEl(item, placed) {
  const el = document.createElement(item.href ? 'a' : 'div');
  if (item.href) el.href = item.href;
  el.className = 'star blend';

  const m = item.motion || {};
  // "fixed" con x/y en el JSON respeta esa posición; si no, posición aleatoria
  const pos = m.type === 'fixed' && m.x != null ? { x: m.x, y: m.y } : randomPos(placed);
  el.style.left = pos.x + '%';
  el.style.top = pos.y + '%';

  const img = document.createElement('img');
  img.src = item.icon?.src || '';
  img.alt = item.icon?.name || item.label || '';
  img.onerror = () => (img.style.display = 'none');
  el.appendChild(img);

  if (item.label) {
    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = item.label;
    el.appendChild(label);
  }

  if (item.synopsis) bindTooltip(el, item.synopsis);
  if (m.type === 'orbit' || m.type === 'drift') {
    motionItems.push({ el, m, phase: Math.random() * Math.PI * 2 });
  }
  return el;
}

/* Posición aleatoria en % del viewport que evita la zona del título
   (el centro, 60dvw × 40dvh) y no se pega a otras estrellas. */
function randomPos(placed) {
  for (let i = 0; i < 300; i++) {
    const x = 9 + Math.random() * 82;
    const y = 9 + Math.random() * 78;
    const inTitle = x > 15 && x < 77 && y > 25 && y < 72;
    const minDist = Math.max(8, 17 - i * 0.05); // se relaja si cuesta encontrar hueco
    const tooClose = placed.some((p) => Math.hypot(p.x - x, p.y - y) < minDist);
    if (!inTitle && !tooClose) {
      placed.push({ x, y });
      return { x, y };
    }
  }
  const fallback = { x: 9 + Math.random() * 82, y: 9 + Math.random() * 78 };
  placed.push(fallback);
  return fallback;
}

/* ---------- movimiento: órbitas y derivas ---------- */

let motionItems = [];
let rafId = null;

function startMotion() {
  if (!motionItems.length) return;
  const t0 = performance.now();
  const tick = (now) => {
    const t = (now - t0) / 1000;
    const vmin = Math.min(innerWidth, innerHeight) / 100;
    for (const it of motionItems) {
      if (it.m.type === 'orbit') {
        const r = (it.m.radius ?? 4) * vmin;
        const w = (Math.PI * 2) / (it.m.speed ?? 30); // speed = segundos por vuelta
        const a = w * t + it.phase;
        it.el.style.transform = `translate(${Math.cos(a) * r}px, ${Math.sin(a) * r}px)`;
      } else {
        // drift: vaivén suave, como flotar en el espacio
        const amp = (it.m.amplitude ?? 2.5) * vmin;
        const s = it.m.speed ?? 20;
        const x = Math.sin((t * 2 * Math.PI) / s + it.phase) * amp;
        const y = Math.cos((t * 2 * Math.PI) / (s * 1.37) + it.phase) * amp;
        it.el.style.transform = `translate(${x}px, ${y}px)`;
      }
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

function stopMotion() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  motionItems = [];
}

/* ---------- tooltip de sinopsis ---------- */

function bindTooltip(el, text) {
  el.addEventListener('mouseenter', () => {
    tooltip.textContent = text;
    tooltip.hidden = false;
  });
  el.addEventListener('mousemove', (e) => {
    tooltip.style.left = Math.min(e.clientX + 16, innerWidth - tooltip.offsetWidth - 8) + 'px';
    tooltip.style.top = Math.min(e.clientY + 16, innerHeight - tooltip.offsetHeight - 8) + 'px';
  });
  el.addEventListener('mouseleave', hideTooltip);
}

function hideTooltip() {
  tooltip.hidden = true;
}

/* ---------- piezas reutilizables ---------- */

/* Título dibujado a mano; si la imagen falla, cae a texto con la fuente */
function titleEl(asset, fallbackText) {
  const box = document.createElement('div');
  box.className = 'title blend';
  const useText = () => {
    box.innerHTML = '';
    box.textContent = fallbackText;
    box.classList.add('title-text');
  };
  if (asset?.src) {
    const img = document.createElement('img');
    img.src = asset.src;
    img.alt = asset.name || fallbackText;
    img.onerror = useText;
    box.appendChild(img);
  } else {
    useText();
  }
  return box;
}

function heading(text) {
  const h = document.createElement('h1');
  h.className = 'project-title blend';
  h.textContent = text;
  return h;
}

function coverEl(cover) {
  const fig = document.createElement('figure');
  fig.className = 'cover blend';
  fig.style.margin = '0';
  const img = document.createElement('img');
  img.src = cover.src;
  img.alt = cover.name || '';
  img.onerror = () => (fig.style.display = 'none');
  fig.appendChild(img);
  return fig;
}

function textBlock(paragraphs) {
  const div = document.createElement('div');
  div.className = 'text-block blend';
  for (const para of [].concat(paragraphs)) {
    const p = document.createElement('p');
    p.textContent = para;
    div.appendChild(p);
  }
  return div;
}

function galleryEl(gallery) {
  const wrap = document.createElement('div');
  const horizontal = gallery.layout !== 'vertical';
  wrap.className = horizontal ? 'gallery gallery-h' : 'gallery gallery-v';
  for (const image of gallery.images || []) {
    const img = document.createElement('img');
    img.className = 'blend';
    img.src = image.src;
    img.alt = image.name || '';
    img.loading = 'lazy';
    img.onerror = () => img.remove();
    wrap.appendChild(img);
  }
  if (horizontal) {
    // la rueda del ratón avanza la galería hacia los lados
    wrap.addEventListener(
      'wheel',
      (e) => {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          e.preventDefault();
          wrap.scrollLeft += e.deltaY;
        }
      },
      { passive: false }
    );
  }
  return wrap;
}

function chapterList(section, project) {
  const nav = document.createElement('nav');
  nav.className = 'chapters blend';
  for (const chapter of project.chapters) {
    const a = document.createElement('a');
    a.href = `#/${section.id}/${project.id}/${chapter.id}`;
    a.textContent = chapter.name;
    if (chapter.synopsis) bindTooltip(a, chapter.synopsis);
    nav.appendChild(a);
  }
  return nav;
}

function videoBlock(videos) {
  const div = document.createElement('div');
  div.className = 'videos';
  for (const v of videos) {
    if (!v.src) continue; // hueco reservado en el JSON, todavía sin archivo
    if (/youtube\.com|youtu\.be|vimeo\.com/.test(v.src)) {
      const iframe = document.createElement('iframe');
      iframe.src = v.src;
      iframe.title = v.name || 'vídeo';
      iframe.allowFullscreen = true;
      div.appendChild(iframe);
    } else {
      const video = document.createElement('video');
      video.src = v.src;
      video.controls = true;
      if (v.poster) video.poster = v.poster;
      div.appendChild(video);
    }
  }
  return div;
}

function trackBlock(tracks) {
  const div = document.createElement('div');
  div.className = 'tracks';
  for (const t of tracks) {
    const item = document.createElement('div');
    item.className = 'track';
    const name = document.createElement('div');
    name.className = 'track-name blend';
    name.textContent = t.name || 'sin título';
    item.appendChild(name);
    if (t.src) {
      const audio = document.createElement('audio');
      audio.src = t.src;
      audio.controls = true;
      audio.preload = 'none';
      item.appendChild(audio);
    }
    div.appendChild(item);
  }
  return div;
}

function backButton(href) {
  const a = document.createElement('a');
  a.href = href;
  a.className = 'back blend';
  a.setAttribute('aria-label', 'volver atrás');
  const img = document.createElement('img');
  img.src = UI.backButton?.src || '';
  img.alt = UI.backButton?.name || 'volver';
  img.onerror = () => {
    a.innerHTML = '';
    a.textContent = '←';
    a.style.fontSize = '3rem';
  };
  a.appendChild(img);
  return a;
}
