// EpicPrints — main module
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// =====================================================
// Shared utilities
// =====================================================
const PRICES = {
  poster: { S: 19, M: 29, L: 49, XL: 79 },
  canvas: { S: 49, M: 79, L: 119, XL: 179 },
  wood:   { S: 59, M: 89, L: 139, XL: 199 },
  metal:  { S: 69, M: 99, L: 149, XL: 219 },
};

const ORIENT_DIMS = {
  portrait:  { w: 3, h: 4 },
  landscape: { w: 4, h: 3 },
  square:    { w: 3.5, h: 3.5 },
};

// Add-on pricing for frames and matting (in USD)
const FRAME_PRICES = { none: 0, black: 25, white: 25, oak: 35, walnut: 45 };
const FRAME_SIZE_MULT = { S: 1, M: 1.4, L: 1.9, XL: 2.6 };
const MATTING_PRICES = { none: 0, white: 10, cream: 12 };
const MATTING_SIZE_MULT = { S: 1, M: 1.3, L: 1.6, XL: 2.0 };

const FRAME_COLORS = {
  black:  { color: 0x111418, roughness: 0.4, metalness: 0.1 },
  white:  { color: 0xf2efe6, roughness: 0.6, metalness: 0.0 },
  oak:    { color: 0xc9a878, roughness: 0.7, metalness: 0.05 },
  walnut: { color: 0x4a2c1a, roughness: 0.55, metalness: 0.05 },
};
const MATTING_COLORS = { white: 0xf4f1ea, cream: 0xe8dfc9 };

const PLACEHOLDER_TEX = makePlaceholderTexture();

function makePlaceholderTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  const ctx = c.getContext('2d');
  // Sky gradient
  const g = ctx.createLinearGradient(0, 0, 0, 1024);
  g.addColorStop(0, '#1f2a44');
  g.addColorStop(0.45, '#3a5a7a');
  g.addColorStop(0.55, '#e9b06f');
  g.addColorStop(1, '#3a1f0e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 1024);
  // Sun
  const sun = ctx.createRadialGradient(720, 540, 10, 720, 540, 220);
  sun.addColorStop(0, 'rgba(255,230,170,1)');
  sun.addColorStop(1, 'rgba(255,230,170,0)');
  ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(720, 540, 220, 0, Math.PI * 2); ctx.fill();
  // Mountains
  ctx.fillStyle = '#0e1422';
  ctx.beginPath();
  ctx.moveTo(0, 800);
  ctx.lineTo(180, 600); ctx.lineTo(320, 720); ctx.lineTo(520, 540);
  ctx.lineTo(700, 720); ctx.lineTo(880, 620); ctx.lineTo(1024, 760);
  ctx.lineTo(1024, 1024); ctx.lineTo(0, 1024); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#070a14';
  ctx.beginPath();
  ctx.moveTo(0, 900); ctx.lineTo(220, 800); ctx.lineTo(400, 880);
  ctx.lineTo(620, 780); ctx.lineTo(820, 880); ctx.lineTo(1024, 820);
  ctx.lineTo(1024, 1024); ctx.lineTo(0, 1024); ctx.closePath(); ctx.fill();
  // Watermark
  ctx.fillStyle = 'rgba(245,196,81,0.85)';
  ctx.font = 'bold 64px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('EPICPRINTS', 512, 980);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Procedural textures for material side surfaces
function makeWoodSideTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d6a76b'; ctx.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 60; i++) {
    ctx.strokeStyle = `rgba(${80 + Math.random()*60|0}, ${50 + Math.random()*40|0}, 20, ${0.15 + Math.random()*0.25})`;
    ctx.lineWidth = 0.5 + Math.random() * 1.5;
    ctx.beginPath();
    const y = Math.random() * 256;
    ctx.moveTo(0, y);
    for (let x = 0; x < 512; x += 20) {
      ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 6);
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeMetalSideTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#c8ccd1'); g.addColorStop(.5, '#9ea4ad'); g.addColorStop(1, '#c8ccd1');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 800; i++) {
    ctx.strokeStyle = `rgba(255,255,255,${Math.random() * 0.08})`;
    ctx.beginPath();
    const y = Math.random() * 256;
    ctx.moveTo(0, y); ctx.lineTo(512, y + (Math.random() - .5) * 2);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const WOOD_SIDE = makeWoodSideTexture();
const METAL_SIDE = makeMetalSideTexture();

// Build a print mesh for a given material + dimensions + texture
function buildPrintMesh({ material, w = 3, h = 4, texture = PLACEHOLDER_TEX, finish = 'matte' }) {
  const cfg = {
    poster: { depth: 0.04, sideColor: 0xf5f5f0, roughness: 0.95, metalness: 0.0 },
    canvas: { depth: 0.30, sideColor: 0xf2ece1, roughness: 0.85, metalness: 0.0 },
    wood:   { depth: 0.22, sideMap: WOOD_SIDE, sideColor: 0xd6a76b, roughness: 0.7, metalness: 0.05 },
    metal:  { depth: 0.10, sideMap: METAL_SIDE, sideColor: 0xc4c8cd, roughness: 0.35, metalness: 0.85 },
  }[material] || { depth: 0.05, sideColor: 0xffffff, roughness: 0.9, metalness: 0.0 };

  const finishCfg = {
    matte: { rough: 0.05, clear: 0.0 },
    satin: { rough: -0.15, clear: 0.3 },
    gloss: { rough: -0.4, clear: 0.8 },
  }[finish] || { rough: 0, clear: 0 };

  const geo = new THREE.BoxGeometry(w, h, cfg.depth);

  const frontMatParams = {
    map: texture,
    roughness: Math.max(0.05, cfg.roughness + finishCfg.rough),
    metalness: cfg.metalness,
    clearcoat: finishCfg.clear,
    clearcoatRoughness: 0.15,
  };

  const front = new THREE.MeshPhysicalMaterial(frontMatParams);
  const back = new THREE.MeshStandardMaterial({ color: 0x111418, roughness: 0.9 });
  const sideMat = new THREE.MeshStandardMaterial({
    color: cfg.sideColor,
    map: cfg.sideMap || null,
    roughness: cfg.roughness,
    metalness: cfg.metalness,
  });

  // BoxGeometry material order: [right, left, top, bottom, front, back]
  const mats = [sideMat, sideMat, sideMat, sideMat, front, back];
  const mesh = new THREE.Mesh(geo, mats);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Build a print possibly wrapped in matting + frame. Returns a THREE.Group.
function buildFramedPrint({ material, w, h, texture, finish, frame = 'none', matting = 'none' }) {
  const group = new THREE.Group();
  const print = buildPrintMesh({ material, w, h, texture, finish });
  // Push the print slightly forward when framed so it sits in front of the matting
  const hasFrame = frame !== 'none';
  const hasMat = matting !== 'none';
  const matWidth = hasMat ? Math.min(w, h) * 0.10 : 0;     // matting border thickness
  const frameWidth = hasFrame ? Math.min(w, h) * 0.07 : 0; // frame border thickness
  const frameDepth = hasFrame ? 0.18 : 0;

  if (hasMat) {
    const matW = w + matWidth * 2;
    const matH = h + matWidth * 2;
    const matMesh = new THREE.Mesh(
      new THREE.BoxGeometry(matW, matH, 0.04),
      new THREE.MeshStandardMaterial({ color: MATTING_COLORS[matting] || 0xf4f1ea, roughness: 0.95 })
    );
    matMesh.position.z = -0.04;
    group.add(matMesh);
    // recess print slightly into the mat
    print.position.z = 0.005;
  }

  if (hasFrame) {
    const innerW = w + matWidth * 2;
    const innerH = h + matWidth * 2;
    const outerW = innerW + frameWidth * 2;
    const outerH = innerH + frameWidth * 2;

    // Build frame as 4 boxes (a rectangle ring) so each side gets clean lighting.
    const fc = FRAME_COLORS[frame] || FRAME_COLORS.black;
    const frameMat = new THREE.MeshStandardMaterial({
      color: fc.color, roughness: fc.roughness, metalness: fc.metalness,
    });
    const sideZ = -0.03; // frame sits at same plane as matting, surrounding it

    // top / bottom
    const horiz = new THREE.BoxGeometry(outerW, frameWidth, frameDepth);
    const top = new THREE.Mesh(horiz, frameMat);
    top.position.set(0, innerH / 2 + frameWidth / 2, sideZ);
    const bot = new THREE.Mesh(horiz, frameMat);
    bot.position.set(0, -innerH / 2 - frameWidth / 2, sideZ);
    // left / right
    const vert = new THREE.BoxGeometry(frameWidth, innerH, frameDepth);
    const left = new THREE.Mesh(vert, frameMat);
    left.position.set(-innerW / 2 - frameWidth / 2, 0, sideZ);
    const right = new THREE.Mesh(vert, frameMat);
    right.position.set(innerW / 2 + frameWidth / 2, 0, sideZ);

    group.add(top, bot, left, right);

    // Subtle inner bevel highlight ring
    const bevelMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.8, opacity: 0.5, transparent: true });
    const bevel = new THREE.Mesh(new THREE.BoxGeometry(innerW + 0.02, innerH + 0.02, 0.005), bevelMat);
    bevel.position.z = sideZ + frameDepth / 2 + 0.001;
    group.add(bevel);
  }

  group.add(print);
  return group;
}

