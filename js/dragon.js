(() => {
  const layer = document.getElementById("dragon-layer");
  const svg = document.getElementById("dragon-svg");
  const root = document.getElementById("dragon-root");
  const segGroup = document.getElementById("dragon-segments");
  const head = document.getElementById("dragon-head");
  if (!layer || !svg || !root || !segGroup || !head) return;

  const mqMobile = window.matchMedia("(max-width: 768px)");

  // ======= PARAMETRI “SERIO/REALISTICO” =======
  const SPEED = 34;              // px/sec (lento e costante)
  const SWITCH_DEPTH_EVERY = 10; // secondi (gioco prospettiva raro, professionale)
  const BODY_SEG_DESKTOP = 22;
  const BODY_SEG_MOBILE = 14;

  // corpo (in unità SVG)
  const BODY_START_X = 240;     // dietro la testa
  const BODY_BASE_Y  = 235;
  const BODY_LEN     = 820;
  const AMP_DESKTOP  = 22;      // ampiezza ondulazione (realistica, non cartoon)
  const AMP_MOBILE   = 14;
  const WAVE_FREQ    = 1.10;    // frequenza ondulazione
  const PHASE_SHIFT  = 0.40;    // fase lungo i segmenti (serpente)
  const TAPER        = 0.78;    // assottigliamento verso la coda

  // ======= viewport + safe top =======
  let vw = window.innerWidth, vh = window.innerHeight;

  function navSafePx(){
    const nav = document.querySelector(".nav");
    if (!nav) return 70;
    const r = nav.getBoundingClientRect();
    return Math.max(60, Math.round(r.height + 16));
  }

  function updateViewport(){
    vw = window.innerWidth;
    vh = window.innerHeight;
  }
  window.addEventListener("resize", updateViewport, { passive: true });

  // ======= costruisci segmenti corpo (una sola volta) =======
  function clearSegments(){
    while (segGroup.firstChild) segGroup.removeChild(segGroup.firstChild);
  }

  function buildSegments(){
    clearSegments();

    const n = mqMobile.matches ? BODY_SEG_MOBILE : BODY_SEG_DESKTOP;
    const dx = BODY_LEN / (n - 1);

    for (let i = 0; i < n; i++){
      const u = i / (n - 1);
      // “spessore” segmenti: più grosso vicino testa, più piccolo verso coda
      const scale = 1 - u * (1 - TAPER);
      const w = 84 * scale;
      const h = 46 * scale;

      // segment shape (ovale con bordo)
      const seg = document.createElementNS("http://www.w3.org/2000/svg", "g");
      seg.setAttribute("data-i", String(i));

      const back = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
      back.setAttribute("cx", "0");
      back.setAttribute("cy", "0");
      back.setAttribute("rx", String(w / 2));
      back.setAttribute("ry", String(h / 2));
      back.setAttribute("fill", "url(#dgBack)");
      back.setAttribute("stroke", "rgba(0,0,0,0.35)");
      back.setAttribute("stroke-width", "2");

      const scales = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
      scales.setAttribute("cx", "0");
      scales.setAttribute("cy", "0");
      scales.setAttribute("rx", String((w / 2) * 0.92));
      scales.setAttribute("ry", String((h / 2) * 0.86));
      scales.setAttribute("fill", "url(#dgScales)");
      scales.setAttribute("opacity", "0.70");

      const belly = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
      belly.setAttribute("cx", "0");
      belly.setAttribute("cy", String(h * 0.14));
      belly.setAttribute("rx", String((w / 2) * 0.62));
      belly.setAttribute("ry", String((h / 2) * 0.46));
      belly.setAttribute("fill", "url(#dgBelly)");
      belly.setAttribute("opacity", "0.88");
      belly.setAttribute("stroke", "rgba(0,0,0,0.14)");
      belly.setAttribute("stroke-width", "1.4");

      seg.appendChild(back);
      seg.appendChild(scales);
      seg.appendChild(belly);
      segGroup.appendChild(seg);

      // posizione base (X lungo corpo), Y verrà animato
      seg._baseX = BODY_START_X + i * dx;
      seg._u = u;
    }

    // testa sempre davanti ai segmenti
    head.parentNode.appendChild(head);
  }

  buildSegments();
  mqMobile.addEventListener?.("change", buildSegments);

  // ======= movimento rettilineo sullo schermo =======
  let x = 30;
  let y = Math.round(vh * 0.33);
  let dir = 1; // 1 => verso destra, -1 => verso sinistra
  let t = 0;
  let last = 0;

  // profondità (davanti/dietro) raro, non “giocoso”
  let nextDepthSwitch = 0;
  let front = false;

  function switchDepth(nowSec){
    if (mqMobile.matches){
      front = false;
      layer.classList.remove("is-front");
      return;
    }
    if (nowSec < nextDepthSwitch) return;
    front = !front;
    layer.classList.toggle("is-front", front);
    nextDepthSwitch = nowSec + SWITCH_DEPTH_EVERY;
  }

  function placeOnScreen(){
    const rect = svg.getBoundingClientRect();
    const w = rect.width || 520;
    const h = rect.height || 180;

    const topSafe = navSafePx() + 10;

    // clamp verticale dentro viewport
    y = Math.max(topSafe, Math.min(y, vh - h - 10));

    // rimbalzo ai bordi (rettilineo)
    x += dir * SPEED * (1/60); // verrà sovrascritto da dt nel tick
    // (placeholder)
  }

  function tick(now){
    if (!last) last = now;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    updateViewport();

    t += dt;
    const nowSec = now / 1000;

    // prospettiva tra elementi: passa dietro/davanti
    switchDepth(nowSec);

    // posizionamento su schermo: rettilineo costante
    const rect = svg.getBoundingClientRect();
    const w = rect.width || 520;
    const h = rect.height || 180;

    const topSafe = navSafePx() + 10;

    // velocità costante
    x += dir * SPEED * dt;

    // rimbalzo bordi senza fermarsi
    if (x <= 10){
      x = 10;
      dir = 1;
    }
    if (x >= vw - w - 10){
      x = vw - w - 10;
      dir = -1;
    }

    // Y quasi fisso, ma sempre dentro viewport
    y = Math.max(topSafe, Math.min(y, vh - h - 10));

    // applica traslazione al SVG (NO top/left, solo transform)
    svg.style.transform = `translate3d(${x}px, ${y}px, 0)`;

    // ======= ondulazione del corpo (serpente) =======
    const amp = mqMobile.matches ? AMP_MOBILE : AMP_DESKTOP;

    // leggera “compressione” prospettica quando è dietro
    const depthScale = front ? 1.00 : 0.94;
    root.setAttribute("transform", `scale(${depthScale})`);

    const segs = segGroup.children;
    const n = segs.length;

    for (let i = 0; i < n; i++){
      const seg = segs[i];
      const u = seg._u;

      // offset ondulazione: fase cambia lungo il corpo
      const wave = Math.sin((t * Math.PI * 2) * WAVE_FREQ - (i * PHASE_SHIFT));
      const yOff = wave * amp * (0.85 + (1 - u) * 0.15); // più vivo verso testa

      // angolo (tangente) stimato
      const waveNext = Math.sin((t * Math.PI * 2) * WAVE_FREQ - ((i + 1) * PHASE_SHIFT));
      const yOffNext = waveNext * amp * (0.85 + (1 - u) * 0.15);
      const dx = (n > 1) ? (BODY_LEN / (n - 1)) : 1;
      const ang = Math.atan2((yOffNext - yOff), dx) * (180 / Math.PI);

      // posiziona segmento
      seg.setAttribute(
        "transform",
        `translate(${seg._baseX}, ${BODY_BASE_Y + yOff}) rotate(${ang})`
      );
    }

    requestAnimationFrame(tick);
  }

  // init Y stabile e “pulito”
  y = Math.round(vh * 0.33);
  nextDepthSwitch = performance.now()/1000 + 4.5;

  requestAnimationFrame(tick);
})();
