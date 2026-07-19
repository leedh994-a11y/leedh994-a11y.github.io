(function () {
  const nav = document.getElementById("site-nav");
  const topBars = document.getElementById("top-bars");
  const terminalText = document.getElementById("terminal-text");

  const tasks = [
    "Processing autonomous tasks...",
    "CEO Agent: reviewing daily strategy...",
    "Engineering Agent: deploying feature branch...",
    "Marketing Agent: scheduling social posts...",
    "Ads Agent: optimizing Meta campaign...",
    "Support Agent: resolving inbox queue...",
  ];
  let taskIdx = 0;
  setInterval(() => {
    taskIdx = (taskIdx + 1) % tasks.length;
    if (terminalText) terminalText.textContent = `> ${tasks[taskIdx]}`;
  }, 3200);

  function updateNav() {
    const scrollY = window.scrollY;
    const section2 = document.getElementById("section-2");
    const inOffice = scrollY < (section2?.offsetTop || 800) - 100;

    if (nav) {
      nav.classList.toggle("scrolled", scrollY > 40);
      nav.classList.toggle("light", inOffice);
      nav.classList.toggle("dark", !inOffice);
      nav.classList.toggle("has-bars", scrollY < 80);
    }

    if (topBars) {
      topBars.style.transform = scrollY > 120 ? "translateY(-100%)" : "translateY(0)";
      topBars.style.transition = "transform 300ms cubic-bezier(0.4, 0, 0.2, 1)";
    }
  }

  window.addEventListener("scroll", updateNav, { passive: true });
  updateNav();

  const revealEls = document.querySelectorAll(".reveal, .reveal-stagger");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );
  revealEls.forEach((el) => observer.observe(el));

  document.querySelectorAll(".feature-card.tilt").forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(600px) rotateY(${x * 5}deg) rotateX(${-y * 5}deg) translateY(-4px)`;
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  });

  const agentLog = document.getElementById("agent-log");
  if (agentLog) {
    const lines = [
      ['[CEO]', 'Weekly OKRs updated. Focus: conversion + retention.'],
      ['[Engineering]', 'Fixed checkout bug in staging <span class="success">✓</span>'],
      ['[Marketing]', 'Cold email sequence sent to 200 leads.'],
      ['[Ads]', 'Paused ad set #4 — CPA above threshold.'],
      ['[Support]', 'Auto-replied 12 tickets. NPS survey sent.'],
      ['[Ops]', 'Stripe webhook verified. DNS propagated.'],
    ];
    let lineIdx = 0;
    setInterval(() => {
      const [agent, msg] = lines[lineIdx % lines.length];
      lineIdx++;
      const div = document.createElement("div");
      div.innerHTML = `<span class="highlight">${agent}</span> ${msg}`;
      agentLog.appendChild(div);
      if (agentLog.children.length > 8) agentLog.removeChild(agentLog.firstChild);
      agentLog.scrollTop = agentLog.scrollHeight;
    }, 4000);
  }

  document.getElementById("signup-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("signup-email").value.trim();
    const idea = document.getElementById("signup-idea").value.trim();
    if (!email) return;
    alert(
      `Welcome to Pzhisen!\n\nWe've received your signup for ${email}.\n` +
        (idea ? `Idea: ${idea}\n\n` : "") +
        "Your AI employee team will be ready shortly. (Demo — connect backend to go live.)"
    );
  });

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const id = link.getAttribute("href");
      if (id === "#signin" || id.length < 2) return;
      const target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth" });
      }
    });
  });
})();
