/* ======================
FIREBASE NOTIFICATION CENTER
====================== */

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBWB0wBK0azqsjPrr6FT1sG3BYroM8jeZ4",
    authDomain: "sudhir-b1f77.firebaseapp.com",
    projectId: "sudhir-b1f77",
    storageBucket: "sudhir-b1f77.firebasestorage.app",
    messagingSenderId: "894623128679",
    appId: "1:894623128679:web:585124cd50224f00ea08c2"
};

// VAPID Key from Firebase Console
const VAPID_KEY = "BFs0D0iJaKgkIZwLCCT7MIqfTXsD-PaKuM1pHEaVTPbpATnDQyQfO0sB85x9wgoIVBQMuT42ChfIFgysuNxtqGo";

// Global variables
let messaging = null;
let notifications = [];
let soundEnabled = true;
let currentNotificationData = null;
let fcmToken = null;

// Sound notification (base64 encoded simple chime)
const notificationSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQQAQ5Xs4N9vQgAAX57s5+RwSwAAKjm7fXwXVAAAKrr8fH1YlAAAKzv9/P2aSAAAQrD///+pWAAACMH///+gXAAAAsD///+fVAAAAsT///+dUAAAsgD///9zTAAAswD///9ySAAAtAD///9xRAAAtQD///9wQAAAsgD///9vPAAAswD///9uOAAAsAD///9tNAAAqAD///9sMAAApAD///9rKAAAoAD///9qJAAAnAD///9pIAAAmAD///9oHAAAlAD///9nGAAAkAD///9mFAAAjAD///9lEAAAiAD///9kDAAAhAD///9jCAAAgAD///9iBAAA/fz///9hAAA+fn///9gAAA9fX///9fAAA8PD///9eAAA7Oz///9dAAA6ur///9cAAA5ub///9bAAA4eH///9aAAA3d3///9YAAA2dn///9XAAA1tb///9VAAA0bG///9TAAAzMz///9RAAAyMj///9PAAAxMT///9NAAAwMD///9LAAAuLi///9JAAAqKj///9HAAAoKC///9FAAAjIy///9DAAAiIi///9BAAAgIC///9+AAAfHx///9+AAAeHh///9+AAAd3d///9+AAAcnJ///9+AAAbW1///9+AAAaWl///9+AAAZWV///9+AAAYGB///9+AAAXFx///9+AAAWVl///9+AAAVFR///9+AAAUFB///9+AAATEx///9+AAASkp///9+AAAQkJ///9+AAAPj4///9+AAAOjo///9+AAANzc///9+AAAMjI///9+AAALi4///9+AAAKCg///9+AAAJiY///9+AAAIiI///9+AAAHh4///9+AAAGhoa///9+AAAFhY///9+AAAEBQ///9+AAADAw///9+AAABAQ///9+AAAA');

// Initialize notification center
function initNotifications() {
    // Load notifications from localStorage
    loadNotifications();

    // Initialize Firebase
    initFirebase();

    // Setup cross-tab sync
    setupCrossTabSync();

    // Render notification bell
    renderNotificationBell();

    // Render notification modal
    renderNotificationModal();

    // Request browser notification permission
    requestBrowserNotificationPermission();

    // Show login welcome popup after delay
    setTimeout(showLoginWelcomePopup, 2000);
}

/* ======================
SERVICE WORKER REGISTRATION
====================== */
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/firebase-messaging-sw.js')
            .then((registration) => {
                console.log('Service Worker registered:', registration);
            })
            .catch((error) => {
                console.error('Service Worker registration failed:', error);
            });
    }
}

