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
        ADMISSIONS: '/reports/admissions',
        FEES: '/reports/fees',
        INSTALLMENTS: '/reports/installments/alerts',
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
        // Filter out empty/null/undefined values to prevent validation errors
        const filteredParams = Object.fromEntries(
            Object.entries(params).filter(([_, value]) => value !== '' && value !== null && value !== undefined)
        );
        const response = await api.get(url, { params: filteredParams });
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

// Static courses list (used when API is unavailable)
const STATIC_COURSES = [
    { _id: 'bcc', name: 'Basic Computer Course (BCC)' },
    { _id: 'dit', name: 'Diploma in Information Technology (DIT)' },
    { _id: 'adca', name: 'Advanced Diploma in Computer Applications (ADCA)' },
    { _id: 'ms-office', name: 'Computer Fundamentals & MS Office' },
    { _id: 'tally-gst', name: 'Tally with GST' },
    { _id: 'web-design', name: 'Web Designing (HTML, CSS, JavaScript)' },
    { _id: 'fullstack', name: 'Full Stack Web Development' },
    { _id: 'python', name: 'Python Programming' },
    { _id: 'java', name: 'Java Programming' },
    { _id: 'c-cpp', name: 'C & C++ Programming' },
    { _id: 'data-science', name: 'Data Science & Analytics' },
    { _id: 'ai-ml', name: 'Artificial Intelligence & Machine Learning' },
    { _id: 'cyber-security', name: 'Cyber Security & Ethical Hacking' },
    { _id: 'cloud', name: 'Cloud Computing (AWS/Azure)' },
    { _id: 'networking', name: 'Networking & Hardware (CCNA)' },
    { _id: 'database', name: 'Database Management (SQL)' },
    { _id: 'mobile-dev', name: 'Mobile App Development (Android/iOS)' },
    { _id: 'graphic-design', name: 'Graphic Designing (Photoshop, CorelDRAW)' },
    { _id: 'ui-ux', name: 'UI/UX Design' },
    { _id: 'digital-marketing', name: 'Digital Marketing' },
    { _id: 'video-editing', name: 'Video Editing & Animation' },
    { _id: 'devops', name: 'DevOps Engineering' }
];

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
window.STATIC_COURSES = STATIC_COURSES;
