/* 高性价比人生指南 · Service Worker
   目标：装到手机上以后能离线用，同时保证正文和代码更新能尽快生效。
   策略：页面和代码（html/js/css/manifest）走网络优先，断网回落到缓存；
        data.json 走「先给旧的、后台更新」，2 MB 的文件不至于每次开都等下载；
        图标这类几乎不变的走缓存优先。 */
const VERSION = 'hltb-v1';
const SHELL = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'manifest.webmanifest',
  'icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 网络优先：拿得到就用新的并顺手更新缓存，拿不到就回落到缓存
async function netFirst(req, fallbackKey) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res && res.ok && res.type === 'basic') cache.put(fallbackKey || req, res.clone());
    return res;
  } catch (e) {
    return (await cache.match(fallbackKey || req)) || (await cache.match('index.html')) || Response.error();
  }
}
// 先给缓存、后台更新：大文件（data.json）用这个，秒开且下次是新的
async function staleWhileRevalidate(req, key) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(key);
  const net = fetch(req).then((res) => {
    if (res && res.ok) cache.put(key, res.clone());
    return res;
  }).catch(() => hit);
  return hit || net;
}

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.endsWith('/data.json')) { ev.respondWith(staleWhileRevalidate(req, 'data.json')); return; }

  if (req.mode === 'navigate') { ev.respondWith(netFirst(req, 'index.html')); return; }

  if (/\.(js|css|html|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/')) {
    ev.respondWith(netFirst(req));
    return;
  }

  // 其它静态资源：缓存优先，顺手补进缓存
  ev.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res && res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => hit))
  );
});

