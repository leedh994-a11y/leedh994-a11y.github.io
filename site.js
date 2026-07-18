(function () {
  const paidFeatures = [
    "Unlimited customer support answers",
    "Automatic website content updates",
    "WhatsApp and Slack integrations",
    "Customer email collection",
    "Enterprise analytics reports"
  ];

  window.SITP_PLANS = {
    free: {
      name: "Free",
      price: "$0",
      features: ["10 AI support tests", "1 knowledge base", "100 website training pages"]
    },
    starter: { name: "Starter", price: "$29/month", features: paidFeatures },
    growth: { name: "Growth", price: "$79/month", features: paidFeatures },
    business: { name: "Business", price: "$199/month", features: paidFeatures },
    install: {
      name: "AI Customer Support Installation",
      price: "$599 one time",
      features: [
        "AI training for your business",
        "Website chatbot installation",
        "FAQ setup",
        "Customer support workflow optimization",
        ...paidFeatures
      ]
    }
  };

  window.selectPlan = function (planId) {
    const plan = window.SITP_PLANS[planId];
    if (!plan) return;

    if (planId === "free") {
      localStorage.setItem("sitpPlan", "free");
      alert("Free plan activated: 10 AI support tests, 1 knowledge base, and 100 training pages.");
      return;
    }

    localStorage.setItem("sitpSelectedPlan", planId);
    if (typeof window.simulatePayment === "function") {
      window.simulatePayment(plan.name);
    } else {
      alert(plan.name + " selected. Secure checkout requires your configured payment provider.");
    }
  };

  window.addPoweredBy = function (content, planId) {
    const activePlan = planId || localStorage.getItem("sitpPlan") || "free";
    return activePlan === "free" ? content + "\n\nPowered by Sitp GPT — https://yoursite.asia/" : content;
  };

  window.nextDemoStep = function () {
    const steps = Array.from(document.querySelectorAll(".demo-step"));
    if (!steps.length) return;
    const activeIndex = steps.findIndex((step) => step.classList.contains("active"));
    const nextIndex = (activeIndex + 1) % steps.length;
    steps.forEach((step, index) => step.classList.toggle("active", index === nextIndex));
    const progress = document.querySelector(".progress span");
    if (progress) progress.style.width = ((nextIndex + 1) / steps.length * 100) + "%";
  };
})();
