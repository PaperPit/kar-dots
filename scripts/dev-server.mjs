#!/usr/bin/env node
/**
 * Локальный dev-сервер: статика + Netlify Functions
 * (/api/yt-video, /api/yt-generate — транскрипт через Supadata).
 * Заменяет python -m http.server для разработки с YouTube-импортом.
 *
 * Запуск: npm run dev  (сначала один раз npm install)
 * Переменные окружения — из .env в корне (см. .env.example); ключи, указанные
 * в настройках приложения (Настройки → «Карточки из YouTube»), работают и без .env.
 *
 * Netlify Blobs локально недоступны — функции сами переключаются на общий
 * in-memory стор (globalThis.__ytJobsMem), это уже учтено в их коде.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PREFERRED_PORT = Number(process.env.PORT) || 8080;
const MAX_PORT_TRIES = 10;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.wasm': 'application/wasm',
};

function loadDotEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadDotEnv();

let ytVideo, ytTranscribeBg, ttsFn, stockSearchFn;
try {
  ({ default: ytVideo } = await import('../netlify/functions/yt-video.mjs'));
  await import('../netlify/functions/yt-generate.mjs');
  ({ default: ytTranscribeBg } = await import('../netlify/functions/yt-transcribe-background.mjs'));
  ({ default: ttsFn } = await import('../netlify/functions/tts.mjs'));
  ({ default: stockSearchFn } = await import('../netlify/functions/stock-search.mjs'));
} catch (e) {
  if (e.code === 'ERR_MODULE_NOT_FOUND' && String(e.message).includes('@netlify/blobs')) {
    console.error('\nНе найден пакет @netlify/blobs — запусти сначала:  npm install\n');
    process.exit(1);
  }
  throw e;
}

const API_STATIC = {
  '/api/yt-video': () => ytVideo,
  '/api/tts': () => ttsFn,
  '/api/stock-search': () => stockSearchFn,
  '/.netlify/functions/yt-transcribe-background': () => ytTranscribeBg,
};

/** yt-generate часто меняется — в dev перечитываем модуль на каждый запрос. */
async function getYtGenerateHandler() {
  const mod = await import(`../netlify/functions/yt-generate.mjs?dev=${Date.now()}`);
  return mod.default;
}

async function resolveApiHandler(pathname) {
  if (pathname === '/api/yt-generate') return getYtGenerateHandler();
  const get = API_STATIC[pathname];
  return get ? get() : null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function toWebRequest(req, body, port) {
  const host = req.headers.host || `localhost:${port}`;
  const init = { method: req.method, headers: req.headers };
  if (body.length && req.method !== 'GET' && req.method !== 'HEAD') init.body = body;
  return new Request(`http://${host}${req.url}`, init);
}

async function sendWebResponse(webRes, res) {
  res.statusCode = webRes.status;
  webRes.headers.forEach((value, key) => {
    if (key === 'transfer-encoding') return;
    res.setHeader(key, value);
  });
  res.end(Buffer.from(await webRes.arrayBuffer()));
}

function serveFile(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = err.code === 'ENOENT' ? 404 : 500;
      res.end(err.code === 'ENOENT' ? 'Not found' : 'Server error');
      return;
    }
    res.setHeader('Content-Type', MIME[path.extname(filePath)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const port = server.address()?.port || PREFERRED_PORT;
  try {
    const pathname = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;
    const handler = await resolveApiHandler(pathname);
    if (handler) {
      const body = await readBody(req);
      await sendWebResponse(await handler(toWebRequest(req, body, port)), res);
      return;
    }

    let filePath = path.join(ROOT, decodeURIComponent(pathname));
    if (pathname.endsWith('/')) filePath = path.join(filePath, 'index.html');
    const rel = path.relative(ROOT, filePath);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stat) => {
      if (!err && stat.isDirectory()) {
        serveFile(path.join(filePath, 'index.html'), res);
        return;
      }
      if (err) {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }
      serveFile(filePath, res);
    });
  } catch (e) {
    console.error('[dev-server]', e);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'server', message: String(e.message || e) }));
    }
  }
});

function listenOnce(port) {
  return new Promise((resolve, reject) => {
    const onError = err => {
      server.removeListener('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      server.removeListener('error', onError);
      resolve(server.address().port);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port);
  });
}

async function startServer() {
  if (process.env.PORT) {
    try {
      return await listenOnce(PREFERRED_PORT);
    } catch (err) {
      if (err.code === 'EADDRINUSE') printPortHelp(PREFERRED_PORT);
      throw err;
    }
  }
  for (let i = 0; i < MAX_PORT_TRIES; i++) {
    const port = PREFERRED_PORT + i;
    try {
      const bound = await listenOnce(port);
      if (bound !== PREFERRED_PORT) {
        console.warn(`Порт ${PREFERRED_PORT} занят — использую ${bound}`);
      }
      return bound;
    } catch (err) {
      if (err.code !== 'EADDRINUSE') throw err;
    }
  }
  printPortHelp(PREFERRED_PORT);
  throw new Error(`Не удалось занять порты ${PREFERRED_PORT}–${PREFERRED_PORT + MAX_PORT_TRIES - 1}`);
}

function printPortHelp(port) {
  console.error(`\nПорт ${port} занят (EADDRINUSE).`);
  console.error('  Освободить:  lsof -ti :8080 | xargs kill');
  console.error('  Другой порт: PORT=8081 npm run dev\n');
}

const boundPort = await startServer();
console.log(`КАР-точки dev → http://localhost:${boundPort}`);
console.log('  API: /api/yt-video, /api/yt-generate, /api/tts, /api/stock-search');