/* ======================
FIREBASE INITIALIZATION
====================== */
function initFirebase() {
    // Register service worker first
    registerServiceWorker();

    // Check if user is authenticated
    const token = localStorage.getItem('token');
    if (!token) return;

    // Check if Firebase is loaded
    if (typeof firebase === 'undefined') {
        console.log('Firebase SDK not loaded, retrying in 1s...');
        setTimeout(initFirebase, 1000);
        return;
    }

    // Initialize Firebase
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        messaging = firebase.messaging();

        // Request permission and get token
        requestFCMPermission();

        // Handle foreground messages
        messaging.onMessage((payload) => {
            console.log('Firebase message received:', payload);
            handleFirebaseNotification(payload);
        });

        console.log('Firebase initialized successfully');
    } catch (error) {
        console.error('Firebase initialization error:', error);
    }
}

/* ======================
FCM TOKEN MANAGEMENT
====================== */
async function requestFCMPermission() {
    try {
        const permission = await Notification.requestPermission();

        if (permission === 'granted') {
            console.log('Notification permission granted');
            await getFCMToken();
        } else {
            console.log('Notification permission denied');
        }
    } catch (error) {
        console.error('Error requesting permission:', error);
    }
}

async function getFCMToken() {
    try {
        // Get FCM token
        const currentToken = await messaging.getToken({
            vapidKey: VAPID_KEY
        });

        if (currentToken) {
            console.log('FCM Token received');
            fcmToken = currentToken;

            // Store token in localStorage for login/logout to use
            localStorage.setItem('fcmToken', currentToken);
            console.log('FCM token stored locally for login/logout');
        } else {
            console.log('No registration token available');
        }
    } catch (error) {
        console.error('Error getting FCM token:', error);
    }
}

async function removeFCMTokenOnLogout() {
    try {
        if (fcmToken) {
            // Delete token from Firebase
            await messaging.deleteToken();
            console.log('FCM token removed from Firebase');
        }
        // Clear local storage
        localStorage.removeItem('fcmToken');
    } catch (error) {
        console.error('Error removing FCM token:', error);
    }
}

/* ======================
FIREBASE NOTIFICATION HANDLERS
====================== */
function handleFirebaseNotification(payload) {
    const notification = {
        id: generateId(),
        type: payload.data?.type || 'general',
        title: payload.notification?.title || 'New Notification',
        message: payload.notification?.body || '',
        data: payload.data || {},
        timestamp: new Date().toISOString(),
        read: false
    };

    // Add to notification list
    addNotification(notification);

    // Play sound
    playNotificationSound();

    // Show modal popup for foreground
    showNotificationModal(payload.notification, payload.data);

    // Show browser notification
    showBrowserNotification(notification);

    // Show toast
    showToastNotification(notification);
}

// Handle notification types
function handleEnquiryNotification(data) {
    const enquiry = data.enquiry || data;

    const notification = {
        id: generateId(),
        type: 'enquiry_created',
        title: 'New Enquiry',
        message: `${enquiry.name} - ${enquiry.course || enquiry.courseInterested || 'N/A'}`,
        data: { ...enquiry, type: 'enquiry_created' },
        timestamp: new Date().toISOString(),
        read: false
    };

    addNotification(notification);
    playNotificationSound();
    showToastNotification(notification);
}

function handlePaymentNotification(data) {
    const payment = data.payment || data;
    const user = getCurrentUser();

    // Filter: Admin OR counselor who created the payment
    if (user.role !== 'admin' && user.id !== payment.receivedBy) {
        return;
    }

    const notification = {
        id: generateId(),
        type: 'payment_received',
        title: 'Payment Received',
        message: `₹${payment.amount} - ${payment.paymentType || 'Payment'}`,
        data: { ...payment, type: 'payment_received' },
        timestamp: new Date().toISOString(),
        read: false
    };

    addNotification(notification);
    playNotificationSound();
    showBrowserNotification(notification);
    showToastNotification(notification);
}

function handleAdmissionNotification(data) {
    const admission = data.admission || data;

    const notification = {
        id: generateId(),
        type: 'admission_created',
        title: 'New Admission',
        message: `${admission.studentName || admission.name || 'Student'} - ${admission.course || 'N/A'}`,
        data: { ...admission, type: 'admission_created' },
        timestamp: new Date().toISOString(),
        read: false
    };

    addNotification(notification);
    playNotificationSound();
    showBrowserNotification(notification);
    showToastNotification(notification);
}

