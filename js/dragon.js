(() => {
  "use strict";

  const layer = document.getElementById("dragon-layer");
  const dragonHost = document.getElementById("dragon");
  if (!layer || !dragonHost) return;

  // ===== SVG (stile serio / tradizionale, non cartoon) =====
  // Se vuoi ancora più dettagli (artigli/barba lunga), lo faccio dopo: qui è già pulito/pro.
  dragon.innerHTML = `
<svg viewBox="0 0 760 420" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Dorso (marrone) -->
    <linearGradient id="backGrad" x1="0" y1="0.2" x2="1" y2="0.8">
      <stop offset="0" stop-color="#3a1c12"/>
      <stop offset="0.35" stop-color="#6b3a24"/>
      <stop offset="0.7" stop-color="#8b4a2f"/>
      <stop offset="1" stop-color="#2a120c"/>
    </linearGradient>

    <!-- Pancia (gialla) -->
    <linearGradient id="bellyGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#f3d98c"/>
      <stop offset="0.55" stop-color="#d9b382"/>
      <stop offset="1" stop-color="#b88945"/>
    </linearGradient>

    <!-- Linee/ombra soft -->
    <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="2.2" result="b"/>
      <feColorMatrix in="b" type="matrix"
        values="1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 .55 0" result="s"/>
      <feMerge>
        <feMergeNode in="s"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <!-- Pattern “scaglie” discreto -->
    <pattern id="scales" width="22" height="14" patternUnits="userSpaceOnUse">
      <path d="M1,13 C6,4 16,4 21,13" fill="none" stroke="rgba(246,243,239,0.16)" stroke-width="1.2" />
      <path d="M-10,13 C-5,4 5,4 10,13" fill="none" stroke="rgba(246,243,239,0.10)" stroke-width="1.1" />
    </pattern>
  </defs>

  <!-- Corpo principale (silhouette) -->
  <path filter="url(#softShadow)"
        d="M92,258
           C130,198 190,195 230,232
           C275,274 330,282 382,250
           C435,218 448,168 498,150
           C555,130 602,158 620,204
           C636,246 674,270 712,252
           C742,238 756,208 750,176
           C744,146 718,126 686,132
           C655,138 633,164 616,176
           C599,188 570,176 552,152
           C532,126 500,106 460,116
           C420,126 406,154 386,168
           C364,184 330,182 304,156
           C276,128 238,104 196,128
           C150,154 128,206 92,258
           Z"
        fill="url(#backGrad)"
        stroke="rgba(0,0,0,0.40)"
        stroke-width="2.4"/>

  <!-- Scaglie leggere sopra il dorso -->
  <path d="M118,242
           C152,206 198,206 230,236
           C280,282 336,286 386,256
           C440,224 454,176 502,160
           C554,142 592,168 608,206
           C624,244 666,266 706,248"
        fill="none"
        stroke="url(#backGrad)"
        stroke-width="18"
        opacity="0.20"/>
  <path d="M118,242
           C152,206 198,206 230,236
           C280,282 336,286 386,256
           C440,224 454,176 502,160
           C554,142 592,168 608,206
           C624,244 666,266 706,248"
        fill="none"
        stroke="url(#scales)"
        stroke-width="22"
        opacity="0.65"/>

  <!-- Pancia (sottostrato) -->
  <path d="M150,240
           C176,214 204,214 228,240
           C274,288 336,294 390,260
           C444,226 456,184 498,170
           C542,154 574,172 590,204
           C606,236 646,252 682,238
           C646,248 604,228 586,190
           C568,154 528,144 492,156
           C454,170 438,212 388,238
           C336,266 270,256 232,220
           C204,194 178,196 150,240
           Z"
        fill="url(#bellyGrad)"
        opacity="0.95"
        stroke="rgba(0,0,0,0.18)"
        stroke-width="1.8"/>

  <!-- Testa (più definita) -->
  <path d="M60,260
           C36,244 34,214 56,196
           C80,176 118,180 144,202
           C162,218 168,244 152,262
           C134,282 110,292 86,290
           C76,288 68,284 60,260
           Z"
        fill="url(#backGrad)"
        stroke="rgba(0,0,0,0.45)"
        stroke-width="2.6"/>

  <!-- Mascella / pancia testa -->
  <path d="M74,264
           C88,252 104,252 120,262
           C132,270 134,282 120,290
           C104,298 88,296 78,286
           C70,278 68,270 74,264
           Z"
        fill="url(#bellyGrad)"
        opacity="0.9"
        stroke="rgba(0,0,0,0.18)"
        stroke-width="1.4"/>

  <!-- Occhio -->
  <ellipse cx="104" cy="228" rx="7.5" ry="6.5" fill="#120806"/>
  <circle cx="106.5" cy="226.5" r="2.2" fill="#f6f3ef" opacity="0.9"/>

  <!-- Corna (sobrie, non cartoon) -->
  <path d="M78,190 C66,164 72,144 92,132"
        fill="none" stroke="rgba(217,179,130,0.92)" stroke-width="6" stroke-linecap="round"/>
  <path d="M110,188 C104,164 116,142 140,138"
        fill="none" stroke="rgba(217,179,130,0.90)" stroke-width="6" stroke-linecap="round"/>

  <!-- Baffi (fluidi, eleganti) -->
  <path d="M40,238 C70,236 86,226 98,214"
        fill="none" stroke="rgba(246,243,239,0.75)" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M44,254 C78,258 98,250 116,236"
        fill="none" stroke="rgba(246,243,239,0.60)" stroke-width="2.0" stroke-linecap="round"/>

  <!-- Cresta dorsale (triangolini discreti) -->
  <path d="M210,208 L222,184 L234,210
           M284,244 L298,220 L310,246
           M360,256 L374,232 L386,258
           M438,236 L452,214 L464,240
           M516,180 L530,158 L542,184
           M600,206 L614,182 L626,210"
        fill="none" stroke="rgba(246,243,239,0.18)" stroke-width="4" stroke-linecap="round"/>

  <!-- Leggero highlight sul dorso -->
  <path d="M128,232
           C158,204 198,204 226,230
           C274,274 334,276 382,246
           C432,216 444,172 492,156
           C544,138 586,164 604,204"
        fill="none"
        stroke="rgba(246,243,239,0.10)"
        stroke-width="10"
        stroke-linecap="round"/>
</svg>
`;

  // ===== movimento continuo a velocità costante =====
  const mqMobile = window.matchMedia("(max-width: 768px)");
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);

  // Parametri “seri”
  const SPEED = 70;             // px/sec costante (se vuoi più lento: 50)
  const TURN_RATE = 0.85;       // “serpente” (se vuoi più serpente: 1.1)
  const SNAKE_AMP = 10;         // ondulazione laterale (se vuoi più sobria: 6)
  const SCROLL_K = 0.12;        // reazione scroll
  const MARGIN = 14;

  // stato
  let vw = window.innerWidth, vh = window.innerHeight;
  let x = vw * 0.65, y = vh * 0.35;
  let ang = rand(0, Math.PI * 2);
  let last = 0;
  let t = 0;

  // scroll
  let lastScrollY = window.scrollY;
  let scrollKick = 0;

  function navSafePx() {
    const nav = document.querySelector(".nav");
    if (!nav) return 70;
    const r = nav.getBoundingClientRect();
    return Math.max(60, Math.round(r.height + 16));
  }

  function dragonSize() {
    const r = dragonHost.getBoundingClientRect();
    return { w: r.width || 160, h: r.height || 90 };
  }

  function updateViewport() {
    vw = window.innerWidth;
    vh = window.innerHeight;
  }
  window.addEventListener("resize", updateViewport, { passive: true });

  window.addEventListener("scroll", () => {
    const sy = window.scrollY;
    const d = sy - lastScrollY;
    lastScrollY = sy;
    scrollKick += d * SCROLL_K;
    scrollKick = clamp(scrollKick, -28, 28);
  }, { passive: true });

  // “davanti” raro e professionale (desktop)
  let nextDepthAt = performance.now() + 9000;
  let front = false;

  function depthToggle(now) {
    if (mqMobile.matches) {
      if (front) { front = false; layer.classList.remove("is-front"); }
      return;
    }
    if (now < nextDepthAt) return;
    front = !front;
    layer.classList.toggle("is-front", front);
    nextDepthAt = now + 12000; // raramente
  }

  function tick(now) {
    if (!last) last = now;
    let dt = (now - last) / 1000;
    dt = Math.min(dt, 0.05);
    last = now;

    depthToggle(now);

    t += dt;

    // curva continua (serpente) senza target/stop
    const drift =
      Math.sin(t * 0.85) * 0.55 +
      Math.sin(t * 0.33) * 0.35;

    ang += drift * TURN_RATE * dt;

    // velocità costante
    const vx = Math.cos(ang);
    const vy = Math.sin(ang);

    x += vx * SPEED * dt;
    y += vy * SPEED * dt;

    // scroll kick morbido
    if (Math.abs(scrollKick) > 0.01) {
      y += scrollKick;
      scrollKick *= Math.pow(0.001, dt * 6.5);
    }

    // ondulazione laterale (perp)
    const wave = Math.sin(t * 1.2);
    x += Math.cos(ang + Math.PI / 2) * wave * SNAKE_AMP * dt * 10;
    y += Math.sin(ang + Math.PI / 2) * wave * SNAKE_AMP * dt * 10;

    // clamp in viewport + safe area nav
    const { w, h } = dragonSize();
    const topSafe = navSafePx() + MARGIN;

    // rimbalzo sui bordi senza “fermarsi”
    if (x < MARGIN) { x = MARGIN; ang = Math.PI - ang; }
    if (x > vw - w - MARGIN) { x = vw - w - MARGIN; ang = Math.PI - ang; }
    if (y < topSafe) { y = topSafe; ang = -ang; }
    if (y > vh - h - MARGIN) { y = vh - h - MARGIN; ang = -ang; }

    // prospettiva sobria (legata alla y)
    const depth = front ? 1.06 : (0.94 + (y / vh) * 0.08);

    // rotazione “seria” (poca)
    const rot = (ang * 180 / Math.PI) * 0.18;

    dragonHost.style.transform =
      `translate3d(${x}px, ${y}px, 0) rotate(${rot}deg) scale(${depth})`;

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
})();
