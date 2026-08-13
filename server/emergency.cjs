/**
 * Zero-dependency emergency static server.
 * Restores site when the main Express app fails to start.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

function respond(res, code, body, type) {
  res.writeHead(code, { "Content-Type": type || "text/plain; charset=utf-8" });
  res.end(body);
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      const htmlPath = filePath.endsWith(".html") ? null : `${filePath}.html`;
      if (htmlPath) {
        return fs.readFile(htmlPath, (err2, data2) => {
          if (err2) return respond(res, 404, "Not found");
          respond(res, 200, data2, MIME[".html"]);
        });
      }
      return respond(res, 404, "Not found");
    }
    const ext = path.extname(filePath).toLowerCase();
    respond(res, 200, data, MIME[ext] || "application/octet-stream");
  });
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);

  if (urlPath === "/api/health") {
    return respond(res, 200, JSON.stringify({ ok: true, emergency: true }), MIME[".json"]);
  }

  let rel = urlPath;
  if (rel.endsWith("/")) rel += "index.html";
  rel = rel.replace(/^\/+/, "");
  const filePath = path.normalize(path.join(ROOT, rel));
  if (!filePath.startsWith(ROOT)) return respond(res, 403, "Forbidden");

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) {
      return serveFile(res, path.join(filePath, "index.html"));
    }
    serveFile(res, filePath);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Emergency static server listening on :${PORT}`);
  console.log(`ROOT: ${ROOT}`);
});
