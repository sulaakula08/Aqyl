/**
 * Service worker AQYL.
 *
 * Стратегия «network-first с откатом в кэш»: пока сеть есть, ученик получает
 * свежую версию; как только сеть пропадает, приложение целиком поднимается
 * из кэша. Это ключевое требование кейса — в сельских школах Казахстана
 * интернет бывает нестабильным или почасовым.
 */

const CACHE = 'aqyl-v13';

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'styles/tokens.css',
  'styles/app.css',
  'styles/motion.css',
  'styles/mascot.css',
  'src/main.js',
  'src/state.js',
  'src/cloud/supabase.js',
  'src/i18n.js',
  'src/i18n/ru.js',
  'src/i18n/kk.js',
  'src/i18n/en.js',
  'src/ui/dom.js',
  'src/ui/icons.js',
  'src/ui/motion.js',
  'src/ui/flourish.js',
  'src/ui/juice.js',
  'src/ui/sound.js',
  /* Талисман: без этих файлов офлайн-режим остался бы без персонажа,
     то есть половина обратной связи в учёбе просто исчезла бы. */
  'src/ui/mascot.js',
  'src/ui/mascot/rig.js',
  'src/ui/mascot/growth.js',
  'src/ui/mascot/anim.js',
  'src/ui/mascot/machine.js',
  'src/ui/mascot/idle.js',
  'src/ui/mascot/speech.js',
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
  'src/ui/simulate.js',
  'src/ui/auth.js',
  'src/ui/tour.js',
  'src/engine/mastery.js',
  'src/engine/recommender.js',
  'src/engine/planner.js',
  'src/engine/tutor.js',
  'src/engine/simulate.js',
  'src/data/curriculum.js',
  'src/data/seed.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      /* addAll атомарен: один отсутствующий файл отменял бы весь кэш и тихо
         убивал офлайн-режим целиком. Кладём поштучно и переживаем промахи. */
      .then((c) => Promise.all(ASSETS.map((a) => c.add(a).catch((err) => {
        console.warn('AQYL sw: не удалось закэшировать', a, err);
      }))))
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

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  /* Ответы ИИ-репетитора кэшировать нельзя ни при каких условиях: они зависят
     от профиля и истории диалога, и выдача вчерашнего ответа на сегодняшний
     вопрос выглядела бы как сломанная модель. Оффлайн этот путь и так не
     нужен — вызывающий код в этом случае считает разбор на устройстве. */
  if (url.pathname.startsWith('/api/')) return;

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
