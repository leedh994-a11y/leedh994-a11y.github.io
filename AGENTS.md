# AGENTS.md

## Cursor Cloud specific instructions

This repository (`leedh994-a11y.github.io`) is a static GitHub Pages site. There is no
build system, package manager, dependencies, tests, or linter.

- The whole app is a single self-contained file `sitpgpt.html` with inline CSS/JS. All
  functionality (AI chat, tool cards, simulated PayPal payment) runs client-side in the
  browser; there is no backend.
- To run it in development, serve the repo root with any static file server and open the
  page, e.g. `python3 -m http.server 8000` then visit
  `http://localhost:8000/sitpgpt.html`. Opening the file directly with `file://` also works.
- There is nothing to install, build, lint, or test. The update script is intentionally a
  no-op verification.