/* ======================
NOTIFICATION MANAGEMENT
====================== */
function addNotification(notification) {
    // Add to beginning of array
    notifications.unshift(notification);

    // Keep only last 50 notifications
    if (notifications.length > 50) {
        notifications = notifications.slice(0, 50);
    }

    // Save to localStorage
    saveNotifications();

    // Update UI
    updateNotificationBell();
    renderNotificationDropdown();

    // Flash the bell icon to grab attention
    flashNotificationBell();

    // Change browser tab title
    flashTabTitle();
}

function markAsRead(notificationId) {
    const notification = notifications.find(n => n.id === notificationId);
    if (notification) {
        notification.read = true;
        saveNotifications();
        updateNotificationBell();
        renderNotificationDropdown();
    }
}

function markAllAsRead() {
    notifications.forEach(n => n.read = true);
    saveNotifications();
    updateNotificationBell();
    renderNotificationDropdown();
}

function clearAllNotifications() {
    notifications = [];
    saveNotifications();
    updateNotificationBell();
    renderNotificationDropdown();
}

/* ======================
LOCAL STORAGE
====================== */
function saveNotifications() {
    localStorage.setItem('notifications', JSON.stringify(notifications));
    // Trigger storage event for cross-tab sync
    localStorage.setItem('notifications_updated', Date.now().toString());
}

function loadNotifications() {
    const stored = localStorage.getItem('notifications');
    if (stored) {
        try {
            notifications = JSON.parse(stored);
        } catch (e) {
            console.error('Failed to load notifications:', e);
            notifications = [];
        }
    }
}

function setupCrossTabSync() {
    window.addEventListener('storage', (e) => {
        if (e.key === 'notifications_updated') {
            loadNotifications();
            updateNotificationBell();
            renderNotificationDropdown();
        }
    });
}

/* ======================
UI COMPONENTS
====================== */
function renderNotificationBell() {
    // Check if bell already exists
    if (document.getElementById('notificationBell')) {
        console.log('Notification bell already exists');
        return;
    }

    // Find header in all pages
    const header = document.querySelector('header');
    if (!header) {
        console.log('Header not found, retrying in 100ms...');
        setTimeout(renderNotificationBell, 100);
        return;
    }

    console.log('Header found, rendering notification bell...');

    // Create notification bell container
    const bellContainer = document.createElement('div');
    bellContainer.className = 'relative ml-auto';
    bellContainer.id = 'notificationBellContainer';
    bellContainer.innerHTML = `
        <button id="notificationBell" class="relative p-2.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200 hover:shadow-md" onclick="toggleNotificationDropdown()">
            <i data-lucide="bell" class="w-5 h-5"></i>
            <span id="notificationBadge" class="hidden absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs rounded-full flex items-center justify-center font-bold shadow-lg shadow-red-500/30 animate-bounce">0</span>
        </button>
        <div id="notificationDropdown" class="hidden absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 max-h-96 overflow-hidden">
            <div class="p-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-white">
                <h3 class="font-semibold text-gray-800">Notifications</h3>
                <div class="flex items-center gap-2">
                    <button onclick="toggleSound()" class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="${soundEnabled ? 'Mute' : 'Unmute'}">
                        <i data-lucide="${soundEnabled ? 'volume-2' : 'volume-x'}" class="w-4 h-4"></i>
                    </button>
                    <button onclick="markAllAsRead()" class="text-xs text-blue-600 hover:text-blue-700 font-medium">Mark all read</button>
                    <button onclick="clearAllNotifications()" class="text-xs text-red-600 hover:text-red-700 font-medium">Clear</button>
                </div>
            </div>
            <div id="notificationList" class="overflow-y-auto max-h-72">
                <!-- Notifications will be rendered here -->
            </div>
            <div id="noNotifications" class="hidden p-8 text-center">
                <i data-lucide="bell-off" class="w-10 h-10 text-gray-300 mx-auto mb-2"></i>
                <p class="text-sm text-gray-500">No notifications</p>
            </div>
        </div>
    `;

    // Insert bell container before logout button
    const logoutBtn = header.querySelector('#logoutBtn') || header.querySelector('button[onclick="logout()"]');
    if (logoutBtn) {
        console.log('Found logout button, inserting bell before it');
        // If logout button is direct child of header, insert before it
        if (logoutBtn.parentElement === header) {
            header.insertBefore(bellContainer, logoutBtn);
        } else {
            logoutBtn.parentElement.insertBefore(bellContainer, logoutBtn);
        }
    } else {
        // If no logout button, append to header
        console.log('No logout button found, appending to header');
        header.appendChild(bellContainer);
    }

    // Ensure header has flex layout for ml-auto to work
    if (!header.classList.contains('flex')) {
        header.classList.add('flex', 'items-center', 'justify-between');
    }

    // Initialize Lucide icons
    lucide.createIcons();

    // Render notifications
    updateNotificationBell();
    renderNotificationDropdown();

    console.log('Notification bell rendered successfully');
}

