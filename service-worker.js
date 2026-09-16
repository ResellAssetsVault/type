const CACHE_NAME = 'xbj-remote-v1';
const ASSETS = [
  '/',
  '/projector-remote.html',
  '/projector-remote.js',
  '/manifest.json',
  '/typing.js'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching app shell');
      return cache.addAll(ASSETS).catch(err => {
        console.log('Some assets failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Don't cache network requests to projectors
  if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1' &&
      !url.hostname.startsWith('192.168') && !url.hostname.startsWith('10.')) {
    event.respondWith(
      caches.match(request).then((response) => {
        return response || fetch(request).catch(() => {
          return new Response('Offline', { status: 503 });
        });
      })
    );
  } else {
    // Always try network first for projector commands
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(request) || new Response('Offline', { status: 503 });
      })
    );
  }
});

// Handle background sync for queued commands
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-commands') {
    event.waitUntil(syncQueuedCommands());
  }
});

// Handle push notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const title = data.title || 'XBJ Remote';
  const options = {
    body: data.message || 'Projector status updated',
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect fill="%231a1a1a" width="192" height="192"/><circle cx="96" cy="96" r="72" fill="%23ff6b6b"/></svg>',
    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><circle cx="96" cy="96" r="80" fill="%23ff6b6b"/></svg>'
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Utility function to sync queued commands
async function syncQueuedCommands() {
  const db = await openDB();
  const queue = await getQueuedCommands(db);

  for (const command of queue) {
    try {
      await fetch(command.url, { method: 'POST' });
      await removeQueuedCommand(db, command.id);
    } catch (error) {
      console.error('Failed to sync command:', error);
    }
  }
}

// IndexedDB helper functions
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('xbj-remote', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      db.createObjectStore('commands', { keyPath: 'id', autoIncrement: true });
    };
  });
}

function getQueuedCommands(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['commands'], 'readonly');
    const store = transaction.objectStore('commands');
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function removeQueuedCommand(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['commands'], 'readwrite');
    const store = transaction.objectStore('commands');
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

console.log('Service Worker loaded');
