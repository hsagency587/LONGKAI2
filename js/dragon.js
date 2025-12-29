(() => {
  const layer = document.getElementById("dragon-layer");
  const dragon = document.getElementById("dragon");
  if (!layer || !dragon) return;

  // SVG serio (non cartoon). Se vuoi un SVG più dettagliato, lo sostituiamo qui dentro.
  dragon.innerHTML = `
  <svg viewBox="0 0 520 320" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="backGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#5f321f"/>
        <stop offset="0.55" stop-color="#8b4a2f"/>
        <stop offset="1" stop-color="#3b1c12"/>
      </linearGradient>
      <linearGradient id="bellyGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#f1d07a"/>
        <stop offset="0.6" stop-color="#d9b382"/>
        <stop offset="1" stop-color="#b88a49"/>
      </linearGradient>
      <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="1.2" result="b"/>
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
    </defs>

    <path filter="url(#soft)" fill="url(#backGrad)" stroke="rgba(0,0,0,0.38)" stroke-width="2"
      d="M55,190
         C80,150 120,150 145,175
         C175,210 205,220 240,205
         C270,190 280,160 310,150
         C340,138 370,150 385,175
         C400,200 425,215 455,205
         C485,195 500,170 505,150
         C510,130 498,108 475,102
         C450,96 425,114 410,128
         C395,142 370,132 355,112
         C340,92 315,80 285,88
         C255,96 250,120 235,132
         C220,144 190,140 170,120
         C150,100 120,85 92,100
         C62,116 45,150 55,190
         Z" />

    <path fill="url(#bellyGrad)" opacity="0.95" stroke="rgba(0,0,0,0.20)" stroke-width="1.5"
      d="M90,176
         C110,160 130,160 148,176
         C175,200 205,206 235,192
         C265,178 280,150 305,145
         C330,140 350,152 362,172
         C374,192 400,202 425,194
         C450,186 468,166 475,152
         C468,162 452,174 430,178
         C404,182 384,170 372,150
         C360,130 336,122 308,128
         C280,134 268,162 240,176
         C212,190 176,184 150,164
         C130,148 108,150 90,176
         Z" />

    <path fill="url(#backGrad)" stroke="rgba(0,0,0,0.38)" stroke-width="2"
      d="M32,196
         C20,178 22,158 36,146
         C52,132 74,132 92,146
         C105,156 108,172 100,184
         C92,196 80,204 62,206
         C48,208 40,204 32,196
         Z" />

    <circle cx="70" cy="168" r="6" fill="#1a0f0a"/>
    <circle cx="72" cy="166" r="2" fill="#f6f3ef"/>

    <path d="M44,148 C34,134 34,120 48,110 C58,103 68,106 74,118"
          fill="none" stroke="rgba(245,223,170,0.9)" stroke-width="4" stroke-linecap="round"/>
    <path d="M62,142 C58,126 66,112 84,108 C98,106 104,116 102,130"
          fill="none" stroke="rgba(245,223,170,0.9)" stroke-width="4" stroke-linecap="round"/>

    <path d="M18,188 C40,182 52,176 60,166"
          fill="none" stroke="rgba(231,215,195,0.80)" stroke-width="2" stroke-linecap="round"/>
    <path d="M20,200 C46,196 62,188 72,178"
          fill="none" stroke="rgba(231,215,195,0.80)" stroke-width="2" stroke-linecap="round"/>
  </svg>
  `;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const isMobile = matchMedia("(max-width: 768px)").matches;

  function navSafePx() {
    const nav = document.querySelector(".nav");
    if (!nav) return 70;
    const r = nav.getBoundingClientRect();
    return Math.max(60, Math.round(r.height + 16));
  }

  function sizePx() {
    const r = dragon.getBoundingClientRect();
    return { w: r.width || 150, h: r.height || 95 };
  }

  // Stato
  let t0 = performance.now();
  let last = t0;

  // Posizione base (centro traiettoria)
  let cx = 0, cy = 0;

  // Scroll influence (smoothed)
  let scrollKick = 0;
  let scrollY = window.scrollY;

  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    const d = y - scrollY;
    scrollY = y;

    // influenza verticale dolce
    scrollKick += d * 0.12;
    scrollKick = clamp(scrollKick, -28, 28);
  }, { passive: true });

  // Movimento: traiettoria ellittica + drift con wrapping
  // velocità costante -> usiamo un parametro phase che cresce linearmente col tempo
  const speed = isMobile ? 0.09 : 0.075; // più basso = più lento
  const snakeFreq = isMobile ? 1.15 : 1.05; // ondulazione
  const snakeAmp = isMobile ? 6 : 10; // ampiezza ondulazione px
  const rotAmp = isMobile ? 2.2 : 3.5; // rotazione lieve

  // profondità: alterna raramente (professionale, non “gioco”)
  let front = false;
  let nextDepthAt = t0 + (isMobile ? 9999999 : 9000);

  function maybeDepth(now) {
    if (isMobile) return;
    if (now < nextDepthAt) return;
    front = !front;
    layer.classList.toggle("is-front", front);
    nextDepthAt = now + 12000; // cambia raramente
  }

  // Inizializza centro
  function initCenter() {
    cx = window.innerWidth * 0.68;
    cy = window.innerHeight * 0.32;
  }
  initCenter();
  window.addEventListener("resize", initCenter, { passive: true });

  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    maybeDepth(now);

    const elapsed = (now - t0) / 1000;

    const { w, h } = sizePx();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const margin = 14;
    const topSafe = navSafePx() + margin;

    // Traiettoria principale “normale”: ellisse lenta (sempre stessa velocità angolare)
    const phase = elapsed * (Math.PI * 2) * speed; // lineare => velocità regolare
    const rx = vw * 0.28;               // raggio x
    const ry = vh * 0.18;               // raggio y

    // posizione ellisse
    let x = cx + Math.cos(phase) * rx;
    let y = cy + Math.sin(phase) * ry;

    // drift lento (molto leggero, per evitare loop troppo evidente)
    x += Math.sin(phase * 0.17) * (vw * 0.03);
    y += Math.cos(phase * 0.19) * (vh * 0.02);

    // Ondulazione serpente: offset laterale lungo direzione di movimento
    // Derivata approssimata per angolo di direzione
    const dx = -Math.sin(phase) * rx;
    const dy =  Math.cos(phase) * ry;
    const ang = Math.atan2(dy, dx);

    const wave = Math.sin(elapsed * (Math.PI * 2) * snakeFreq);
    const perpX = Math.cos(ang + Math.PI / 2);
    const perpY = Math.sin(ang + Math.PI / 2);

    x += perpX * wave * snakeAmp;
    y += perpY * wave * snakeAmp;

    // Scroll kick smoothed
    if (Math.abs(scrollKick) > 0.01) {
      y += scrollKick;
      scrollKick *= Math.pow(0.001, dt * 6.5);
    }

    // Mantieni sempre in viewport
    x = clamp(x, margin, vw - w - margin);
    y = clamp(y, topSafe, vh - h - margin);

    // Orientamento: guarda la direzione, ma molto sobrio
    const deg = ang * (180 / Math.PI);
    const rot = deg * 0.10 + wave * rotAmp; // “serpente” senza esagerare

    // Scala: minima, professionale
    const s = front ? 1.08 : 0.98;

    dragon.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${s})`;

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
})();