function updateNotificationBell() {
    const badge = document.getElementById('notificationBadge');
    const unreadCount = notifications.filter(n => !n.read).length;

    if (badge) {
        if (unreadCount > 0) {
            badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}

function flashNotificationBell() {
    const bell = document.getElementById('notificationBell');
    if (!bell) return;

    // Flash animation
    bell.classList.add('animate-pulse', 'bg-blue-100');

    // Remove animation after 2 seconds
    setTimeout(() => {
        bell.classList.remove('animate-pulse', 'bg-blue-100');
    }, 2000);
}

let originalTitle = document.title;
let titleFlashInterval = null;

function flashTabTitle() {
    // Stop any existing title flash
    if (titleFlashInterval) {
        clearInterval(titleFlashInterval);
    }

    let showNotification = true;
    const unreadCount = notifications.filter(n => !n.read).length;

    titleFlashInterval = setInterval(() => {
        if (showNotification) {
            document.title = `(${unreadCount}) New Notification - SSSAM CRM`;
        } else {
            document.title = originalTitle;
        }
        showNotification = !showNotification;
    }, 1000);

    // Stop flashing after 10 seconds
    setTimeout(() => {
        if (titleFlashInterval) {
            clearInterval(titleFlashInterval);
            titleFlashInterval = null;
            document.title = originalTitle;
        }
    }, 10000);
}

// Stop title flash when user focuses on the tab
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && titleFlashInterval) {
        clearInterval(titleFlashInterval);
        titleFlashInterval = null;
        document.title = originalTitle;
    }
});

