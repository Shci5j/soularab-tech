'use strict';

// Bump this name whenever a deployment must invalidate previously cached assets.
const CACHE_NAME = 'soularab-tech-v10';
const BASE_URL = new URL('./', self.location.href);
const PRECACHE_URLS = [
  BASE_URL.href,
  new URL('index.html', BASE_URL).href,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((name) => name.startsWith('soularab-tech-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/api/')) return;

  // Always request the latest document; use the cached document only when offline.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(BASE_URL.href, copy));
      }
      return response;
    }).catch(async () => (await caches.match(request)) || (await caches.match(BASE_URL.href))));
    return;
  }

  // Vite emits fingerprinted asset filenames; cache them after the first successful fetch.
  event.respondWith(caches.match(request).then(async (cached) => {
    if (cached) return cached;
    const response = await fetch(request);
    if (response && response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
    }
    return response;
  }));
});
