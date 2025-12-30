(function () {
  const overlay = document.getElementById("page-transition");
  if (!overlay) return;

  const FLAG = "dragon_transition_pending";
  let isNavigating = false;

  function hideOverlay() {
    overlay.classList.remove("is-active");
    document.documentElement.classList.remove("pt-pending");
  }

  function showOverlay() {
    overlay.classList.add("is-active");
  }

  // IMPORTANTISSIMO: gestisce anche il tasto indietro/avanti (bfcache)
  window.addEventListener("pageshow", () => {
    const pending = sessionStorage.getItem(FLAG) === "1";

    // Se arriviamo da una navigazione animata: overlay visibile subito e poi sfuma via
    if (pending || document.documentElement.classList.contains("pt-pending")) {
      showOverlay();
      sessionStorage.removeItem(FLAG);

      requestAnimationFrame(() => {
        setTimeout(hideOverlay, 160);
      });
      return;
    }

    // Se torno indietro e la pagina è ripristinata: assicura overlay spento
    hideOverlay();
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
    try {
      url = new URL(a.href, window.location.href);
    } catch {
      return;
    }

    if (isExternal(a)) return;

    // Se è solo hash-change nella stessa pagina, non animare
    const samePath = url.pathname === window.location.pathname;
    const sameSearch = url.search === window.location.search;
    const onlyHashChange = samePath && sameSearch && url.hash;
    if (onlyHashChange) return;

    if (isNavigating) {
      e.preventDefault();
      return;
    }
    isNavigating = true;

    e.preventDefault();

    // Overlay in uscita
    showOverlay();

    // Prepara overlay in entrata (pagina di arrivo)
    sessionStorage.setItem(FLAG, "1");

    // Forza un frame di paint, poi naviga
    requestAnimationFrame(() => {
      setTimeout(() => {
        window.location.href = url.toString();
      }, 240);
    });
  });
})();
      window.location.href = url.toString();
    }, 220);
  });
})();
