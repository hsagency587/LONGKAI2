/* ===============================
   PAGE TRANSITION (OVERLAY DRAGO)
   =============================== */

#page-transition{
  position: fixed;
  inset: 0;
  z-index: 99999;
  pointer-events: none;

  opacity: 0;
  visibility: hidden;
  transition: opacity 320ms ease, visibility 0s linear 320ms;

  /* velo scuro coerente col tuo background */
  background: rgba(10,7,6,0.90);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

#page-transition.is-active{
  opacity: 1;
  visibility: visible;
  transition: opacity 320ms ease;
}

#page-transition .pt-center{
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%,-50%);
  text-align: center;
}

#page-transition .pt-dragon{
  position: relative;
  font-family: 'Playfair Display', serif;
  font-size: 64px;
  line-height: 1;
  color: rgba(217,179,130,0.92); /* secondary */
  text-shadow: 0 0 18px rgba(217,179,130,0.35), 0 0 40px rgba(217,179,130,0.18);

  padding: 18px 44px;
  border-radius: 999px;

  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.20);
  box-shadow: 0 18px 50px rgba(0,0,0,0.45);
}

/* Aura con conic-gradient, ruota lentamente */
#page-transition .pt-dragon::before{
  content: "";
  position: absolute;
  inset: -36px;
  border-radius: 999px;

  background: conic-gradient(
    from 0deg,
    rgba(217,179,130,0.00),
    rgba(217,179,130,0.55),
    rgba(217,179,130,0.00)
  );

  filter: blur(10px);
  opacity: 0.80;

  animation: pt-rotate 1.05s linear infinite;
  z-index: -1;
}

#page-transition .pt-label{
  margin-top: 16px;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(246,243,239,0.78);
}

/* Riduce animazioni se l’utente lo richiede */
@media (prefers-reduced-motion: reduce){
  #page-transition,
  #page-transition .pt-dragon::before{
    transition: none !important;
    animation: none !important;
  }
}

@keyframes pt-rotate{
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.section .text .pay-btn {
  display: inline-block;         /* necessario per far “sentire” i margini */
  margin-top: 8px;               /* ulteriore aria sopra il bottone */
}
html.pt-pending #page-transition{
  opacity: 1;
  visibility: visible;
  transition: none;
}

