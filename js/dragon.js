
  
  // ====== PARAMETRI (modifica qui) ======
  const SPEED_PX_PER_SEC = 70;     // velocità costante (più basso = più “serio”)
  const TURN_RATE = 0.9;           // quanto “serpente” curva (0.6-1.2 consigliato)
  const DEPTH_MIN = 0.92;          // effetto prospettiva (sobrio)
  const DEPTH_MAX = 1.05;
  const SCROLL_INFLUENCE = 0.28;   // reagisce allo scroll (senza mouse)
  const MARGIN = 14;               // resta sempre in inquadratura

  let dragon, w = 0, h = 0;
  let x = 0, y = 0;                // posizione
  let vx = 1, vy = 0;              // direzione normalizzata
  let t = 0;                       // tempo interno
  let last = 0;
  let lastScrollY = window.scrollY;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function len(ax, ay) { return Math.hypot(ax, ay) || 1; }

  function updateBounds() {
    w = window.innerWidth;
    h = window.innerHeight;
  }

  function ensureInside() {
    x = clamp(x, MARGIN, w - MARGIN);
    y = clamp(y, MARGIN, h - MARGIN);
  }

  function reflectIfNeeded() {
    // rimbalzo morbido sui bordi senza fermarsi
    if (x <= MARGIN) { x = MARGIN; vx = Math.abs(vx); }
    if (x >= w - MARGIN) { x = w - MARGIN; vx = -Math.abs(vx); }
    if (y <= MARGIN) { y = MARGIN; vy = Math.abs(vy); }
    if (y >= h - MARGIN) { y = h - MARGIN; vy = -Math.abs(vy); }

    // rinormalizza direzione
    const L = len(vx, vy);
    vx /= L; vy /= L;
  }

  function createDragon() {
    dragon = document.createElement("div");
    dragon.id = "dragon";

    // === INCOLLA QUI IL TUO SVG COMPLETO (quello marrone/giallo) ===
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

    document.body.appendChild(dragon);
  }

  function tick(now) {
    if (!last) last = now;
    // delta-time in secondi (cap per evitare “salti” quando il browser lagga)
    let dt = (now - last) / 1000;
    dt = Math.min(dt, 0.05);
    last = now;

    // tempo interno
    t += dt;

    // === Curvatura “serpente” (moto continuo, mai fermo) ===
    // direzione desiderata = direzione attuale + piccolo drift sinusoidale “serio”
    const drift = Math.sin(t * 0.8) * 0.35 + Math.sin(t * 0.31) * 0.22;
    // ruota la direzione attuale lentamente (turn rate)
    const angle = Math.atan2(vy, vx) + drift * TURN_RATE * dt;

    vx = Math.cos(angle);
    vy = Math.sin(angle);

    // === Scroll reaction (senza mouse) ===
    const sy = window.scrollY;
    const deltaScroll = sy - lastScrollY;
    lastScrollY = sy;

    // applica un “trascinamento” verticale proporzionale allo scroll
    // (mantiene velocità costante, aggiunge solo un offset morbido)
    y += deltaScroll * SCROLL_INFLUENCE;

    // === Movimento a velocità costante ===
    x += vx * SPEED_PX_PER_SEC * dt;
    y += vy * SPEED_PX_PER_SEC * dt;

    // resta sempre in viewport
    ensureInside();
    reflectIfNeeded();

    // === Prospettiva sobria (sempre visibile, professionale) ===
    // profondità legata alla Y (più in basso = leggermente più “vicino”)
    const depth = DEPTH_MIN + (y / h) * (DEPTH_MAX - DEPTH_MIN);

    // rotazione leggera verso la direzione di moto (non cartoon)
    const rot = (Math.atan2(vy, vx) * 180 / Math.PI) * 0.35;

    // IMPORTANT: solo transform (niente top/left → niente scatti)
    dragon.style.transform =
      `translate3d(${x}px, ${y}px, 0) scale(${depth}) rotate(${rot}deg)`;

    requestAnimationFrame(tick);
  }

  // ===== init =====
  window.addEventListener("DOMContentLoaded", () => {
    updateBounds();
    createDragon();

    // posizione iniziale (sempre visibile)
    x = rand(MARGIN, w - MARGIN);
    y = rand(MARGIN, h - MARGIN);

    // direzione iniziale
    const a = rand(0, Math.PI * 2);
    vx = Math.cos(a);
    vy = Math.sin(a);

    requestAnimationFrame(tick);
  });

  window.addEventListener("resize", () => {
    updateBounds();
    ensureInside();
  });
})();
