(function () {
  const overlay = document.getElementById("page-transition");
  if (!overlay) return;

  const OUT_DELAY = 700; // overlay visibile prima del cambio pagina
  const IN_DELAY  = 380; // overlay visibile dopo l'arrivo

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

  document.addEventListener("DOMContentLoaded", () => {
    if (consumeFlag()) {
      show();
      requestAnimationFrame(() => setTimeout(hide, IN_DELAY));
    } else {
      hide();
    }
  });

  window.addEventListener("pageshow", () => {
    navigating = false;
    hide();
    try { sessionStorage.removeItem(FLAG); } catch {}
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

    // solo hash-change stessa pagina => no transizione
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

    // IMPORTANTISSIMO: blocca subito la navigazione e gli altri handler
    e.preventDefault();
    e.stopImmediatePropagation();

    show();

    try { sessionStorage.setItem(FLAG, "1"); } catch {}

    // forza paint prima del redirect
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          window.location.href = url.toString();
        }, OUT_DELAY);
      });
    });
  }

  // capture=true: gira prima di eventuali onclick/altri listener
  document.addEventListener("click", handler, true);
})();