function renderNotificationDropdown() {
    const list = document.getElementById('notificationList');
    const noNotifications = document.getElementById('noNotifications');

    if (!list || !noNotifications) return;

    if (notifications.length === 0) {
        list.innerHTML = '';
        noNotifications.classList.remove('hidden');
        return;
    }

    noNotifications.classList.add('hidden');

    // Show max 10 notifications
    const recentNotifications = notifications.slice(0, 10);

    list.innerHTML = recentNotifications.map(notification => {
        const isEnquiry = notification.type === 'enquiry';
        const isAdmission = notification.type === 'admission';
        let colorClass, icon;

        if (isEnquiry) {
            colorClass = 'bg-blue-100 text-blue-600';
            icon = 'user-plus';
        } else if (isAdmission) {
            colorClass = 'bg-purple-100 text-purple-600';
            icon = 'user-check';
        } else {
            colorClass = 'bg-green-100 text-green-600';
            icon = 'wallet';
        }

        const readClass = notification.read ? 'opacity-60' : 'bg-blue-50';

        return `
            <div class="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${readClass}" onclick="handleNotificationClick('${notification.id}')">
                <div class="flex items-start gap-3">
                    <div class="w-10 h-10 ${colorClass} rounded-full flex items-center justify-center flex-shrink-0">
                        <i data-lucide="${icon}" class="w-5 h-5"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between mb-1">
                            <p class="font-medium text-gray-800 text-sm ${!notification.read ? 'font-semibold' : ''}">${notification.title}</p>
                            <span class="text-xs text-gray-400">${getRelativeTime(notification.timestamp)}</span>
                        </div>
                        <p class="text-sm text-gray-600 truncate">${notification.message}</p>
                        ${!notification.read ? `
                            <button onclick="event.stopPropagation(); markAsRead('${notification.id}')" class="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium">
                                Mark as read
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    lucide.createIcons();
}

function toggleNotificationDropdown() {
    const dropdown = document.getElementById('notificationDropdown');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
    }
}

function handleNotificationClick(notificationId) {
    const notification = notifications.find(n => n.id === notificationId);
    if (!notification) return;

    // Mark as read
    markAsRead(notificationId);

    // Navigate based on type
    if (notification.type === 'enquiry') {
        const enquiryId = notification.data._id || notification.data.id;
        if (enquiryId) {
            window.location.href = `enquiry-detail.html?id=${enquiryId}`;
        }
    } else if (notification.type === 'payment') {
        const admissionId = notification.data.admissionId;
        if (admissionId) {
            window.location.href = `admission-detail.html?id=${admissionId}`;
        } else {
            window.location.href = 'payments.html';
        }
    } else if (notification.type === 'admission') {
        const admissionId = notification.data._id || notification.data.id;
        if (admissionId) {
            window.location.href = `admission-detail.html?id=${admissionId}`;
        } else {
            window.location.href = 'admissions.html';
        }
    }

    // Close dropdown
    toggleNotificationDropdown();
}

/* ======================
TOAST NOTIFICATION
====================== */
function showToastNotification(notification) {
    // Remove existing toast if any
    const existingToast = document.getElementById('notificationToast');
    if (existingToast) {
        existingToast.remove();
    }

    const isEnquiry = notification.type === 'enquiry';
    const isAdmission = notification.type === 'admission';
    let colorClass, icon, buttonColorClass;

    if (isEnquiry) {
        colorClass = 'border-blue-500 bg-blue-50';
        icon = 'user-plus';
        buttonColorClass = 'text-blue-600 hover:text-blue-700';
    } else if (isAdmission) {
        colorClass = 'border-purple-500 bg-purple-50';
        icon = 'user-check';
        buttonColorClass = 'text-purple-600 hover:text-purple-700';
    } else {
        colorClass = 'border-green-500 bg-green-50';
        icon = 'wallet';
        buttonColorClass = 'text-green-600 hover:text-green-700';
    }

    const toast = document.createElement('div');
    toast.id = 'notificationToast';
    toast.className = `fixed top-4 right-4 z-50 p-4 rounded-xl shadow-2xl border-l-4 ${colorClass} max-w-sm transform transition-all duration-300 translate-x-full`;
    toast.innerHTML = `
        <div class="flex items-start gap-3">
            <div class="w-10 h-10 ${isEnquiry ? 'bg-blue-100 text-blue-600' : isAdmission ? 'bg-purple-100 text-purple-600' : 'bg-green-100 text-green-600'} rounded-full flex items-center justify-center flex-shrink-0">
                <i data-lucide="${icon}" class="w-5 h-5"></i>
            </div>
            <div class="flex-1">
                <p class="font-semibold text-gray-800 text-sm">${notification.title}</p>
                <p class="text-sm text-gray-600 mt-1">${notification.message}</p>
                <div class="flex items-center gap-2 mt-2">
                    <button onclick="handleNotificationClick('${notification.id}')" class="text-xs font-medium ${buttonColorClass}">
                        View Details
                    </button>
                    <button onclick="dismissToast()" class="text-xs text-gray-500 hover:text-gray-700">
                        Dismiss
                    </button>
                </div>
            </div>
            <button onclick="dismissToast()" class="text-gray-400 hover:text-gray-600">
                <i data-lucide="x" class="w-4 h-4"></i>
            </button>
        </div>
    `;

    document.body.appendChild(toast);
    lucide.createIcons();

    // Animate in
    setTimeout(() => {
        toast.classList.remove('translate-x-full');
    }, 10);

    // Auto dismiss after 5 seconds
    setTimeout(() => {
        dismissToast();
    }, 5000);
}

function dismissToast() {
    const toast = document.getElementById('notificationToast');
    if (toast) {
        toast.classList.add('translate-x-full');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }
}

/* ======================
SOUND NOTIFICATION
====================== */
function playNotificationSound() {
    if (!soundEnabled) return;

    try {
        notificationSound.currentTime = 0;
        const playPromise = notificationSound.play();

        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log('Sound played successfully');
            }).catch(error => {
                console.log('Sound play failed:', error);
                // Try to create audio context and play - single beep
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.value = 1000;
                oscillator.type = 'sine';
                gainNode.gain.value = 0.3;

                oscillator.start();
                oscillator.stop(audioContext.currentTime + 0.2);
            });
        }
    } catch (e) {
        console.log('Sound error:', e);
    }
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    localStorage.setItem('notificationSoundEnabled', soundEnabled.toString());

    // Update icon
    const bellIcon = document.querySelector('#notificationBellContainer button[onclick="toggleSound()"] i');
    if (bellIcon) {
        bellIcon.setAttribute('data-lucide', soundEnabled ? 'volume-2' : 'volume-x');
        lucide.createIcons();
    }

    // Update title
    const button = document.querySelector('#notificationBellContainer button[onclick="toggleSound()"]');
    if (button) {
        button.title = soundEnabled ? 'Mute' : 'Unmute';
    }
}

