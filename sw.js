const CACHE = 'gumi-quiz-v3';
const ASSETS = ['./index.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // 절대 건드리면 안 되는 요청: 우리 사이트가 아닌 모든 외부 요청
  // (Firebase/Firestore/Storage/Google API 등). 이런 요청은 그대로 브라우저가
  // 처리하도록 두고, 서비스워커는 손대지 않는다. (예전 버전이 이걸 가로채서
  // Firestore 연결이 계속 실패하는 원인이 됐었음)
  if (url.origin !== self.location.origin) {
    return; // respondWith 호출 안 함 = 네트워크 요청 그대로 통과
  }

  // GET 요청이 아니면 손대지 않음
  if (e.request.method !== 'GET') return;

  // 같은 사이트의 화면(HTML) 요청: 네트워크 우선, 실패 시 캐시
  if (e.request.mode === 'navigate' || e.request.destination === 'document') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  // 그 외 같은 사이트 정적 파일(아이콘 등): 캐시 우선, 없으면 네트워크
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
