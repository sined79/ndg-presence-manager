const CACHE_NAME = 'ndg-presence-v2.1.4';

// Installation
self.addEventListener('install', (event) => {
    console.log('SW: Installation nouvelle version');
    self.skipWaiting(); // Force la mise à jour immédiate
});

// Activation - nettoie les anciens caches
self.addEventListener('activate', (event) => {
    console.log('SW: Activation');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('SW: Suppression ancien cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            return self.clients.claim();
        })
    );
});

// Fetch - stratégie "Network First" pour les fichiers HTML
self.addEventListener('fetch', (event) => {
    if (event.request.url.startsWith(self.location.origin)) {
        // Pour les fichiers HTML, essaie d'abord le réseau
        if (event.request.url.endsWith('.html') || event.request.url.endsWith('/')) {
            event.respondWith(
                fetch(event.request)
                    .then((response) => {
                        if (response.status === 200) {
                            const responseClone = response.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(event.request, responseClone);
                            });
                        }
                        return response;
                    })
                    .catch(() => {
                        return caches.match(event.request);
                    })
            );
        } else {
            // Pour les autres ressources, utilise le cache d'abord
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
    }
});
