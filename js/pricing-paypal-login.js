/**
 * PayPal Login with PayPal (LWP) — PayPal Developer dashboard snippet.
 */
(function () {
  const CONTAINER_ID =
    "BAA_HhKZAA-3hl-Bx67hXC5snkRbipDaPzkWGBvcZKYwpYe9IQAVSrdtkHmtwTmsN2YPBZDpkVb9RHc3eU";
  const APP_ID = "ddb1520@outlook.com";
  const RETURN_URL = "https://www.yoursite.asia/billing/return";

  function renderLogin() {
    if (typeof paypal === "undefined" || !paypal.use) {
      console.warn("PayPal login API not loaded");
      return;
    }
    paypal.use(["login"], function (login) {
      login.render({
        appid: APP_ID,
        scopes: "openid",
        containerid: CONTAINER_ID,
        responseType: "code",
        locale: "en-us",
        labelType: "LWP",
        buttonSize: "sm",
        fullPage: "true",
        returnurl: RETURN_URL,
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderLogin);
  } else {
    renderLogin();
  }
})();
