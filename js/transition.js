(function () {
  const overlay = document.getElementById("page-transition");
  if (!overlay) return;

  // === TEMPI (aumenta ancora se vuoi) ===
  const OUT_DELAY = 1000; // prima del cambio pagina (andata)
  const IN_DELAY  = 850;  // dopo l'arrivo (quanto resta visibile)

  const FLAG = "pt_pending";
  let navigating = false;

  const show = () => overlay.classList.add("is-active");
  const hide = () => overlay.classList.remove("is-active");

  const consumeFlag = () => {
    try {
      const v = sessionStorage.getItem(FLAG);
      sessionStorage.removeItem(FLAG);
      return v === "1";
    } catch {
      return false;
    }
  };

  // ARRIVO: mostra e poi spegni dopo IN_DELAY
  document.addEventListener("DOMContentLoaded", () => {
    if (consumeFlag()) {
      show();
      setTimeout(hide, IN_DELAY);
    } else {
      hide();
    }
  });

  // IMPORTANTISSIMO: pageshow deve spegnere SOLO se è bfcache (indietro/avanti)
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) {
      navigating = false;
      hide();
      try { sessionStorage.removeItem(FLAG); } catch {}
    }
  });

  function isModifiedClick(e) {
    return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
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

  function handler(e) {
    const a = e.target.closest && e.target.closest("a");
    if (!a) return;

    const href = a.getAttribute("href");
    if (isSkippableHref(href)) return;
    if (a.hasAttribute("download")) return;
    if (a.target && a.target !== "_self") return;
    if (isModifiedClick(e)) return;

    let url;
    try { url = new URL(a.href, window.location.href); } catch { return; }
    if (url.origin !== window.location.origin) return;

    // solo hash-change nella stessa pagina => niente transizione
    const samePath = url.pathname === window.location.pathname;
    const sameSearch = url.search === window.location.search;
    const onlyHashChange = samePath && sameSearch && url.hash;
    if (onlyHashChange) return;

    if (navigating) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    navigating = true;

    e.preventDefault();
    e.stopImmediatePropagation();

    show();
    try { sessionStorage.setItem(FLAG, "1"); } catch {}

    // forza paint e poi aspetta OUT_DELAY
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          window.location.href = url.toString();
        }, OUT_DELAY);
      });
    });
  }

  // capture: prende il click prima di altri script
  document.addEventListener("click", handler, true);
})();
