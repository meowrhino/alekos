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
let ICONS = []; // bolsa de iconos para las estrellas sin icono propio
let SKY = []; // estrellitas troceadas de fondo.png para el fondo del cielo
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
  ICONS = assets.iconPool || [];
  SKY = assets.skyStars || [];
  route();
})();

/* Reparte los iconos de la bolsa al azar sin repetir ninguno
   hasta agotarla (entonces se rebaraja). */
let iconBag = [];
function randomIcon() {
  if (!iconBag.length) {
    iconBag = [...ICONS];
    for (let i = iconBag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [iconBag[i], iconBag[j]] = [iconBag[j], iconBag[i]];
    }
  }
  return iconBag.pop();
}

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
  const sky = skyBackground();
  if (sky) app.appendChild(sky);
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
  const sky = skyBackground();
  if (sky) app.appendChild(sky);
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
   en este orden: portada → texto → vídeos → pistas → galería.
   Así la misma plantilla sirve para cómic, ilustración, animación y música.
   Si el proyecto tiene capítulos, en vez de página es otro cielo. */
function renderProject(section, project) {
  if (project.chapters) return renderChapterCosmos(section, project);

  app.className = 'page';
  app.innerHTML = '';
  const main = document.createElement('main');
  main.className = 'project';

  main.appendChild(heading(project.name));
  if (project.cover) main.appendChild(coverEl(project.cover));
  if (project.text) main.appendChild(textBlock(project.text));
  if (project.videos) main.appendChild(videoBlock(project.videos));
  if (project.tracks) main.appendChild(trackBlock(project.tracks));
  if (project.gallery) main.appendChild(galleryEl(project.gallery));

  app.appendChild(main);
  app.appendChild(backButton(`#/${section.id}`));
}

/* Proyecto con capítulos: la portada del proyecto ocupa el centro
   (como el título del welcome) y la pantalla se divide en tantas
   franjas verticales como capítulos. Cada capítulo aparece en un punto
   aleatorio DENTRO de su franja: colocación azarosa, pero el orden de
   lectura se mantiene de izquierda a derecha. */
