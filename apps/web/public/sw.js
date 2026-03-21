const CACHE_NAME = "wello-v1";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
];

// 캐시할 API 경로 (네트워크 우선, 폴백 캐시)
const API_CACHE_NAME = "wello-api-v1";
const API_BASE = "/api/";

// 설치: 정적 자산 사전 캐시
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// 활성화: 이전 캐시 정리
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== API_CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: 전략별 캐싱
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 외부 도메인은 캐싱하지 않음
  if (url.origin !== self.location.origin) return;

  // API 요청: 네트워크 우선, 실패 시 캐시 폴백
  if (url.pathname.startsWith(API_BASE)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && request.method === "GET") {
            const clone = response.clone();
            caches.open(API_CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 정적 자산: 캐시 우선, 네트워크 폴백
  if (
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "image" ||
    request.destination === "font"
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML 페이지: 네트워크 우선, 오프라인 시 캐시
  if (request.destination === "document" || request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("/"))
        )
    );
  }
});
