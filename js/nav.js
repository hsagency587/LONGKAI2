(function () {
  const nav = document.querySelector(".nav");
  const toggle = document.querySelector(".nav__toggle");
  const panel = document.querySelector(".nav__panel");
  const links = document.querySelectorAll(".nav__panel a");
  const dropdowns = document.querySelectorAll(".nav__dropdown");

  if (!nav || !toggle || !panel) return;

  const setOpen = (open) => {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  };

  toggle.addEventListener("click", () => {
    setOpen(!nav.classList.contains("is-open"));
  });

  links.forEach((link) => {
    link.addEventListener("click", () => setOpen(false));
  });

  dropdowns.forEach((dropdown) => {
    dropdown.addEventListener("toggle", () => {
      if (!dropdown.open) return;
      dropdowns.forEach((other) => {
        if (other !== dropdown) other.open = false;
      });
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });
})();
