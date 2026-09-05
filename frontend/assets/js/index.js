(() => {
  if (typeof lucide !== "undefined") lucide.createIcons();

  const shell = document.querySelector(".landing-shell");
  if (!shell || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const movingElements = [
    [document.querySelector(".orb-a"), 9],
    [document.querySelector(".orb-b"), -6],
    [document.querySelector(".glass-arc-right"), 4],
    [document.querySelector(".glass-arc-left"), -3]
  ].filter(([element]) => element);

  let frame = null;

  shell.addEventListener("pointermove", event => {
    const x = event.clientX / window.innerWidth - 0.5;
    const y = event.clientY / window.innerHeight - 0.5;

    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      movingElements.forEach(([element, amount]) => {
        element.style.translate = `${x * amount}px ${y * amount}px`;
      });
    });
  });

  shell.addEventListener("pointerleave", () => {
    movingElements.forEach(([element]) => {
      element.style.translate = "0 0";
    });
  });
})();