function renderChapterCosmos(section, project) {
  app.className = 'cosmos';
  app.innerHTML = '';
  const sky = skyBackground();
  if (sky) app.appendChild(sky);
  app.appendChild(titleEl(project.cover, project.name));

  const placed = [];
  const total = project.chapters.length;
  project.chapters.forEach((chapter, index) => {
    const el = starEl(
      {
        icon: chapter.icon || project.icon,
        label: chapter.name,
        synopsis: chapter.synopsis,
        motion: chapter.motion,
        href: `#/${section.id}/${project.id}/${chapter.id}`,
        band: { index, total },
      },
      placed
    );
    app.appendChild(el);
  });

  app.appendChild(backButton(`#/${section.id}`));
  startMotion();
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

/* ---------- fondo de estrellitas ----------
   Se genera nuevo en cada visita con las estrellitas muestreadas de
   fondo.png. No es random puro: los cielos random puro salen con grumos
   y huecos feos. En su lugar:
   - Poisson-disc (algoritmo de Bridson): puntos al azar pero nunca más
     cerca de una distancia mínima — el "blue noise" que se usa para
     repartir estrellas y árboles en videojuegos, orgánico y uniforme.
   - Tamaños por ley de potencias: muchas estrellas pequeñas y pocas
     grandes, como las magnitudes del cielo real.
   - Una "vía láctea": banda de mayor densidad que cruza la pantalla con
     ángulo aleatorio; lejos de ella solo sobreviven algunas estrellas.
   - Brillos (opacidad) y rotaciones variadas.
   La zona del título queda despejada. */
function skyBackground() {
  if (!SKY.length) return null;
  const layer = document.createElement('div');
  layer.className = 'sky';
  const w = innerWidth;
  const h = innerHeight;

  // banda de densidad: una recta con ángulo y desplazamiento al azar
  const angle = Math.random() * Math.PI;
  const normalX = -Math.sin(angle);
  const normalY = Math.cos(angle);
  const centerX = w * (0.3 + Math.random() * 0.4);
  const centerY = h * (0.3 + Math.random() * 0.4);
  const bandWidth = Math.min(w, h) * 0.3;

  const minDist = Math.max(46, Math.min(w, h) * 0.065);
  for (const [x, y] of poissonDisc(w, h, minDist)) {
    // la zona del título queda libre
    const px = (x / w) * 100;
    const py = (y / h) * 100;
    if (px > 18 && px < 82 && py > 28 && py < 70) continue;

    // probabilidad de sobrevivir según la distancia a la banda
    const dist = Math.abs((x - centerX) * normalX + (y - centerY) * normalY);
    const keep = 0.3 + 0.7 * Math.exp(-((dist / bandWidth) ** 2));
    if (Math.random() > keep) continue;

    const img = document.createElement('img');
    const sprite = SKY[Math.floor(Math.random() * SKY.length)];
    img.src = sprite.src;
    img.alt = '';
    const size = 7 + Math.pow(Math.random(), 2.4) * 26; // px
    img.style.width = size + 'px';
    img.style.left = x + 'px';
    img.style.top = y + 'px';
    img.style.opacity = (0.4 + Math.random() * 0.6).toFixed(2);
    img.style.rotate = Math.floor(Math.random() * 360) + 'deg';
    layer.appendChild(img);
  }
  return layer;
}

/* Poisson-disc sampling (Bridson): rellena el plano con puntos separados
   al menos 'r' px, probando k candidatos alrededor de cada punto activo. */
function poissonDisc(w, h, r, k = 20) {
  const cell = r / Math.SQRT2;
  const gw = Math.ceil(w / cell);
  const gh = Math.ceil(h / cell);
  const grid = new Array(gw * gh).fill(-1);
  const pts = [];
  const active = [];

  const fits = (x, y) => {
    const gx = Math.floor(x / cell);
    const gy = Math.floor(y / cell);
    for (let i = Math.max(0, gx - 2); i <= Math.min(gw - 1, gx + 2); i++) {
      for (let j = Math.max(0, gy - 2); j <= Math.min(gh - 1, gy + 2); j++) {
        const q = grid[i + j * gw];
        if (q >= 0 && Math.hypot(pts[q][0] - x, pts[q][1] - y) < r) return false;
      }
    }
    return true;
  };
  const add = (x, y) => {
    grid[Math.floor(x / cell) + Math.floor(y / cell) * gw] = pts.length;
    pts.push([x, y]);
    active.push(pts.length - 1);
  };

  add(Math.random() * w, Math.random() * h);
  while (active.length) {
    const pick = Math.floor(Math.random() * active.length);
    const [ax, ay] = pts[active[pick]];
    let placed = false;
    for (let t = 0; t < k; t++) {
      const a = Math.random() * Math.PI * 2;
      const d = r * (1 + Math.random());
      const x = ax + Math.cos(a) * d;
      const y = ay + Math.sin(a) * d;
      if (x < 0 || x >= w || y < 0 || y >= h || !fits(x, y)) continue;
      add(x, y);
      placed = true;
      break;
    }
    if (!placed) active.splice(pick, 1);
  }
  return pts;
}

/* ---------- cielo de estrellas ---------- */

function starfield(items, decor = []) {
  const placed = [];
  for (const item of items) {
    app.appendChild(starEl(item, placed));
  }
  // recursos decorativos: no llevan enlace ni texto, solo acompañan
  for (const d of decor || []) {
    for (let i = 0; i < (d.count || 1); i++) {
      const icon = d.src ? { src: d.src, name: d.name } : undefined;
      const el = starEl({ icon, motion: d.motion }, placed);
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
  const pos = m.type === 'fixed' && m.x != null ? { x: m.x, y: m.y } : randomPos(placed, item.band);
  el.style.left = pos.x + '%';
  el.style.top = pos.y + '%';

  // sin icono propio en el JSON → uno al azar de la bolsa
  const icon = item.icon || randomIcon();
  const img = document.createElement('img');
  img.src = icon?.src || '';
  img.alt = icon?.name || item.label || '';
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
   (el centro, 60dvw × 40dvh) y no se pega a otras estrellas.
   Si llega 'band' (capítulos), la x se limita a su franja vertical
   para conservar el orden de lectura. */
function randomPos(placed, band) {
  const bandX = () => {
    if (!band) return 9 + Math.random() * 82;
    const width = 82 / band.total;
    return 9 + band.index * width + Math.random() * width;
  };
  for (let i = 0; i < 300; i++) {
    const x = bandX();
    const y = 9 + Math.random() * 78;
    const inTitle = x > 15 && x < 77 && y > 25 && y < 72;
    const minDist = Math.max(6, 17 - i * 0.05); // se relaja si cuesta encontrar hueco
    const tooClose = placed.some((p) => Math.hypot(p.x - x, p.y - y) < minDist);
    if (!inTitle && !tooClose) {
      placed.push({ x, y });
      return { x, y };
    }
  }
  // último recurso: cualquier punto de la franja fuera de la zona del título
  const fallback = { x: bandX(), y: Math.random() < 0.5 ? 9 + Math.random() * 15 : 74 + Math.random() * 13 };
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
