'use strict';

const CACHE_NAME = 'soularab-tech-v2';
const BASE_URL = new URL('./', self.location.href);
const PRECACHE_URLS = [
  BASE_URL.href,
  new URL('index.html', BASE_URL).href,
  new URL('style.css', BASE_URL).href,
  new URL('script.js', BASE_URL).href,
  new URL('manifest.json', BASE_URL).href,
  new URL('icon.svg', BASE_URL).href
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((name) => name.startsWith('soularab-tech-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);

  if (request.method !== 'GET' || requestUrl.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      if (request.mode === 'navigate') {
        return fetch(request).catch(() => caches.match(BASE_URL));
      }

      return fetch(request);
    })
  );
});