/* ======================
BROWSER NOTIFICATIONS
====================== */
function requestBrowserNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                console.log('Browser notification permission granted');
            }
        });
    }
}

function showBrowserNotification(notification) {
    if ('Notification' in window && Notification.permission === 'granted') {
        const browserNotification = new Notification(notification.title, {
            body: notification.message,
            icon: '/favicon.ico',
            tag: notification.id,
            requireInteraction: true,
            vibrate: [200, 100, 200]
        });

        // Click on notification to focus the page
        browserNotification.onclick = function () {
            window.focus();
            browserNotification.close();
            handleNotificationClick(notification.id);
        };

        // Auto close after 5 seconds
        setTimeout(() => {
            browserNotification.close();
        }, 5000);
    }
}

/* ======================
UTILITY FUNCTIONS
====================== */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getRelativeTime(timestamp) {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (e) {
        return {};
    }
}

/* ======================
NOTIFICATION MODAL (Center Popup)
====================== */
function renderNotificationModal() {
    // Check if modal already exists
    if (document.getElementById('notificationModal')) return;

    const modal = document.createElement('div');
    modal.id = 'notificationModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm hidden items-center justify-center z-[1000]';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 transform scale-95 transition-transform duration-200" id="notificationModalContent">
            <div class="p-6">
                <div class="flex items-center gap-4 mb-4">
                    <div id="modalIcon" class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <i data-lucide="bell" class="w-6 h-6 text-blue-600"></i>
                    </div>
                    <div class="flex-1">
                        <h3 id="modalTitle" class="text-lg font-semibold text-gray-800">New Notification</h3>
                        <p id="modalTime" class="text-sm text-gray-500">Just now</p>
                    </div>
                    <button onclick="closeNotificationModal()" class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>
                <p id="modalBody" class="text-gray-600 mb-6">Notification message here</p>
                <div class="flex items-center justify-end gap-3">
                    <button onclick="closeNotificationModal()" class="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
                        Dismiss
                    </button>
                    <button onclick="handleNotificationModalAction()" id="modalActionBtn" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                        View Details
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

function showNotificationModal(notification, data) {
    const modal = document.getElementById('notificationModal');
    if (!modal) {
        renderNotificationModal();
    }

    currentNotificationData = data;

    // Set content
    document.getElementById('modalTitle').textContent = notification.title || 'New Notification';
    document.getElementById('modalBody').textContent = notification.body || '';
    document.getElementById('modalTime').textContent = 'Just now';

    // Set icon based on type
    const iconDiv = document.getElementById('modalIcon');
    const iconEl = iconDiv.querySelector('i');

    const type = data?.type || 'general';
    let iconClass = 'bell';
    let bgClass = 'bg-blue-100';
    let colorClass = 'text-blue-600';

    switch (type) {
        case 'enquiry_created':
            iconClass = 'user-plus';
            bgClass = 'bg-blue-100';
            colorClass = 'text-blue-600';
            break;
        case 'admission_created':
            iconClass = 'user-check';
            bgClass = 'bg-purple-100';
            colorClass = 'text-purple-600';
            break;
        case 'payment_received':
            iconClass = 'wallet';
            bgClass = 'bg-green-100';
            colorClass = 'text-green-600';
            break;
        case 'payment_due':
        case 'payment_overdue':
            iconClass = 'alert-circle';
            bgClass = 'bg-amber-100';
            colorClass = 'text-amber-600';
            break;
        case 'followup_reminder':
            iconClass = 'phone';
            bgClass = 'bg-orange-100';
            colorClass = 'text-orange-600';
            break;
    }

    iconDiv.className = `w-12 h-12 ${bgClass} rounded-xl flex items-center justify-center`;
    iconEl.setAttribute('data-lucide', iconClass);
    iconEl.className = `w-6 h-6 ${colorClass}`;

    lucide.createIcons();

    // Show modal
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Animate in
    setTimeout(() => {
        const content = document.getElementById('notificationModalContent');
        content.classList.remove('scale-95');
        content.classList.add('scale-100');
    }, 10);

    // Auto-close after 10 seconds
    setTimeout(() => {
        closeNotificationModal();
    }, 10000);
}

function closeNotificationModal() {
    const modal = document.getElementById('notificationModal');
    if (!modal) return;

    const content = document.getElementById('notificationModalContent');
    content.classList.remove('scale-100');
    content.classList.add('scale-95');

    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        currentNotificationData = null;
    }, 200);
}

