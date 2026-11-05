// اسم ذاكرة التخزين المؤقت
const CACHE_NAME = 'soularab-dashboard-v1';

// الملفات الأساسية المضمونة للتخزين المؤقت
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// حدث التثبيت وتخزين الملفات مسبقاً
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE_ASSETS);
      self.skipWaiting();
    })()
  );
});

// حدث التفعيل والاستحواذ الفوري على الصفحة
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// التعامل مع الطلبات والشبكة والتخزين المؤقت
self.addEventListener('fetch', event => {
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // مطابقة الطلب مع الذاكرة المؤقتة
      const cachedResponse = await cache.match(event.request);

      // التحقق مما إذا كان الملف مخزناً
      if (cachedResponse !== undefined) {
        return cachedResponse;
      } else {
        // وإلا، الانتقال للشبكة (الإنترنت)
        return fetch(event.request);
      }
    })()
  );
});