// Set up a renderer + scene with environment for reflections
function makeScene(canvas, { fov = 35, alpha = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const setSize = () => {
    const r = canvas.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
  };
  setSize();
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    camera.aspect = r.width / r.height || 1;
    camera.updateProjectionMatrix();
    renderer.setSize(r.width, r.height, false);
  };
  resize();
  window.addEventListener('resize', resize);

  return { renderer, scene, camera, resize };
}

// =====================================================
// HERO — rotating showcase
// =====================================================
function initHero() {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas) return;
  const { renderer, scene, camera } = makeScene(canvas, { fov: 32, alpha: false });
  scene.background = new THREE.Color('#0b0d12');

  // Lights
  const key = new THREE.DirectionalLight(0xffe0b8, 1.6);
  key.position.set(4, 6, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xff7aaa, 0.8);
  rim.position.set(-5, 3, -3); scene.add(rim);
  scene.add(new THREE.AmbientLight(0x6b7a99, 0.35));

  // Floor reflection
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(20, 64),
    new THREE.MeshStandardMaterial({ color: 0x0b0d12, roughness: 0.4, metalness: 0.3 })
  );
  floor.rotation.x = -Math.PI / 2; floor.position.y = -3;
  scene.add(floor);

  // Group of 4 prints arranged in a slow carousel
  const group = new THREE.Group();
  const materials = ['poster', 'canvas', 'wood', 'metal'];
  const radius = 4.2;
  materials.forEach((mat, i) => {
    const mesh = buildPrintMesh({ material: mat, w: 2.4, h: 3.2 });
    const angle = (i / materials.length) * Math.PI * 2;
    mesh.position.set(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
    mesh.lookAt(0, 0, 0);
    mesh.rotation.y += Math.PI;
    group.add(mesh);
  });
  scene.add(group);

  camera.position.set(0, 1.2, 9);
  camera.lookAt(0, 0, 0);

  // Mouse parallax
  let mx = 0, my = 0;
  window.addEventListener('mousemove', (e) => {
    mx = (e.clientX / window.innerWidth - 0.5) * 0.6;
    my = (e.clientY / window.innerHeight - 0.5) * 0.4;
  });

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    group.rotation.y = t * 0.25;
    group.children.forEach((m, i) => {
      m.position.y = Math.sin(t * 0.6 + i) * 0.15;
    });
    camera.position.x += (mx * 2 - camera.position.x) * 0.04;
    camera.position.y += (1.2 + my * -1 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }
  animate();
}

// =====================================================
// MATERIAL CARDS — small scene per card
// =====================================================
function initMaterialCards() {
  document.querySelectorAll('.mcard').forEach((card) => {
    const canvas = card.querySelector('canvas');
    const matName = card.dataset.material;
    if (!canvas) return;
    const { renderer, scene, camera } = makeScene(canvas, { fov: 30 });

    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(2, 3, 4); scene.add(dir);
    scene.add(new THREE.AmbientLight(0x8090a0, 0.6));

    const mesh = buildPrintMesh({ material: matName, w: 2.4, h: 3.2 });
    scene.add(mesh);
    camera.position.set(0, 0, 6);

    let hover = false;
    card.addEventListener('mouseenter', () => hover = true);
    card.addEventListener('mouseleave', () => hover = false);

    let baseRot = -0.25;
    function tick() {
      requestAnimationFrame(tick);
      const target = hover ? Math.sin(performance.now() * 0.0008) * 0.6 : baseRot;
      mesh.rotation.y += (target - mesh.rotation.y) * 0.08;
      mesh.rotation.x += (((hover ? -0.05 : 0.05)) - mesh.rotation.x) * 0.05;
      renderer.render(scene, camera);
    }
    tick();
  });
}

