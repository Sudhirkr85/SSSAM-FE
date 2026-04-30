// const BASE_URL = 'http://localhost:5000/api';
const BASE_URL = 'https://sssam-r3pz.onrender.com/api'

/* ======================
ENDPOINTS
====================== */
const API_ENDPOINTS = {
    ENQUIRIES: {
        GET_ALL: '/enquiries',                           // Counselor: assigned + unassigned only
        GET_ALL_ADMIN: '/enquiries/all',                 // Admin: all enquiries (read-only for counselor)
        GET_BY_ID: (id) => `/enquiries/${id}`,
        CREATE: '/enquiries',
        
        UPDATE_STATUS: (id) => `/enquiries/${id}/update`,
        DELETE: (id) => `/enquiries/${id}`,               // Admin only
        BULK_UPLOAD: '/bulk-upload/enquiries',            // Admin & Counselor
        ASSIGN: (id) => `/enquiries/${id}/assign`         // Admin only
    },
    ADMISSIONS: {
        GET_ALL: '/admissions',
        GET_BY_ID: (id) => `/admissions/${id}`,
        GET_BY_ENQUIRY: (enquiryId) => `/admissions/by-enquiry/${enquiryId}`,
        CREATE_FROM_ENQUIRY: (enquiryId) => `/admissions/from-enquiry/${enquiryId}`,
        UPDATE_FEES: (id) => `/admissions/${id}/fees`,
        LOCK: (id) => `/admissions/${id}/lock`,
        PAYMENT_PLAN: (id) => `/admissions/${id}/payment-plan`,
        CANCEL: (id) => `/admissions/${id}/cancel`
    },
    PAYMENTS: {
        CREATE: '/payments',
        GET_ALL: '/payments',
        GET_BY_ADMISSION: (admissionId) => `/payments/admission/${admissionId}`,
        GET_BY_ID: (id) => `/payments/${id}`,
        UPDATE: (id) => `/payments/${id}`,
        CHECK_OVERDUE: '/payments/check-overdue',
        REFUND: '/payments'
    },
    REPORTS: {
        SUMMARY: '/reports/summary',
        ADMISSIONS: '/reports/admissions',
        FEES: '/reports/fees',
        INSTALLMENT_ALERTS: '/reports/installments/alerts',
        COUNSELOR_PERFORMANCE: '/reports/counselor-performance',
        COURSE_PERFORMANCE: '/reports/course-performance'
    },
    DASHBOARD: {
        GET: '/dashboard',                    // Full dashboard stats
        REVENUE: '/dashboard/revenue',        // Admin only
        ENQUIRIES: '/dashboard/enquiries',    // Admin only
        FOLLOWUPS: '/dashboard/followups',    // Overdue & today followups
        TODAY_CALLS: '/dashboard/today-calls', // Today's calls with summary
        COUNSELOR: '/dashboard/counselor'     // Counselor only
    },
    AUTH: {
        LOGIN: '/auth/login',
        REGISTER: '/auth/register'
    },
    USERS: {
        GET_ALL: '/users',
        GET_COUNSELORS: '/users/counselors'
    }
};

/* ======================
AXIOS INSTANCE
====================== */
const api = axios.create({
    baseURL: BASE_URL
});

/* ======================
REQUEST INTERCEPTOR
====================== */
api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

/* ======================
RESPONSE INTERCEPTOR (Error Handling)
====================== */
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Handle specific error cases
        if (error.response?.status === 401) {
            // Unauthorized - redirect to login
            localStorage.removeItem('token');
            window.location.href = 'index.html';
        }
        // Return the error so individual handlers can show appropriate messages
        return Promise.reject(error);
    }
);

/* ======================
METHODS
====================== */
async function apiGet(url, params = {}) {
    const res = await api.get(url, { params });
    const responseData = res.data;

    // If response has nested pagination (data.pagination), extract it
    if (responseData.data?.pagination) {
        const dataObj = responseData.data;
        return {
            ...responseData,
            ...dataObj,
            enquiries: dataObj.enquiries || [],
            admissions: dataObj.admissions || [],
            payments: dataObj.payments || []
        };
    }

    // If response has pagination at top level and data is an array
    if (responseData.pagination && Array.isArray(responseData.data)) {
        return {
            ...responseData,
            enquiries: responseData.data || [],
            admissions: responseData.data || [],
            payments: responseData.data || []
        };
    }

    // If response has data as object with named arrays (no pagination)
    if (responseData.data && typeof responseData.data === 'object' && !Array.isArray(responseData.data)) {
        const dataObj = responseData.data;
        return {
            ...responseData,
            ...dataObj,
            enquiries: dataObj.enquiries || [],
            admissions: dataObj.admissions || [],
            payments: dataObj.payments || []
        };
    }

    // If response has pagination at top level with named arrays
    if (responseData.pagination) {
        return responseData;
    }

    // Return full response to preserve success/message/data structure
    return responseData;
}

async function apiPost(url, data) {
    const isFormData = data instanceof FormData;
    const config = isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
    const res = await api.post(url, data, config);
    return res.data;
}

async function apiPut(url, data) {
    const res = await api.put(url, data);
    return res.data;
}

async function apiDelete(url) {
    const res = await api.delete(url);
    return res.data;
}

/* ======================
ROLE-BASED UTILITIES
====================== */

// Safe localStorage parsing utility
function safeParseLocalStorage(key, defaultValue = {}) {
    try {
        const value = localStorage.getItem(key);
        if (!value || value === 'undefined' || value === 'null') {
            return defaultValue;
        }
        return JSON.parse(value);
    } catch (error) {
        console.warn(`Failed to parse localStorage key "${key}":`, error);
        return defaultValue;
    }
}

// Safe localStorage set utility
function safeSetLocalStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error(`Failed to set localStorage key "${key}":`, error);
    }
}

function getCurrentUser() {
    return safeParseLocalStorage('user', {});
}

function getUserRole() {
    return getCurrentUser().role || 'counselor';
}

function isAdmin() {
    return getUserRole() === 'admin';
}

function isCounselor() {
    return getUserRole() === 'counselor';
}

// Get dashboard endpoint based on user role
function getDashboardEndpoint() {
    return isCounselor()
        ? API_ENDPOINTS.DASHBOARD.COUNSELOR
        : API_ENDPOINTS.DASHBOARD.GET;
}

// Check if user has access to a feature
function hasAccess(feature) {
    const role = getUserRole();
    const permissions = {
        'dashboard': ['admin', 'counselor'],
        'counselor_dashboard': ['counselor'],
        'reports': ['admin'],
        'revenue_stats': ['admin'],
        'enquiry_stats': ['admin'],
        'admissions_report': ['admin'],
        'fees_report': ['admin'],
        'counselor_performance': ['admin'],
        'course_performance': ['admin'],
        'today_calls': ['admin', 'counselor'],
        'followups': ['admin', 'counselor'],
        'installment_alerts': ['admin', 'counselor'],
        'all_enquiries': ['admin'],
        'assign_enquiry': ['admin'],
        'delete_enquiry': ['admin'],
        'lock_admission': ['admin'],
        'payment_update': ['admin']
    };
    return permissions[feature]?.includes(role) || false;
}

// Handle 403 errors for role-restricted APIs
function handleRoleError(error, feature) {
    if (error.response?.status === 403) {
        console.warn(`Access denied: ${feature} requires elevated permissions`);
        return { accessDenied: true, message: error.response.data?.message || 'Access denied' };
    }
    throw error;
}
