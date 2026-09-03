/**
 * Минимальный статический сервер для локального запуска и демо.
 * Нужен только потому, что ES-модули не работают по протоколу file://.
 * В продакшене раздача идёт Vercel / Netlify / GitHub Pages без всякого кода.
 *
 *   node server.js  →  http://localhost:4173
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4173;
const ROOT = __dirname;

/**
 * .env.local — чтобы локальный запуск вёл себя как Vercel.
 *
 * Без этого ИИ-репетитор работал бы только на задеплоенном сайте, а на
 * `npm start` молча падал в оффлайн-разбор. На защите проекта демо чаще
 * показывают с ноутбука, поэтому расхождение между локалью и продом здесь
 * стоит дороже, чем десять строк разбора файла.
 */
function loadEnvLocal() {
  try {
    fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n').forEach((line) => {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m || process.env[m[1]]) return;
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    });
  } catch { /* файла нет — штатно: приложение работает и без ключа */ }
}
loadEnvLocal();

/**
 * Локальный аналог serverless-функции Vercel.
 *
 * Тот же самый api/tutor.mjs, без копии логики: расхождение между тем, что
 * проверено локально, и тем, что уедет в прод, — источник самых дорогих
 * сюрпризов на демо. Здесь мы лишь подделываем минимальный интерфейс
 * req/res, которого ждёт функция.
 */
async function serveApi(req, res, route) {
  let handler;
  try {
    handler = (await import(`./api/${route}.mjs`)).default;
  } catch {
    res.writeHead(404, { 'content-type': 'application/json' }).end('{"error":"no such function"}');
    return;
  }

  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', async () => {
    const shim = {
      statusCode: 200,
      setHeader: (k, v) => res.setHeader(k, v),
      status(code) { this.statusCode = code; return this; },
      json(obj) {
        res.writeHead(this.statusCode, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(obj));
      },
    };
    try {
      await handler({ method: req.method, body: Buffer.concat(chunks).toString('utf8') }, shim);
    } catch (e) {
      console.error('api error', e);
      shim.status(500).json({ error: 'internal' });
    }
  });
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);

  const api = url.match(/^\/api\/([a-z0-9-]+)$/);
  if (api) { serveApi(req, res, api[1]); return; }

  let file = path.join(ROOT, url === '/' ? 'index.html' : url);

  // Не выпускаем запросы за пределы каталога проекта.
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  // Каталог → index.html внутри него (нужно, например, для /pitch/).
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    file = path.join(file, 'index.html');
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404');
      return;
    }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file)] || 'application/octet-stream',
      'cache-control': 'no-cache',
    }).end(data);
  });
}).listen(PORT, () => {
  console.log(`AQYL running at http://localhost:${PORT}`);
});
