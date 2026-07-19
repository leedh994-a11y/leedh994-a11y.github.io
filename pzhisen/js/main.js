(function () {
  const nav = document.getElementById("site-nav");
  const navDash = document.getElementById("nav-dashboard");
  const savedCompany = localStorage.getItem("pzhisen_company_id");
  if (savedCompany && navDash) {
    navDash.style.display = "inline";
    navDash.href = `/dashboard.html?company=${savedCompany}`;
  }

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
    async function loadGlobalLogs() {
      try {
        const res = await fetch("/api/logs/global");
        const data = await res.json();
        if (data.success && data.logs?.length) {
          agentLog.innerHTML = data.logs
            .map(
              (l) =>
                `<div><span class="highlight">[${l.agent}]</span> ${escapeHtml(l.message?.slice(0, 120) || "")}${l.ai ? ' <span class="success">AI</span>' : ""}</div>`
            )
            .join("");
        }
      } catch {
        /* offline — keep static demo lines */
      }
    }
    function escapeHtml(s) {
      const d = document.createElement("div");
      d.textContent = s;
      return d.innerHTML;
    }
    loadGlobalLogs();
    setInterval(loadGlobalLogs, 12000);
  }

  document.getElementById("signup-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("signup-email").value.trim();
    const idea = document.getElementById("signup-idea").value.trim();
    const btn = e.target.querySelector('button[type="submit"]');
    if (!email || !idea) return;

    btn.disabled = true;
    btn.textContent = "Deploying AI team…";

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, idea }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Signup failed");

      localStorage.setItem("pzhisen_company_id", data.company.id);
      localStorage.setItem("pzhisen_email", email);

      if (data.company.plan === "lifetime") {
        window.location.href = data.redirectUrl || `/dashboard.html?company=${data.company.id}`;
      } else {
        window.location.href = `/checkout.html?plan=lifetime&cycle=lifetime&email=${encodeURIComponent(email)}`;
      }
    } catch (err) {
      alert(err.message);
      btn.disabled = false;
      btn.textContent = "Get started free";
    }
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
