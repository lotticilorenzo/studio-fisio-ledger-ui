/* eslint-disable no-restricted-globals */

self.addEventListener('push', (event) => {
    if (!event.data) return;

    try {
        const payload = event.data.json();
        const { title, body, url, icon } = payload;

        const options = {
            body: body || 'Hai un appuntamento in partenza!',
            icon: icon || '/brand/icon-192.png',
            badge: '/brand/icon-192.png',
            vibrate: [200, 100, 200],
            data: {
                url: url || '/op/appointments'
            }
        };

        event.waitUntil(
            self.registration.showNotification(title || 'Studio FISYO', options)
        );
    } catch (e) {
        console.error('Error parsing push data', e);
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const targetUrl = event.notification.data.url;

    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            // Se l'app è già aperta, naviga quella
            for (const client of clientList) {
                if (client.url === targetUrl && 'focus' in client) {
                    return client.focus();
                }
            }
            // Altrimenti apri nuova finestra
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
