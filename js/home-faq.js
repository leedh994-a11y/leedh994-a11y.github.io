document.querySelectorAll(".faq-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const id = tab.dataset.tab;
    document.querySelectorAll(".faq-tab").forEach((t) => t.classList.toggle("active", t === tab));
    document.querySelectorAll(".faq-panel").forEach((p) => {
      p.classList.toggle("active", p.dataset.panel === id);
    });
  });
});