// =====================================================
// SHOP — render a curated grid (data-driven)
// =====================================================
const PRODUCTS = [
  { id: 'p1',  title: 'Aurora Drift',     price: 49, cat: 'landscape', hue: 'linear-gradient(135deg,#0f2a52,#3a8fa0,#a4dcd8)' },
  { id: 'p2',  title: 'Desert Bloom',     price: 59, cat: 'landscape', hue: 'linear-gradient(135deg,#3a1f0e,#c97a3a,#f5c451)' },
  { id: 'p3',  title: 'Neon Tokyo',       price: 69, cat: 'urban',     hue: 'linear-gradient(135deg,#0a0a1f,#ff2e88,#7a2bff)' },
  { id: 'p4',  title: 'Pacific Calm',     price: 49, cat: 'landscape', hue: 'linear-gradient(135deg,#0a3245,#137a8a,#bfead6)' },
  { id: 'p5',  title: 'Forest Cathedral', price: 59, cat: 'nature',    hue: 'linear-gradient(135deg,#0c1d12,#2d6b3a,#cae29c)' },
  { id: 'p6',  title: 'Iron & Glass',     price: 69, cat: 'urban',     hue: 'linear-gradient(135deg,#111418,#3b424c,#9da6b4)' },
  { id: 'p7',  title: 'Citrus Geometry',  price: 39, cat: 'abstract',  hue: 'linear-gradient(135deg,#f5c451,#ff8a4c,#ff5fa2)' },
  { id: 'p8',  title: 'Midnight Bloom',   price: 59, cat: 'nature',    hue: 'linear-gradient(135deg,#080611,#3a1d6b,#9a6cff)' },
  { id: 'p9',  title: 'Coastal Fog',      price: 49, cat: 'landscape', hue: 'linear-gradient(135deg,#1a2a33,#5b7a85,#dbe6ea)' },
  { id: 'p10', title: 'Lava Field',       price: 69, cat: 'landscape', hue: 'linear-gradient(135deg,#1a0a0a,#7a1d12,#ff5b2c)' },
  { id: 'p11', title: 'Skyline Glow',     price: 69, cat: 'urban',     hue: 'linear-gradient(135deg,#0b1430,#1b3a7a,#f5c451)' },
  { id: 'p12', title: 'Brutalist',        price: 59, cat: 'urban',     hue: 'linear-gradient(135deg,#1a1a1a,#4a4a4a,#a8a8a8)' },
  { id: 'p13', title: 'Velvet Wave',      price: 39, cat: 'abstract',  hue: 'linear-gradient(135deg,#2a0a3a,#7a1d8a,#ff5fa2)' },
  { id: 'p14', title: 'Color Field 03',   price: 39, cat: 'abstract',  hue: 'linear-gradient(135deg,#0f4d2a,#7ab058,#f5e7a3)' },
  { id: 'p15', title: 'Fern Study',       price: 49, cat: 'nature',    hue: 'linear-gradient(135deg,#0d1e0c,#3d6b1a,#a8d36b)' },
  { id: 'p16', title: 'Tide Pool',        price: 49, cat: 'nature',    hue: 'linear-gradient(135deg,#062028,#1a6b78,#e7f4ef)' },
  { id: 'p17', title: 'Solar Static',     price: 39, cat: 'abstract',  hue: 'linear-gradient(135deg,#180a1a,#7a2bff,#f5c451)' },
  { id: 'p18', title: 'Granite Range',    price: 59, cat: 'landscape', hue: 'linear-gradient(135deg,#1a1d22,#5d6068,#d6dae0)' },
];