function handleNotificationModalAction() {
    if (!currentNotificationData) {
        closeNotificationModal();
        return;
    }

    const type = currentNotificationData.type;
    let url = 'dashboard.html';

    switch (type) {
        case 'enquiry_created':
            url = `enquiry-detail.html?id=${currentNotificationData.enquiryId || currentNotificationData._id}`;
            break;
        case 'admission_created':
            url = `admission-detail.html?id=${currentNotificationData.admissionId || currentNotificationData._id}`;
            break;
        case 'payment_received':
        case 'payment_due':
        case 'payment_overdue':
            url = `admission-detail.html?id=${currentNotificationData.admissionId}`;
            break;
        case 'followup_reminder':
        case 'stagnant_enquiry':
            url = 'enquiries.html';
            break;
    }

    closeNotificationModal();
    window.location.href = url;
}

/* ======================
LOGIN WELCOME POPUP
====================== */
async function showLoginWelcomePopup() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const response = await fetch(`${getBaseUrl()}/api/notifications/today-summary`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.success && result.data) {
            const summary = result.data;
            renderWelcomeModal(summary);
        }
    } catch (error) {
        console.log('Today summary not available:', error);
    }
}

function renderWelcomeModal(summary) {
    // Check if modal already exists
    if (document.getElementById('welcomeModal')) return;

    const totalPending = (summary.pendingFollowUps || 0) +
        (summary.todayPaymentDues || 0) +
        (summary.overdueInstallments || 0) +
        (summary.stagnantEnquiries || 0);

    if (totalPending === 0) return; // Don't show if nothing pending

    const modal = document.createElement('div');
    modal.id = 'welcomeModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000]';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 transform scale-95 transition-transform duration-200" id="welcomeModalContent">
            <div class="p-6">
                <div class="text-center mb-6">
                    <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <i data-lucide="layout-dashboard" class="w-8 h-8 text-white"></i>
                    </div>
                    <h2 class="text-xl font-bold text-gray-800">Good ${getTimeOfDay()}!</h2>
                    <p class="text-gray-500 mt-1">Here's your today's work summary</p>
                </div>
                
                <div class="space-y-3 mb-6">
                    ${summary.pendingFollowUps > 0 ? `
                        <div class="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <i data-lucide="phone" class="w-5 h-5 text-blue-600"></i>
                                </div>
                                <span class="font-medium text-gray-700">Pending Follow-ups</span>
                            </div>
                            <span class="text-lg font-bold text-blue-600">${summary.pendingFollowUps}</span>
                        </div>
                    ` : ''}
                    
                    ${summary.todayPaymentDues > 0 ? `
                        <div class="flex items-center justify-between p-3 bg-green-50 rounded-xl">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                    <i data-lucide="wallet" class="w-5 h-5 text-green-600"></i>
                                </div>
                                <span class="font-medium text-gray-700">Payments Due Today</span>
                            </div>
                            <span class="text-lg font-bold text-green-600">${summary.todayPaymentDues}</span>
                        </div>
                    ` : ''}
                    
                    ${summary.overdueInstallments > 0 ? `
                        <div class="flex items-center justify-between p-3 bg-red-50 rounded-xl">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                                    <i data-lucide="alert-circle" class="w-5 h-5 text-red-600"></i>
                                </div>
                                <span class="font-medium text-gray-700">Overdue Installments</span>
                            </div>
                            <span class="text-lg font-bold text-red-600">${summary.overdueInstallments}</span>
                        </div>
                    ` : ''}
                    
                    ${summary.stagnantEnquiries > 0 ? `
                        <div class="flex items-center justify-between p-3 bg-amber-50 rounded-xl">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                                    <i data-lucide="clock" class="w-5 h-5 text-amber-600"></i>
                                </div>
                                <span class="font-medium text-gray-700">Stagnant Enquiries</span>
                            </div>
                            <span class="text-lg font-bold text-amber-600">${summary.stagnantEnquiries}</span>
                        </div>
                    ` : ''}
                </div>
                
                <button onclick="closeWelcomeModal()" class="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-xl transition-all">
                    Let's Get Started
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    lucide.createIcons();

    // Animate in
    setTimeout(() => {
        const content = document.getElementById('welcomeModalContent');
        content.classList.remove('scale-95');
        content.classList.add('scale-100');
    }, 10);
}

function closeWelcomeModal() {
    const modal = document.getElementById('welcomeModal');
    if (!modal) return;

    const content = document.getElementById('welcomeModalContent');
    content.classList.remove('scale-100');
    content.classList.add('scale-95');

    setTimeout(() => {
        modal.remove();
    }, 200);
}

function getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Morning';
    if (hour < 17) return 'Afternoon';
    return 'Evening';
}

function getBaseUrl() {
    // Get from api.js or use default
    if (typeof BASE_URL !== 'undefined') {
        return BASE_URL.replace('/api', '');
    }
    return 'http://localhost:5000';
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('notificationDropdown');
    const bell = document.getElementById('notificationBell');

    if (dropdown && !dropdown.classList.contains('hidden')) {
        if (!dropdown.contains(e.target) && !bell.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    }
});

// Load sound preference
const soundPreference = localStorage.getItem('notificationSoundEnabled');
if (soundPreference !== null) {
    soundEnabled = soundPreference === 'true';
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNotifications);
} else {
    initNotifications();
}

// Also try to render bell after a delay in case DOM is not ready
setTimeout(() => {
    if (!document.getElementById('notificationBell')) {
        console.log('Notification bell not found after initial load, rendering now...');
        renderNotificationBell();
    }
}, 500);
