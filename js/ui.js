/**
 * UI Utilities Module
 * Institute Enquiry Management System
 */

/**
 * Show toast notification
 * @param {string} type - 'success' | 'error' | 'warning' | 'info'
 * @param {string} title - Toast title
 * @param {string} message - Toast message
 */
function showToast(type, title, message) {
    const toast = document.getElementById('toast');
    const toastIcon = document.getElementById('toastIcon');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');
    
    if (!toast) return;
    
    // Define icons
    const icons = {
        success: `<svg class="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
        error: `<svg class="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
        warning: `<svg class="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`,
        info: `<svg class="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    };
    
    // Set content
    toastIcon.innerHTML = icons[type] || icons.info;
    toastTitle.textContent = title;
    toastMessage.textContent = message;
    
    // Show toast
    toast.classList.remove('translate-x-full');
    
    // Hide after 4 seconds
    setTimeout(() => {
        hideToast();
    }, 4000);
}

/**
 * Hide toast notification
 */
function hideToast() {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.classList.add('translate-x-full');
    }
}

/**
 * Format date for display
 * @param {string|Date} date - Date to format
 * @param {boolean} includeTime - Whether to include time
 * @returns {string} Formatted date string
 */
function formatDate(date, includeTime = false) {
    if (!date) return '-';
    
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    
    const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    };
    
    if (includeTime) {
        options.hour = '2-digit';
        options.minute = '2-digit';
    }
    
    return d.toLocaleDateString('en-IN', options);
}

/**
 * Format currency for display
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
    
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

/**
 * Format phone number for display
 * @param {string} phone - Phone number to format
 * @returns {string} Formatted phone number
 */
function formatPhone(phone) {
    if (!phone) return '-';
    
    // Remove non-numeric characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Format as +91 XXXXX XXXXX if 10 digits
    if (cleaned.length === 10) {
        return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
    }
    
    // Format as +91 XXXXX XXXXX if includes country code
    if (cleaned.length === 12 && cleaned.startsWith('91')) {
        return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
    }
    
    return phone;
}

/**
 * Get status badge HTML
 * @param {string} status - Status value
 * @returns {string} HTML for status badge
 */
function getStatusBadge(status) {
    const statusClasses = {
        'New': 'status-new',
        'Attempted': 'status-attempted',
        'Connected': 'status-connected',
        'Interested': 'status-interested',
        'Follow-up': 'status-follow-up',
        'Converted': 'status-converted',
        'Lost': 'status-lost',
    };
    
    const className = statusClasses[status] || 'bg-gray-100 text-gray-800';
    
    return `<span class="status-badge ${className}">${status || 'Unknown'}</span>`;
}

/**
 * Check if follow-up date is overdue
 * @param {string|Date} followUpDate - Follow-up date
 * @returns {boolean} True if overdue
 */
function isOverdue(followUpDate) {
    if (!followUpDate) return false;
    
    const now = new Date();
    const followUp = new Date(followUpDate);
    
    return followUp < now;
}

/**
 * Check if enquiry is unassigned
 * @param {Object} enquiry - Enquiry object
 * @returns {boolean} True if unassigned
 */
function isUnassigned(enquiry) {
    return !enquiry.assignedTo || enquiry.assignedTo === null || enquiry.assignedTo === undefined;
}

/**
 * Get row class based on enquiry status
 * @param {Object} enquiry - Enquiry object
 * @returns {string} CSS class for row
 */
function getEnquiryRowClass(enquiry) {
    if (!enquiry) return '';
    
    if (isOverdue(enquiry.followUpDate)) {
        return 'row-overdue';
    }
    
    if (isUnassigned(enquiry)) {
        return 'row-unassigned';
    }
    
    return '';
}

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function
 */
function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} length - Maximum length
 * @returns {string} Truncated text
 */
function truncateText(text, length = 50) {
    if (!text || text.length <= length) return text;
    return text.substring(0, length) + '...';
}

/**
 * Generate pagination HTML
 * @param {number} currentPage - Current page number
 * @param {number} totalPages - Total number of pages
 * @param {Function} onPageChange - Callback when page changes
 * @returns {string} HTML for pagination
 */
function generatePagination(currentPage, totalPages, onPageChange) {
    if (totalPages <= 1) return '';
    
    let html = '';
    
    // Previous button
    const prevDisabled = currentPage === 1 ? 'disabled' : '';
    html += `<button onclick="${onPageChange}(${currentPage - 1})" ${prevDisabled} class="pagination-btn px-3 py-1 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>`;
    
    // Page numbers
    html += '<div class="flex space-x-1">';
    
    for (let i = 1; i <= totalPages; i++) {
        // Show first, last, current, and pages around current
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            const activeClass = i === currentPage ? 'active' : '';
            html += `<button onclick="${onPageChange}(${i})" class="pagination-btn px-3 py-1 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 ${activeClass}">${i}</button>`;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            html += `<span class="px-2 text-gray-400">...</span>`;
        }
    }
    
    html += '</div>';
    
    // Next button
    const nextDisabled = currentPage === totalPages ? 'disabled' : '';
    html += `<button onclick="${onPageChange}(${currentPage + 1})" ${nextDisabled} class="pagination-btn px-3 py-1 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Next</button>`;
    
    return html;
}

