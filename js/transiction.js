(function () {
  const overlay = document.getElementById("page-transition");
  if (!overlay) return;

  const FLAG = "dragon_transition_pending";

  // Se arrivo da una navigazione "animata", mostro overlay e lo chiudo subito dopo il load
  if (sessionStorage.getItem(FLAG) === "1") {
    overlay.classList.add("is-active");
    sessionStorage.removeItem(FLAG);

    window.addEventListener("load", () => {
      // lascia un attimo che la pagina “attacchi”, poi sfuma via
      setTimeout(() => overlay.classList.remove("is-active"), 120);
    });
  }

  function isModifiedClick(e) {
    return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
  }

  function isExternalLink(a) {
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

    // costruisci URL assoluto
    let url;
    try {
      url = new URL(a.href, window.location.href);
    } catch {
      return;
    }

    if (isExternalLink(a)) return;

    // Se è solo un cambio hash nella stessa pagina, non animare
    const samePath = url.pathname === window.location.pathname;
    const onlyHashChange = samePath && url.search === window.location.search && url.hash;
    if (onlyHashChange) return;

    // OK: anima e naviga
    e.preventDefault();

    overlay.classList.add("is-active");
    sessionStorage.setItem(FLAG, "1");

    // tempo breve per far comparire l'overlay prima del cambio pagina
    setTimeout(() => {
      window.location.href = url.toString();
    }, 220);
  });
})();
