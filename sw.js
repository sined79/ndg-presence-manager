const CACHE_NAME = 'ndg-presence-v1';

// Installation - ne cache que le minimum
self.addEventListener('install', (event) => {
    console.log('SW: Installation');
    self.skipWaiting();
});

// Activation
self.addEventListener('activate', (event) => {
    console.log('SW: Activation');
    event.waitUntil(self.clients.claim());
});

// Fetch - cache dynamiquement
self.addEventListener('fetch', (event) => {
    // Ne traite que les requêtes de votre domaine
    if (event.request.url.startsWith(self.location.origin)) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(event.request).then((response) => {
                    if (response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                });
            })
        );
    }
});