function initShop() {
  const grid = document.getElementById('shopGrid');
  const filters = document.getElementById('shopFilters');
  if (!grid) return;
  let activeCat = 'all';

  function render() {
    const list = activeCat === 'all' ? PRODUCTS : PRODUCTS.filter(p => p.cat === activeCat);
    grid.innerHTML = list.map(p => `
      <article class="product" data-id="${p.id}">
        <div class="product__art" style="background-image:${p.hue}"></div>
        <div class="product__body">
          <span class="product__cat">${p.cat}</span>
          <h4>${p.title}</h4>
          <span>From $${p.price}</span>
        </div>
      </article>
    `).join('');

    grid.querySelectorAll('.product').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.id;
        const p = PRODUCTS.find(x => x.id === id);
        if (!p) return;
        const tex = gradientToTexture(p.hue, p.title);
        Customizer.loadTexture(tex);
        document.getElementById('customizer').scrollIntoView({ behavior: 'smooth' });
      });
    });
  }

  if (filters) {
    filters.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        filters.querySelectorAll('.chip').forEach(c => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        activeCat = chip.dataset.cat;
        render();
      });
    });
  }

  render();
}

function gradientToTexture(cssGradient, label) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1280;
  const ctx = c.getContext('2d');
  // Naive gradient parse — extract colors
  const colors = cssGradient.match(/#[0-9a-fA-F]{3,8}/g) || ['#222', '#888'];
  const g = ctx.createLinearGradient(0, 0, 1024, 1280);
  colors.forEach((col, i) => g.addColorStop(i / (colors.length - 1), col));
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 1280);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 72px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label || 'EpicPrints', 512, 1180);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// =====================================================
// CUSTOMIZER — interactive 3D + uploads
// =====================================================
const Customizer = (() => {
  let scene, camera, renderer, controls, currentMesh, currentTex = PLACEHOLDER_TEX;
  let state = { material: 'poster', size: 'S', orient: 'portrait', finish: 'matte', frame: 'none', matting: 'none' };

  function init() {
    const canvas = document.getElementById('custCanvas');
    if (!canvas) return;
    const built = makeScene(canvas, { fov: 35 });
    renderer = built.renderer; scene = built.scene; camera = built.camera;

    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(3, 4, 5); scene.add(key);
    const fill = new THREE.DirectionalLight(0xffd6b0, 0.6);
    fill.position.set(-4, 2, 3); scene.add(fill);
    scene.add(new THREE.AmbientLight(0x90a0c0, 0.45));

    camera.position.set(0, 0, 7);
    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 4;
    controls.maxDistance = 12;
    controls.enablePan = false;

    rebuild();
    bindUI();
    bindUpload();

    function tick() {
      requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);
    }
    tick();
  }

  function rebuild() {
    if (currentMesh) scene.remove(currentMesh);
    const { w, h } = ORIENT_DIMS[state.orient];
    currentMesh = buildFramedPrint({
      material: state.material,
      w, h,
      texture: currentTex,
      finish: state.finish,
      frame: state.frame,
      matting: state.matting,
    });
    currentMesh.rotation.y = -0.4;
    currentMesh.rotation.x = 0.05;
    scene.add(currentMesh);
    updatePrice();
  }

  function calcPrice() {
    const base = PRICES[state.material][state.size];
    const frame = Math.round(FRAME_PRICES[state.frame] * FRAME_SIZE_MULT[state.size]);
    const mat = Math.round(MATTING_PRICES[state.matting] * MATTING_SIZE_MULT[state.size]);
    return base + frame + mat;
  }

  function bindUI() {
    const groups = [
      { id: 'materialChips', key: 'material' },
      { id: 'sizeChips', key: 'size' },
      { id: 'orientChips', key: 'orient' },
      { id: 'finishChips', key: 'finish' },
      { id: 'frameChips', key: 'frame' },
      { id: 'mattingChips', key: 'matting' },
    ];
    groups.forEach(g => {
      const el = document.getElementById(g.id);
      el.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
          el.querySelectorAll('.chip').forEach(c => c.classList.remove('is-active'));
          chip.classList.add('is-active');
          state[g.key] = chip.dataset[g.key];
          rebuild();
        });
      });
    });

    document.querySelectorAll('[data-pick]').forEach(a => {
      a.addEventListener('click', (e) => {
        const m = a.dataset.pick;
        const chips = document.getElementById('materialChips');
        chips.querySelectorAll('.chip').forEach(c => c.classList.toggle('is-active', c.dataset.material === m));
        state.material = m;
        rebuild();
      });
    });

    document.getElementById('addToCart').addEventListener('click', () => {
      Cart.add({
        id: 'custom-' + Date.now(),
        title: `Custom ${cap(state.material)} Print`,
        material: state.material,
        size: state.size,
        orient: state.orient,
        finish: state.finish,
        frame: state.frame,
        matting: state.matting,
        price: calcPrice(),
        thumb: textureToDataUrl(currentTex),
      });
      toast('Added to cart');
    });
  }

  function bindUpload() {
    const drop = document.getElementById('dropZone');
    const input = document.getElementById('fileInput');
    if (!drop || !input) return;

    drop.addEventListener('click', () => input.click());
    input.addEventListener('change', () => {
      if (input.files && input.files[0]) loadFile(input.files[0]);
    });

    ['dragenter', 'dragover'].forEach(ev =>
      drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-drag'); }));
    ['dragleave', 'drop'].forEach(ev =>
      drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-drag'); }));
    drop.addEventListener('drop', (e) => {
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) loadFile(f);
    });
  }

  function loadFile(file) {
    const MAX_SIZE = 50 * 1024 * 1024;
    const VALID_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

    if (!file.type.startsWith('image/')) {
      toast('Please drop an image file (JPG, PNG, WebP, or HEIC)');
      return;
    }

    if (file.size > MAX_SIZE) {
      toast(`File too large (max 50MB, got ${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onerror = () => {
      toast('Could not load image. Try another file.');
      URL.revokeObjectURL(url);
    };

    img.onload = () => {
      if (img.width < 300 || img.height < 300) {
        toast('Image too small (min 300×300px). Try a higher resolution.');
        URL.revokeObjectURL(url);
        return;
      }

      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      tex.needsUpdate = true;
      currentTex = tex;

      const ar = img.width / img.height;
      const o = ar > 1.15 ? 'landscape' : ar < 0.87 ? 'portrait' : 'square';
      const orientChips = document.getElementById('orientChips');
      orientChips.querySelectorAll('.chip').forEach(c => c.classList.toggle('is-active', c.dataset.orient === o));
      state.orient = o;

      document.getElementById('dropZone').classList.add('is-hidden');
      rebuild();
      toast('✓ Photo loaded — drag to rotate, scroll to zoom');
    };
    img.src = url;
  }

  function loadTexture(tex) {
    currentTex = tex;
    document.getElementById('dropZone').classList.add('is-hidden');
    rebuild();
  }

  function updatePrice() {
    document.getElementById('custPrice').textContent = `$${calcPrice().toFixed(2)}`;
  }

  return { init, loadTexture };
})();

function textureToDataUrl(tex) {
  // For Canvas/Image-based textures, draw to a small canvas
  try {
    const c = document.createElement('canvas');
    c.width = 80; c.height = 100;
    const ctx = c.getContext('2d');
    const src = tex.image;
    if (src) ctx.drawImage(src, 0, 0, 80, 100);
    return c.toDataURL('image/jpeg', 0.7);
  } catch (e) {
    return '';
  }
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// =====================================================
// ABOUT — slow rotating cluster
// =====================================================
function initAbout() {
  const canvas = document.getElementById('aboutCanvas');
  if (!canvas) return;
  const { renderer, scene, camera } = makeScene(canvas, { fov: 35 });
  const dir = new THREE.DirectionalLight(0xffffff, 1.4);
  dir.position.set(3, 4, 5); scene.add(dir);
  scene.add(new THREE.AmbientLight(0x808a99, 0.5));

  const group = new THREE.Group();
  const arr = [
    { material: 'metal',  pos: [-1.3, 0.6, 0],   rot: 0.3 },
    { material: 'wood',   pos: [1.0, -0.6, 0.6], rot: -0.4 },
    { material: 'canvas', pos: [0.2, 0.2, -0.6], rot: 0.05 },
  ];
  arr.forEach(c => {
    const m = buildPrintMesh({ material: c.material, w: 1.8, h: 2.4 });
    m.position.set(...c.pos);
    m.rotation.y = c.rot;
    group.add(m);
  });
  scene.add(group);

  camera.position.set(0, 0, 6.2);

  const clock = new THREE.Clock();
  function tick() {
    requestAnimationFrame(tick);
    const t = clock.getElapsedTime();
    group.rotation.y = Math.sin(t * 0.3) * 0.4;
    group.rotation.x = Math.sin(t * 0.2) * 0.1;
    renderer.render(scene, camera);
  }
  tick();
}

// =====================================================
// CART
// =====================================================
const Cart = (() => {
  const KEY = 'epicprints.cart';
  let items = [];
  try { items = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch {}

  function save() { localStorage.setItem(KEY, JSON.stringify(items)); render(); }

  function add(item) {
    if (!item.id || !item.title || typeof item.price !== 'number' || item.price <= 0) {
      console.error('Invalid cart item:', item);
      return;
    }
    items.push(item);
    save();
  }
  function remove(id) { items = items.filter(i => i.id !== id); save(); }
  function clear() { items = []; save(); }

  function render() {
    const body = document.getElementById('cartBody');
    const total = document.getElementById('cartTotal');
    const count = document.getElementById('cartCount');
    if (!body) return;
    if (items.length === 0) {
      body.innerHTML = '<p class="muted">Your cart is empty.</p>';
    } else {
      body.innerHTML = items.map(i => {
        const meta = [cap(i.material), i.size, cap(i.finish)];
        if (i.frame && i.frame !== 'none') meta.push(`${cap(i.frame)} frame`);
        if (i.matting && i.matting !== 'none') meta.push(`${cap(i.matting)} mat`);
        return `
          <div class="cart-item">
            <div class="cart-item__thumb" style="background-image:url(${i.thumb || ''})"></div>
            <div>
              <h4>${i.title}</h4>
              <div class="cart-item__meta">${meta.join(' · ')}</div>
              <button class="cart-item__rm" data-id="${i.id}">Remove</button>
            </div>
            <div class="cart-item__price">$${i.price.toFixed(2)}</div>
          </div>
        `;
      }).join('');
      body.querySelectorAll('.cart-item__rm').forEach(b => {
        b.addEventListener('click', () => remove(b.dataset.id));
      });
    }
    const sum = items.reduce((s, i) => s + i.price, 0);
    total.textContent = `$${sum.toFixed(2)}`;
    count.textContent = items.length;
  }

  function open() {
    document.getElementById('cartDrawer').classList.add('is-open');
    document.getElementById('scrim').classList.add('is-open');
  }
  function close() {
    document.getElementById('cartDrawer').classList.remove('is-open');
    document.getElementById('scrim').classList.remove('is-open');
  }

  function init() {
    document.getElementById('cartBtn').addEventListener('click', open);
    document.getElementById('closeCart').addEventListener('click', close);
    document.getElementById('scrim').addEventListener('click', close);
    document.getElementById('checkoutBtn').addEventListener('click', checkout);
    render();
  }

  async function checkout() {
    if (items.length === 0) { toast('Your cart is empty'); return; }

    const cfg = window.EPICPRINTS_CONFIG || {};
    if (!cfg.STRIPE_PUBLISHABLE_KEY) {
      toast('Add a Stripe key in assets/js/config.js to enable real checkout');
      return;
    }
    if (typeof window.Stripe !== 'function') {
      toast('Stripe.js failed to load');
      return;
    }

    const btn = document.getElementById('checkoutBtn');
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = 'Redirecting…';

    try {
      const res = await fetch(cfg.CHECKOUT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, currency: cfg.CURRENCY || 'usd' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.url) {
        window.location.assign(data.url);
        return;
      }
      if (data.id) {
        const stripe = window.Stripe(cfg.STRIPE_PUBLISHABLE_KEY);
        await stripe.redirectToCheckout({ sessionId: data.id });
        return;
      }
      throw new Error('No session URL returned');
    } catch (e) {
      toast(`Checkout failed: ${e.message}`);
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  return { init, add, remove, clear };
})();

// =====================================================
// TOAST
// =====================================================
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('is-show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-show'), 2400);
}

// =====================================================
// BOOT
// =====================================================
document.getElementById('year').textContent = new Date().getFullYear();

initHero();
initMaterialCards();
initShop();
Customizer.init();
initAbout();
Cart.init();
