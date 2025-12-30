(function () {
  const overlay = document.getElementById("page-transition");
  if (!overlay) return;

  const FLAG = "dragon_transition_pending";
  let isNavigating = false;

  function hideOverlayHard() {
    overlay.classList.remove("is-active");
    document.documentElement.classList.remove("pt-pending");
    try { sessionStorage.removeItem(FLAG); } catch (e) {}
  }

  function showOverlay() {
    overlay.classList.add("is-active");
  }

  // 1) Spegnimento garantito in ARRIVO (anche se pageshow non viene intercettato)
  (function arrivalKick() {
    const pending =
      document.documentElement.classList.contains("pt-pending") ||
      (function () {
        try { return sessionStorage.getItem(FLAG) === "1"; } catch (e) { return false; }
      })();

    if (pending) {
      showOverlay();
      // togli subito il flag: evita loop/blocchi
      try { sessionStorage.removeItem(FLAG); } catch (e) {}
      // lascia comparire l’overlay e poi spegni
      requestAnimationFrame(() => setTimeout(hideOverlayHard, 180));
    } else {
      hideOverlayHard();
    }
  })();

  // 2) bfcache: indietro/avanti
  window.addEventListener("pageshow", () => {
    // quando torno indietro, garantisco overlay spento
    // (se invece era un arrivo animato, arrivalKick lo gestisce già)
    requestAnimationFrame(() => setTimeout(hideOverlayHard, 0));
  });

  // 3) ulteriore cintura di sicurezza: al load, overlay deve essere spento
  window.addEventListener("load", () => {
    setTimeout(hideOverlayHard, 0);
  });

  function isModifiedClick(e) {
    return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
  }

  function isExternal(a) {
    return a.origin !== window.location.origin;
  }

  function isSkippableHref(href) {
    if (!href) return true;
    return (
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("javascript:")
    );
  }

  document.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a) return;

    const href = a.getAttribute("href");
    if (isSkippableHref(href)) return;
    if (a.hasAttribute("download")) return;
    if (a.target && a.target !== "_self") return;
    if (isModifiedClick(e)) return;

    let url;
    try { url = new URL(a.href, window.location.href); } catch { return; }
    if (isExternal(a)) return;

    // solo hash-change stessa pagina => no transizione
    const samePath = url.pathname === window.location.pathname;
    const sameSearch = url.search === window.location.search;
    const onlyHashChange = samePath && sameSearch && url.hash;
    if (onlyHashChange) return;

    if (isNavigating) { e.preventDefault(); return; }
    isNavigating = true;

    e.preventDefault();

    showOverlay();
    try { sessionStorage.setItem(FLAG, "1"); } catch (e) {}

    requestAnimationFrame(() => {
      setTimeout(() => { window.location.href = url.toString(); }, 240);
    });
  });
})();
