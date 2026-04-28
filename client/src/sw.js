import { precacheAndRoute } from 'workbox-precaching';

// Update this name manually to invalidate caches
const CACHE_NAME = 'farm-tracker-v1';

// Precaches all assets compiled by Vite
precacheAndRoute(self.__WB_MANIFEST || []);

self.addEventListener('install', (event) => {
  // Force the new worker to become active immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete all old caches that do not match the current CACHE_NAME
          if (cacheName !== CACHE_NAME && cacheName.startsWith('farm-tracker-')) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Claim clients immediately
  );
});

// We can also add a fetch event listener to enforce cache strategies
self.addEventListener('fetch', (event) => {
  // Pass through to workbox or network
  // In a full PWA, you might want NetworkFirst or CacheFirst strategies here
});
