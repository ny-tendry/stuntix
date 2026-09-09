(function () {

  // Petit chargement de page : visible au premier rendu puis retiré en douceur.
  const pageLoader = document.querySelector(".page-loader");
  const loaderStartedAt = performance.now();
  function hidePageLoader() {
    if (!pageLoader || pageLoader.classList.contains("is-hidden")) return;
    const minimumVisibleMs = 260;
    const elapsed = performance.now() - loaderStartedAt;
    const wait = Math.max(0, minimumVisibleMs - elapsed);
    window.setTimeout(() => {
      pageLoader.classList.add("is-hidden");
      window.setTimeout(() => pageLoader.remove(), 280);
    }, wait);
  }
  if (document.readyState === "complete") hidePageLoader();
  else window.addEventListener("load", hidePageLoader, { once: true });
  window.setTimeout(hidePageLoader, 1800);
  const sidebar = document.querySelector(".sidebar");
  const scrim = document.querySelector(".sidebar-scrim");
  const toggle = document.querySelector(".mobile-toggle");
  const closeSidebar = () => {
    sidebar?.classList.remove("open");
    scrim?.classList.remove("open");
  };

  toggle?.addEventListener("click", () => {
    const open = !sidebar?.classList.contains("open");
    sidebar?.classList.toggle("open", open);
    scrim?.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
  });
  scrim?.addEventListener("click", closeSidebar);

  let timer;
  window.StuntixToast = function (message) {
    let toast = document.querySelector(".toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(timer);
    timer = setTimeout(() => toast.classList.remove("show"), 2400);
  };

  //section
  document.querySelectorAll("[data-demo-link]").forEach((el) =>
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const section =
        el.getAttribute("aria-label") ||
        el.getAttribute("title") ||
        "Cette section";
      window.StuntixToast?.(
        `${section} : interface prête à être reliée aux données du backend.`,
      );
      closeSidebar();
    }),
  );

  //micro transition entre les vraies pages 
  let routeBar;
  function showRouteProgress() {
    if (!routeBar) {
      routeBar = document.createElement("div");
      routeBar.className = "route-progress";
      routeBar.innerHTML = "<span></span>";
      document.body.appendChild(routeBar);
    }
    routeBar.classList.remove("done");
    routeBar.classList.add("show");
  }

  document.querySelectorAll("a[href]").forEach((link) => {
    link.addEventListener("click", (e) => {
      const href = link.getAttribute("href");
      if (!href || href === "#" || link.hasAttribute("data-demo-link")) return;
      if (
        e.defaultPrevented ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey ||
        link.target === "_blank"
      )
        return;
      let url;
      try {
        url = new URL(href, location.href);
      } catch {
        return;
      }
      if (
        url.origin !== location.origin ||
        (url.pathname === location.pathname && url.search === location.search)
      )
        return;
      e.preventDefault();
      showRouteProgress();
      document.documentElement.classList.add("is-navigating");
      setTimeout(() => {
        location.href = url.href;
      }, 150);
    });
  });

  //lcide remplace les <i data-lucide> par des SVG cohérents
  if (window.lucide?.createIcons) {
    window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
  }
})();
