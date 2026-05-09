// Import axios
const axios = window.axios;

const BASE_URL = 'https://sssam-r3pz.onrender.com/api';
// const BASE_URL = 'http://localhost:5000/api'

/* ======================
API ENDPOINTS (Updated to match new documentation)
====================== */
const API_ENDPOINTS = {
    DASHBOARD: {
        COUNSELOR: '/dashboard/counselor',
        ADMIN: '/dashboard/admin'
    },
    ENQUIRIES: {
        CREATE: '/enquiries',
        LIST: '/enquiries',
        GET_ALL: '/enquiries',
        GET: (id) => `/enquiries/${id}`,
        UPDATE: (id) => `/enquiries/${id}`,
        DELETE: (id) => `/enquiries/${id}`,
        ASSIGN: (id) => `/enquiries/${id}/assign`,
        // Filter endpoints
        PENDING_FOLLOWUPS: '/enquiries?filterType=pending_followups',
        ALL: '/enquiries?filterType=all',
        TODAY_FOLLOWUPS: '/enquiries?filterType=today_followups',
        UPCOMING_FOLLOWUPS: '/enquiries?filterType=upcoming_followups',
        NEW: '/enquiries?filterType=new'
    },
    ADMISSIONS: {
        LIST: '/admissions',
        CREATE: '/admissions',
        GET: (id) => `/admissions/${id}`,
        UPDATE: (id) => `/admissions/${id}`,
        DELETE: (id) => `/admissions/${id}`,
        RECORD_PAYMENT: (id) => `/admissions/${id}/payments`,
        LIST_PAYMENTS: (id) => `/admissions/${id}/payments`,
        INSTALLMENTS: (id) => `/admissions/${id}/installments`,
        INSTALLMENT_ALERTS: '/admissions/installment-alerts',
        DROP: (id) => `/admissions/${id}/drop`
    },
    PAYMENTS: {
        LIST: '/payments',
        GET_ALL: '/payments',
        CREATE: '/payments',
        CHECK_OVERDUE: '/payments/check-overdue',
        REFUND: (paymentId) => `/payments/${paymentId}/refund`
    },
    AUTH: {
        LOGIN: '/auth/login'
    },
    USERS: {
        GET_COUNSELORS: '/users/counselors',
        GET: (id) => `/users/${id}`
    },
    REPORTS: {
        ADMISSIONS: '/reports/admissions',
        FEES: '/reports/fees',
        COURSE_PERFORMANCE: '/reports/course-performance',
        COUNSELOR_PERFORMANCE: '/reports/counselor-performance',
        SUMMARY: '/reports/summary'
    },
    ENQUIRIES_REPORTS: {
        WALKIN_BROUGHT_BY: '/enquiries/walkin-brought-by'
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
    try {
        const res = await api.get(url, { params });
        return res.data;
    } catch (error) {
        return handleApiError(error);
    }
}

async function apiPost(url, data) {
    try {
        const isFormData = data instanceof FormData;
        const config = isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
        const res = await api.post(url, data, config);
        return res.data;
    } catch (error) {
        return handleApiError(error);
    }
}

async function apiPut(url, data) {
    try {
        const res = await api.put(url, data);
        return res.data;
    } catch (error) {
        return handleApiError(error);
    }
}

async function apiDelete(url) {
    try {
        const res = await api.delete(url);
        return res.data;
    } catch (error) {
        return handleApiError(error);
    }
}

/* ======================
ENQUIRY API FUNCTIONS
====================== */
async function createEnquiry(enquiryData) {
    const data = {
        ...enquiryData,
        followUpDate: enquiryData.followUpDate ? formatDateForAPI(enquiryData.followUpDate) : null
    };
    return await apiPost(API_ENDPOINTS.ENQUIRIES.CREATE, data);
}

async function listEnquiries(filters = {}) {
    return await apiGet(API_ENDPOINTS.ENQUIRIES.LIST, filters);
}

async function getEnquiry(id) {
    return await apiGet(API_ENDPOINTS.ENQUIRIES.GET(id));
}

async function updateEnquiry(id, updateData) {
    const data = {
        ...updateData,
        followUpDate: updateData.followUpDate ? formatDateForAPI(updateData.followUpDate) : undefined
    };
    return await apiPut(API_ENDPOINTS.ENQUIRIES.UPDATE(id), data);
}

async function assignEnquiry(id, counselorId) {
    return await apiPut(API_ENDPOINTS.ENQUIRIES.ASSIGN(id), { counselorId });
}

/* ======================
USER API FUNCTIONS
====================== */
async function getUserById(id) {
    return await apiGet(API_ENDPOINTS.USERS.GET(id));
}


/* ======================
ADMISSION API FUNCTIONS
====================== */
async function createAdmission(admissionData) {
    const data = {
        ...admissionData,
        admissionDate: formatDateForAPI(admissionData.admissionDate),
        installments: admissionData.installments?.map(installment => ({
            ...installment,
            dueDate: formatDateForAPI(installment.dueDate)
        }))
    };
    return await apiPost(API_ENDPOINTS.ADMISSIONS.CREATE, data);
}

async function listAdmissions(filters = {}) {
    return await apiGet(API_ENDPOINTS.ADMISSIONS.LIST, filters);
}

async function getAdmission(id) {
    return await apiGet(API_ENDPOINTS.ADMISSIONS.GET(id));
}

async function updateAdmission(id, updateData) {
    const data = {
        ...updateData,
        admissionDate: updateData.admissionDate ? formatDateForAPI(updateData.admissionDate) : undefined
    };
    
    // Handle installments if provided
    if (updateData.installments) {
        data.installments = updateData.installments.map(installment => ({
            ...installment,
            dueDate: formatDateForAPI(installment.dueDate)
        }));
    }
    
    return await apiPut(API_ENDPOINTS.ADMISSIONS.UPDATE(id), data);
}

async function recordPayment(admissionId, paymentData) {
    const data = {
        ...paymentData,
        paymentDate: formatDateForAPI(paymentData.paymentDate)
    };
    return await apiPost(API_ENDPOINTS.ADMISSIONS.RECORD_PAYMENT(admissionId), data);
}

async function listAdmissionPayments(admissionId) {
    return await apiGet(API_ENDPOINTS.ADMISSIONS.LIST_PAYMENTS(admissionId));
}

/* ======================
PAYMENT API FUNCTIONS
====================== */
async function listPayments(filters = {}) {
    return await apiGet(API_ENDPOINTS.PAYMENTS.LIST, filters);
}

async function checkOverdueInstallments() {
    return await apiPost(API_ENDPOINTS.PAYMENTS.CHECK_OVERDUE, {});
}

async function processRefund(paymentId, refundData) {
    return await apiPost(API_ENDPOINTS.PAYMENTS.REFUND(paymentId), refundData);
}

async function dropStudent(admissionId, dropData) {
    return await apiPost(API_ENDPOINTS.ADMISSIONS.DROP(admissionId), dropData);
}

/* ======================
DATE FORMATTING UTILITIES
====================== */
function formatDateForAPI(date) {
    return new Date(date).toISOString();
}

function formatDateForDisplay(dateString) {
    return new Date(dateString).toLocaleDateString('en-IN');
}

function formatDateTimeForDisplay(dateString) {
    return new Date(dateString).toLocaleString('en-IN');
}

/* ======================
ERROR HANDLING
====================== */
function handleApiError(error) {
    console.error('=== API ERROR DETAILS ===');
    console.error('Error:', error);
    console.error('Error config:', error.config);
    console.error('Error message:', error.message);
    
    if (error.response) {
        const { status, data } = error.response;
        console.error(`API Error ${status}:`, data);
        console.error('Response headers:', error.response.headers);

        if (status === 401) {
            console.log('Unauthorized - redirecting to login');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'index.html';
        }

        // For 409 duplicate errors, preserve the original response structure
        if (status === 409 && data.errors) {
            return {
                success: false,
                message: data.message,
                errors: data.errors,
                statusCode: status
            };
        }

        return {
            success: false,
            error: data.error || { message: 'Something went wrong' },
            statusCode: status
        };
    } else if (error.request) {
        console.error('No response received:', error.request);
        console.error('Request was made but no response received');
        return {
            success: false,
            error: { message: 'Server not responding' },
            statusCode: 0
        };
    } else {
        console.error('Network Error:', error);
        console.error('Request setup error');
        return {
            success: false,
            error: { message: 'Network connection failed' },
            statusCode: 0
        };
    }
}
