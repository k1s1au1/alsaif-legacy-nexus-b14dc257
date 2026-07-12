// Firebase Messaging Service Worker
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyC9bAtP8U3ohl22gRWGqrscUAqD15h2wDw",
  authDomain: "alsaif-nexus.firebaseapp.com",
  projectId: "alsaif-nexus",
  storageBucket: "alsaif-nexus.firebasestorage.app",
  messagingSenderId: "1099282607132",
  appId: "1:1099282607132:web:dd39f94650748db6a803d9",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || "إشعار جديد";
  const options = {
    body: payload.notification?.body || payload.data?.body || "",
    icon: "/logo.png",
    badge: "/logo.png",
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
