const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const BLOCKED_DIRS = new Set([
  ".git", ".github", ".vscode", "android", "node_modules", "supabase",
  "scripts", "tests", "docs", "dist", "coverage"
]);
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8"
};

function isAllowed(relativePath) {
  const parts = relativePath.split(/[\\/]+/);
  if (parts.some(part => !part || part.startsWith(".") || BLOCKED_DIRS.has(part.toLowerCase()))) {
    return false;
  }
  const ext = path.extname(relativePath).toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(MIME, ext)) return false;
  if (ext === ".json" && path.basename(relativePath).toLowerCase() !== "manifest.json" &&
      !relativePath.replace(/\\/g, "/").startsWith("assets/")) return false;
  return true;
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "Allow": "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Method not allowed");
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400);
    return res.end("Bad request");
  }

  if (pathname === "/") pathname = "/index.html";
  const relativePath = path.posix.normalize(pathname).replace(/^\/+/, "");
  if (!relativePath || relativePath === "." || relativePath.startsWith("..") ||
      relativePath.includes("\\0") || !isAllowed(relativePath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" });
    return res.end("Not found");
  }

  const filePath = path.resolve(ROOT, relativePath);
  if (!filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(404);
    return res.end("Not found");
  }

  fs.stat(filePath, (statError, stat) => {
    if (statError || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" });
      return res.end("Not found");
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Content-Length": stat.size,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Cache-Control": path.extname(filePath).toLowerCase() === ".html" ? "no-cache" : "public, max-age=3600"
    });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`ZakiTech web service listening on port ${PORT}`);
});
