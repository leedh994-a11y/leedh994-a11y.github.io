# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is
This repository is a single, self-contained static web page: `sitpgpt.html` (the "Sitp GPT" landing/demo page). There is no backend, no package manager, no build step, and no test/lint tooling. All behavior (tools, AI chat, PayPal subscription) is client-side and mocked in-browser via vanilla JavaScript (`runTool`, `sendChatMessage`, `simulatePayment`).

### Running the app (development)
Serve the file over HTTP from the repo root and open it in a browser:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000/sitpgpt.html`. Opening the file via the `file://` protocol also works, but a local HTTP server best mirrors GitHub Pages hosting.

### Build / lint / test
There is no build, lint, or automated test setup in this repo — those steps do not apply. "Testing" means loading the page and exercising the mocked interactions (click a tool, send a chat message, click the PayPal subscription button).

### Dependencies
None. There is nothing to install; the only runtime needed is a static HTTP server (Python 3 is sufficient). The startup update script is intentionally a no-op check.
