// Only derived legacy HTTP caches; learning records and materials use their own repository.
self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all(['api-cache', 'image-cache', 'font-cache'].map((name) => caches.delete(name))));
});
