// Firebase Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBWB0wBK0azqsjPrr6FT1sG3BYroM8jeZ4",
  authDomain: "sudhir-b1f77.firebaseapp.com",
  projectId: "sudhir-b1f77",
  storageBucket: "sudhir-b1f77.firebasestorage.app",
  messagingSenderId: "894623128679",
  appId: "1:894623128679:web:585124cd50224f00ea08c2"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Background message received:', payload);

  const notificationTitle = payload.notification?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: payload.data?.type || 'general',
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notificationData = event.notification.data;
  let url = '/dashboard.html';

  // Navigate based on notification type
  switch (notificationData?.type) {
    case 'enquiry_created':
    case 'stagnant_enquiry':
    case 'followup_reminder':
      url = '/enquiries.html';
      break;
    case 'admission_created':
      url = '/admissions.html';
      break;
    case 'payment_received':
    case 'payment_due':
    case 'payment_overdue':
      url = '/payments.html';
      break;
    default:
      url = '/dashboard.html';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // If a window client is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Handle service worker installation
self.addEventListener('install', (event) => {
  console.log('Firebase messaging service worker installed');
  self.skipWaiting();
});

// Handle service worker activation
self.addEventListener('activate', (event) => {
  console.log('Firebase messaging service worker activated');
  event.waitUntil(clients.claim());
});
