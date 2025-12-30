(function () {
  const overlay = document.getElementById("page-transition");
  if (!overlay) return;

  const FLAG = "pt_pending";
  let navigating = false;

  const show = () => overlay.classList.add("is-active");
  const hide = () => overlay.classList.remove("is-active");

  const consumeFlag = () => {
    try {
      const v = sessionStorage.getItem(FLAG);
      sessionStorage.removeItem(FLAG);
      return v === "1";
    } catch { return false; }
  };

  document.addEventListener("DOMContentLoaded", () => {
    if (consumeFlag()) {
      show();
      requestAnimationFrame(() => setTimeout(hide, 220));
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
    return href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:");
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
    if (url.origin !== window.location.origin) return;

    const samePath = url.pathname === window.location.pathname;
    const sameSearch = url.search === window.location.search;
    const onlyHashChange = samePath && sameSearch && url.hash;
    if (onlyHashChange) return;

    if (navigating) { e.preventDefault(); return; }
    navigating = true;

    e.preventDefault();
    show();

    try { sessionStorage.setItem(FLAG, "1"); } catch {}

    /* doppio RAF = garantisce il paint dell’overlay */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          window.location.href = url.toString();
        }, 420); // più lungo: l’overlay si vede sempre
      });
    });
  });
})();
