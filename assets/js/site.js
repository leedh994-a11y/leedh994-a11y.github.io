const SITP_CONFIG = {
  // Replace these URLs with your live Stripe Payment Links or PayPal subscription links.
  proCheckoutUrl: '',
  growthCheckoutUrl: '',
  installationCheckoutUrl: ''
};

function startCheckout(plan) {
  const urls = {
    pro: SITP_CONFIG.proCheckoutUrl,
    growth: SITP_CONFIG.growthCheckoutUrl,
    installation: SITP_CONFIG.installationCheckoutUrl
  };
  if (urls[plan]) {
    window.location.assign(urls[plan]);
    return;
  }
  window.location.assign(`mailto:support@yoursite.asia?subject=${encodeURIComponent(`Sitp GPT ${plan} plan request`)}&body=${encodeURIComponent('Hello Sitp GPT, I would like to purchase this plan. Please send me a secure checkout link.')}`);
}

function submitLead(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const lead = Object.fromEntries(new FormData(form).entries());
  const leads = JSON.parse(localStorage.getItem('sitpLeads') || '[]');
  leads.push({ ...lead, createdAt: new Date().toISOString() });
  localStorage.setItem('sitpLeads', JSON.stringify(leads));
  form.querySelector('.form-result').style.display = 'block';
  form.reset();
}

function addBrandingPreview() {
  const target = document.querySelector('[data-branding-preview]');
  if (!target) return;
  target.innerHTML = '<div class="bubble bot">Here is the answer from your knowledge base.<br><small style="display:block;margin-top:8px;color:#b7b4f6">Powered by <strong>Sitp GPT</strong></small></div>';
}

document.addEventListener('DOMContentLoaded', addBrandingPreview);
