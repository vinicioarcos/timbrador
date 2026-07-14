self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Timbra Académica', {
      body: data.body || 'Tienes una timbrada pendiente.',
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: { url: data.url || '/dashboard' },
      requireInteraction: data.priority === 'URGENT'
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/dashboard'));
});
