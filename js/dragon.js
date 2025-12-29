(() => {
  const layer = document.getElementById("dragon-layer");
  const dragon = document.getElementById("dragon");
  if (!layer || !dragon) return;

  // SVG dragone (brown dorsale + belly giallo)
  dragon.innerHTML = `
  <svg viewBox="0 0 520 320" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="backGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#6a3a22"/>
        <stop offset="0.55" stop-color="#8b4a2f"/>
        <stop offset="1" stop-color="#4a2416"/>
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

    <!-- corpo -->
    <path filter="url(#soft)" fill="url(#backGrad)" stroke="rgba(0,0,0,0.35)" stroke-width="2"
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

    <!-- pancia -->
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

    <!-- testa -->
    <path fill="url(#backGrad)" stroke="rgba(0,0,0,0.35)" stroke-width="2"
      d="M32,196
         C20,178 22,158 36,146
         C52,132 74,132 92,146
         C105,156 108,172 100,184
         C92,196 80,204 62,206
         C48,208 40,204 32,196
         Z" />

    <!-- occhio -->
    <circle cx="70" cy="168" r="6" fill="#1a0f0a"/>
    <circle cx="72" cy="166" r="2" fill="#f6f3ef"/>

    <!-- corna -->
    <path d="M44,148 C34,134 34,120 48,110 C58,103 68,106 74,118"
          fill="none" stroke="rgba(245,223,170,0.9)" stroke-width="4" stroke-linecap="round"/>
    <path d="M62,142 C58,126 66,112 84,108 C98,106 104,116 102,130"
          fill="none" stroke="rgba(245,223,170,0.9)" stroke-width="4" stroke-linecap="round"/>

    <!-- baffi -->
    <path d="M18,188 C40,182 52,176 60,166"
          fill="none" stroke="rgba(231,215,195,0.85)" stroke-width="2" stroke-linecap="round"/>
    <path d="M20,200 C46,196 62,188 72,178"
          fill="none" stroke="rgba(231,215,195,0.85)" stroke-width="2" stroke-linecap="round"/>

    <!-- spine -->
    <path d="M140,150 L150,135 L160,152" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="2" />
    <path d="M210,132 L222,118 L235,134" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="2" />
    <path d="M300,138 L312,122 L324,140" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="2" />
    <path d="M392,150 L404,134 L416,152" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="2" />
  </svg>
  `;

  const rand = (a, b) => a + Math.random() * (b - a);
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
    return { w: r.width || 140, h: r.height || 90 };
  }

  const st = {
    x: 40, y: 140,
    tx: 240, ty: 160,
    rot: 0, trot: 0,
    scale: 1, tScale: 1,
    front: false,
    nextTargetAt: 0,
    nextDepthAt: 0,
    lastT: performance.now(),
    scrollY: window.scrollY,
    scrollKick: 0
  };

  function pickNewTarget(now) {
    const { w, h } = sizePx();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const margin = 14;
    const topSafe = navSafePx() + margin;

    st.tx = rand(margin, vw - w - margin);
    st.ty = rand(topSafe, vh - h - margin);

    st.trot = rand(-6, 6);
    st.tScale = st.front ? rand(1.08, 1.22) : rand(0.92, 1.08);

    st.nextTargetAt = now + rand(isMobile ? 2600 : 2200, isMobile ? 5200 : 6800);
  }

  function maybeToggleDepth(now) {
    if (isMobile) {
      st.front = false;
      layer.classList.remove("is-front");
      st.nextDepthAt = now + 9999999;
      return;
    }

    if (now < st.nextDepthAt) return;

    st.front = !st.front;
    layer.classList.toggle("is-front", st.front);
    st.tScale = st.front ? rand(1.08, 1.22) : rand(0.92, 1.08);

    st.nextDepthAt = now + rand(2600, 5200);
  }

  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    const d = y - st.scrollY;
    st.scrollY = y;

    st.scrollKick += d * 0.10;
    st.scrollKick = clamp(st.scrollKick, -24, 24);
  }, { passive: true });

  function tick(now) {
    const dt = Math.min(0.05, (now - st.lastT) / 1000);
    st.lastT = now;

    if (now > st.nextTargetAt) pickNewTarget(now);
    maybeToggleDepth(now);

    const ease = isMobile ? 1.2 : 0.9;
    st.x += (st.tx - st.x) * (1 - Math.pow(0.001, dt * ease));
    st.y += (st.ty - st.y) * (1 - Math.pow(0.001, dt * ease));

    if (Math.abs(st.scrollKick) > 0.01) {
      st.y += st.scrollKick;
      st.scrollKick *= Math.pow(0.001, dt * 6.5);
    }

    const { w, h } = sizePx();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 14;
    const topSafe = navSafePx() + margin;

    st.x = clamp(st.x, margin, vw - w - margin);
    st.y = clamp(st.y, topSafe, vh - h - margin);

    st.rot += (st.trot - st.rot) * (1 - Math.pow(0.001, dt * 8));
    st.scale += (st.tScale - st.scale) * (1 - Math.pow(0.001, dt * 6));

    const facing = st.tx < st.x ? -1 : 1;

    dragon.style.transform =
      `translate(${st.x}px, ${st.y}px) scale(${st.scale * facing}, ${st.scale}) rotate(${st.rot}deg)`;

    requestAnimationFrame(tick);
  }

  pickNewTarget(performance.now());
  st.nextDepthAt = performance.now() + (isMobile ? 999999 : rand(1800, 3200));
  requestAnimationFrame(tick);
})();
