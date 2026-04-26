/* ======================
NOTIFICATION CENTER
====================== */

// Socket.IO connection
let socket = null;
let notifications = [];
let soundEnabled = true;

// Sound notification (base64 encoded simple chime)
const notificationSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQQAQ5Xs4N9vQgAAX57s5+RwSwAAKjm7fXwXVAAAKrr8fH1YlAAAKzv9/P2aSAAAQrD///+pWAAACMH///+gXAAAAsD///+fVAAAAsT///+dUAAAsgD///9zTAAAswD///9ySAAAtAD///9xRAAAtQD///9wQAAAsgD///9vPAAAswD///9uOAAAsAD///9tNAAAqAD///9sMAAApAD///9rKAAAoAD///9qJAAAnAD///9pIAAAmAD///9oHAAAlAD///9nGAAAkAD///9mFAAAjAD///9lEAAAiAD///9kDAAAhAD///9jCAAAgAD///9iBAAA/fz///9hAAA+fn///9gAAA9fX///9fAAA8PD///9eAAA7Oz///9dAAA6ur///9cAAA5ub///9bAAA4eH///9aAAA3d3///9YAAA2dn///9XAAA1tb///9VAAA0bG///9TAAAzMz///9RAAAyMj///9PAAAxMT///9NAAAwMD///9LAAAuLi///9JAAAqKj///9HAAAoKC///9FAAAjIy///9DAAAiIi///9BAAAgIC///9+AAAfHx///9+AAAeHh///9+AAAd3d///9+AAAcnJ///9+AAAbW1///9+AAAaWl///9+AAAZWV///9+AAAYGB///9+AAAXFx///9+AAAWVl///9+AAAVFR///9+AAAUFB///9+AAATEx///9+AAASkp///9+AAAQkJ///9+AAAPj4///9+AAAOjo///9+AAANzc///9+AAAMjI///9+AAALi4///9+AAAKCg///9+AAAJiY///9+AAAIiI///9+AAAHh4///9+AAAGhoa///9+AAAFhY///9+AAAEBQ///9+AAADAw///9+AAABAQ///9+AAAA');

// Initialize notification center
function initNotifications() {
    // Load notifications from localStorage
    loadNotifications();
    
    // Initialize Socket.IO
    initSocket();
    
    // Setup cross-tab sync
    setupCrossTabSync();
    
    // Render notification bell
    renderNotificationBell();
    
    // Request browser notification permission
    requestBrowserNotificationPermission();
}

/* ======================
SOCKET.IO CONNECTION
====================== */
function initSocket() {
    // Check if user is authenticated
    const token = localStorage.getItem('token');
    if (!token) return;
    
    // Connect to Socket.IO server
    socket = io('http://localhost:5000', {
        auth: { token },
        transports: ['websocket', 'polling']
    });
    
    // Connection events
    socket.on('connect', () => {
        console.log('Socket.IO connected');
    });
    
    socket.on('disconnect', () => {
        console.log('Socket.IO disconnected');
    });
    
    socket.on('reconnect', () => {
        console.log('Socket.IO reconnected');
    });
    
    // Listen for new enquiries
    socket.on('enquiry:created', (data) => {
        handleEnquiryNotification(data);
    });
    
    // Listen for payments
    socket.on('payment:received', (data) => {
        handlePaymentNotification(data);
    });
    
    // Listen for admissions
    socket.on('admission:created', (data) => {
        handleAdmissionNotification(data);
    });
}

/* ======================
ENQUIRY NOTIFICATION
====================== */
function handleEnquiryNotification(data) {
    const enquiry = data.enquiry;
    const user = getCurrentUser();
    
    // All authenticated users receive enquiry notifications
    const notification = {
        id: generateId(),
        type: 'enquiry',
        title: 'New Enquiry',
        message: `${enquiry.name} - ${enquiry.course || enquiry.courseInterested || 'N/A'}`,
        data: enquiry,
        timestamp: new Date().toISOString(),
        read: false
    };
    
    addNotification(notification);
    playNotificationSound();
    showToastNotification(notification);
}

/* ======================
PAYMENT NOTIFICATION
====================== */
function handlePaymentNotification(data) {
    const payment = data.payment;
    const user = getCurrentUser();
    
    // Filter: Admin OR counselor who created the payment
    if (user.role !== 'admin' && user.id !== payment.receivedBy) {
        return;
    }
    
    const notification = {
        id: generateId(),
        type: 'payment',
        title: 'Payment Received',
        message: `₹${payment.amount} - ${payment.paymentType || 'Payment'}`,
        data: payment,
        timestamp: new Date().toISOString(),
        read: false
    };
    
    addNotification(notification);
    playNotificationSound();
    showBrowserNotification(notification);
    showToastNotification(notification);
}

/* ======================
ADMISSION NOTIFICATION
====================== */
function handleAdmissionNotification(data) {
    const admission = data.admission;
    const user = getCurrentUser();
    
    // All authenticated users receive admission notifications
    const notification = {
        id: generateId(),
        type: 'admission',
        title: 'New Admission',
        message: `${admission.studentName || admission.name || 'Student'} - ${admission.course || 'N/A'}`,
        data: admission,
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
        browserNotification.onclick = function() {
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
