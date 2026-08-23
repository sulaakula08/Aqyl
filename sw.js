/**
 * Service worker AQYL.
 *
 * Стратегия «network-first с откатом в кэш»: пока сеть есть, ученик получает
 * свежую версию; как только сеть пропадает, приложение целиком поднимается
 * из кэша. Это ключевое требование кейса — в сельских школах Казахстана
 * интернет бывает нестабильным или почасовым.
 */

const CACHE = 'aqyl-v4';

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'styles/tokens.css',
  'styles/app.css',
  'styles/motion.css',
  'src/main.js',
  'src/state.js',
  'src/i18n.js',
  'src/ui/dom.js',
  'src/ui/icons.js',
  'src/ui/motion.js',
  'src/ui/home.js',
  'src/ui/method.js',
  'src/ui/onboarding.js',
  'src/ui/diagnostic.js',
  'src/ui/dashboard.js',
  'src/ui/learn.js',
  'src/ui/graph.js',
  'src/ui/tutor.js',
  'src/ui/teacher.js',
  'src/ui/plan.js',
  'src/engine/mastery.js',
  'src/engine/recommender.js',
  'src/engine/planner.js',
  'src/engine/tutor.js',
  'src/data/curriculum.js',
  'src/data/seed.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  // Запросы к Claude API никогда не кэшируем.
  if (new URL(request.url).origin !== location.origin) return;

  e.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('index.html')))
  );
});
