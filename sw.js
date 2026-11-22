// Service worker Queen Laundry POS - mode offline
var CACHE = 'qlaundry-Q.v10';
var CORE = [
  './', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
  'https://cdn.tailwindcss.com/3.4.17',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(CORE.map(function (u) {
        var req = u.indexOf('http') === 0 ? new Request(u, { mode: 'no-cors' }) : u;
        return c.add(req).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isCdn(url) {
  return /(^|\.)(cdn\.tailwindcss\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname) ||
    (url.hostname === 'www.gstatic.com' && url.pathname.indexOf('/firebasejs/') === 0);
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var same = url.origin === self.location.origin;
  if (!same && !isCdn(url)) return; // Firestore, Auth, dll tidak disentuh

  function save(res) {
    var copy = res.clone();
    caches.open(CACHE).then(function (c) { c.put(req, copy); });
    return res;
  }

  // Halaman utama: ambil versi terbaru saat online, pakai salinan saat offline
  if (req.mode === 'navigate' || (same && /\.html?$/.test(url.pathname))) {
    e.respondWith(
      fetch(req).then(save).catch(function () {
        return caches.match(req).then(function (r) { return r || caches.match('index.html'); }).then(function (r) { return r || caches.match('./'); });
      })
    );
    return;
  }

  // File statis & CDN: pakai salinan dulu, ambil jika belum ada
  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(save);
    })
  );
});
