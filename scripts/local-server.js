const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const localEnv = path.resolve(__dirname, '..', '.env.local');
if (require('node:fs').existsSync(localEnv)) process.loadEnvFile(localEnv);

const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 3000);

const mimeTypes = {
  '.avif': 'image/avif',
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.pdf': 'application/pdf',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;

    if (pathname === '/api/freebies') return await require('../api/freebies')(req, res);

    const filePath = resolveStaticPath(pathname);
    const data = await fs.readFile(filePath);
    res.statusCode = 200;
    res.setHeader('Content-Type', mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
    if (pathname.startsWith('/downloads/')) res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.end(data);
  } catch (error) {
    res.statusCode = error.code === 'ENOENT' ? 404 : 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(res.statusCode === 404 ? 'Page not found' : 'Server error');
  }
});

server.listen(port, () => {
  console.log(`Ashley Miller Life Coach server running at http://localhost:${port}`);
});

function resolveStaticPath(pathname) {
  let clean = decodeURIComponent(pathname).replace(/^\/+/, '');
  if (!clean) clean = 'index.html';

  if (clean === 'rooted-women/peace-promise' || clean === 'rooted-women/peace-promise.html') {
    return path.join(root, 'the-peace-promise.html');
  }
  if (clean === 'privacy') clean = 'privacy-policy.html';
  if (clean === 'terms') clean = 'terms-of-use.html';
  if (clean === 'refunds') clean = 'refund-policy.html';
  if (clean === 'booking') clean = 'book.html';
  if (clean === 'services') clean = 'coaching.html';

  if (/(^|\/)(\.|lib\/|scripts\/|test\/|node_modules\/|api\/|tmp\/)/.test(clean)) {
    const error = new Error('Not found');
    error.code = 'ENOENT';
    throw error;
  }
  if (!path.extname(clean)) clean = `${clean}.html`;

  const resolved = path.resolve(root, clean);
  if (!resolved.startsWith(root + path.sep)) {
    const error = new Error('Invalid path');
    error.code = 'ENOENT';
    throw error;
  }
  return resolved;
}
