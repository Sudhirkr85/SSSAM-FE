/**
 * API Configuration and Base Setup
 * Institute Enquiry Management System
 */

// API Base URL
const API_BASE_URL = 'http://localhost:5000/api';

// Create axios instance with default config
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 30000, // 30 second timeout
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor to handle common errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Handle 401 Unauthorized
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'index.html';
        }
        
        // Handle 403 Forbidden
        if (error.response && error.response.status === 403) {
            showToast('error', 'Access Denied', 'You do not have permission to perform this action.');
        }
        
        // Handle 500 Server Error
        if (error.response && error.response.status >= 500) {
            showToast('error', 'Server Error', 'Something went wrong on the server. Please try again later.');
        }
        
        // Handle network errors
        if (error.code === 'ECONNABORTED' || !error.response) {
            showToast('error', 'Connection Error', 'Unable to connect to the server. Please check your internet connection.');
        }
        
        return Promise.reject(error);
    }
);

/**
 * API Endpoints
 */
const API_ENDPOINTS = {
    // Auth
    AUTH: {
        LOGIN: '/auth/login',
        LOGOUT: '/auth/logout',
        ME: '/auth/me',
        REFRESH: '/auth/refresh',
    },
    
    // Enquiries
    ENQUIRIES: {
        LIST: '/enquiries',
        DETAIL: (id) => `/enquiries/${id}`,
        CREATE: '/enquiries',
        UPDATE: (id) => `/enquiries/${id}`,
        DELETE: (id) => `/enquiries/${id}`,
        UPDATE_STATUS: (id) => `/enquiries/${id}/status`,
        UPDATE_FOLLOWUP: (id) => `/enquiries/${id}/followup`,
        ADD_NOTE: (id) => `/enquiries/${id}/notes`,
        TIMELINE: (id) => `/enquiries/${id}/timeline`,
        ASSIGN: (id) => `/enquiries/${id}/assign`,
    },
    
    // Admissions
    ADMISSIONS: {
        LIST: '/admissions',
        DETAIL: (id) => `/admissions/${id}`,
        CREATE: '/admissions',
        UPDATE: (id) => `/admissions/${id}`,
        DELETE: (id) => `/admissions/${id}`,
        LOCK: (id) => `/admissions/${id}/lock`,
        UNLOCK: (id) => `/admissions/${id}/unlock`,
    },
    
    // Payments
    PAYMENTS: {
        LIST: '/payments',
        DETAIL: (id) => `/payments/${id}`,
        CREATE: '/payments',
        UPDATE: (id) => `/payments/${id}`,
        DELETE: (id) => `/payments/${id}`,
        RECEIPT: (id) => `/payments/${id}/receipt`,
    },
    
    // Reports
    REPORTS: {
        DASHBOARD: '/reports/dashboard',
        ENQUIRIES: '/reports/enquiries',
        ADMISSIONS: '/reports/admissions',
        REVENUE: '/reports/revenue',
        COUNSELOR: '/reports/counselor',
        COURSE: '/reports/course',
    },
    
    // Bulk Upload
    BULK: {
        UPLOAD: '/bulk-upload/enquiries',
    },
    
    // Courses (for dropdowns)
    COURSES: {
        LIST: '/courses',
    },
    
    // Counselors
    COUNSELORS: {
        LIST: '/counselors',
    },
};

/**
 * Helper functions for API calls
 */

// Generic GET request
async function get(url, params = {}) {
    try {
        const response = await api.get(url, { params });
        return response.data;
    } catch (error) {
        throw error;
    }
}

// Generic POST request
async function post(url, data = {}) {
    try {
        const response = await api.post(url, data);
        return response.data;
    } catch (error) {
        throw error;
    }
}

// Generic PUT request
async function put(url, data = {}) {
    try {
        const response = await api.put(url, data);
        return response.data;
    } catch (error) {
        throw error;
    }
}

// Generic PATCH request
async function patch(url, data = {}) {
    try {
        const response = await api.patch(url, data);
        return response.data;
    } catch (error) {
        throw error;
    }
}

// Generic DELETE request
async function del(url) {
    try {
        const response = await api.delete(url);
        return response.data;
    } catch (error) {
        throw error;
    }
}

// File upload (multipart/form-data)
async function uploadFile(url, file, fieldName = 'file') {
    try {
        const formData = new FormData();
        formData.append(fieldName, file);
        
        const response = await api.post(url, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    } catch (error) {
        throw error;
    }
}

/**
 * Export API utilities
 */
window.api = api;
window.API_ENDPOINTS = API_ENDPOINTS;
window.apiGet = get;
window.apiPost = post;
window.apiPut = put;
window.apiPatch = patch;
window.apiDelete = del;
window.apiUploadFile = uploadFile;