/**
 * Format relative time
 * @param {string|Date} date - Date to format
 * @returns {string} Relative time string
 */
function formatRelativeTime(date) {
    if (!date) return '-';
    
    const now = new Date();
    const then = new Date(date);
    const diffInSeconds = Math.floor((now - then) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    
    return formatDate(date);
}

/**
 * Show confirmation dialog
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message
 * @param {Function} onConfirm - Callback when confirmed
 */
function showConfirm(title, message, onConfirm) {
    // Create modal if not exists
    let modal = document.getElementById('confirmModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'confirmModal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-center justify-center';
        modal.innerHTML = `
            <div class="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 transform transition-all">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h3 id="confirmTitle" class="text-lg font-semibold text-gray-800"></h3>
                </div>
                <div class="p-6">
                    <p id="confirmMessage" class="text-gray-600"></p>
                    <div class="flex justify-end space-x-3 mt-6">
                        <button id="confirmCancel" class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                            Cancel
                        </button>
                        <button id="confirmOk" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">
                            Confirm
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    // Set content
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    
    // Show modal
    modal.classList.remove('hidden');
    
    // Handle buttons
    const cancelBtn = document.getElementById('confirmCancel');
    const okBtn = document.getElementById('confirmOk');
    
    const closeModal = () => {
        modal.classList.add('hidden');
        cancelBtn.removeEventListener('click', closeModal);
        okBtn.removeEventListener('click', handleConfirm);
    };
    
    const handleConfirm = () => {
        closeModal();
        onConfirm();
    };
    
    cancelBtn.addEventListener('click', closeModal);
    okBtn.addEventListener('click', handleConfirm);
    
    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

/**
 * Set form field value
 * @param {string} id - Field ID
 * @param {string|number} value - Field value
 */
function setFieldValue(id, value) {
    const field = document.getElementById(id);
    if (field) {
        field.value = value || '';
    }
}

/**
 * Get form field value
 * @param {string} id - Field ID
 * @returns {string} Field value
 */
function getFieldValue(id) {
    const field = document.getElementById(id);
    return field ? field.value.trim() : '';
}

/**
 * Disable form elements
 * @param {HTMLElement} container - Container element
 * @param {boolean} disable - Whether to disable
 */
function setFormDisabled(container, disable = true) {
    const elements = container.querySelectorAll('input, select, textarea, button:not(.exclude-disable)');
    elements.forEach(el => {
        el.disabled = disable;
    });
    
    if (disable) {
        container.classList.add('locked-overlay');
    } else {
        container.classList.remove('locked-overlay');
    }
}

// Export UI utilities
window.showToast = showToast;
window.hideToast = hideToast;
window.formatDate = formatDate;
window.formatCurrency = formatCurrency;
window.formatPhone = formatPhone;
window.getStatusBadge = getStatusBadge;
window.isOverdue = isOverdue;
window.isUnassigned = isUnassigned;
window.getEnquiryRowClass = getEnquiryRowClass;
window.debounce = debounce;
window.truncateText = truncateText;
window.generatePagination = generatePagination;
window.formatRelativeTime = formatRelativeTime;
window.showConfirm = showConfirm;
window.setFieldValue = setFieldValue;
window.getFieldValue = getFieldValue;
window.setFormDisabled = setFormDisabled;
