const BASE_URL = 'http://localhost:5000/api';

/* ======================
ENDPOINTS
====================== */
const API_ENDPOINTS = {
    ENQUIRIES: {
        GET_ALL: '/enquiries',
        GET_BY_ID: (id) => `/enquiries/${id}`,
        CREATE: '/enquiries',
        UPDATE_STATUS: (id) => `/enquiries/${id}/update`,
        BULK_UPLOAD: '/upload/enquiries'
    },
    ADMISSIONS: {
        GET_ALL: '/admissions',
        GET_BY_ID: (id) => `/admissions/${id}`,
        GET_BY_ENQUIRY: (enquiryId) => `/admissions/by-enquiry/${enquiryId}`,
        CREATE: '/admissions',
        UPDATE_FEES: (id) => `/admissions/${id}/fees`,
        LOCK: (id) => `/admissions/${id}/lock`,
        PAYMENT_PLAN: (id) => `/admissions/${id}/payment-plan`
    },
    PAYMENTS: {
        CREATE: '/payments',
        GET_ALL: '/payments',
        GET_BY_ADMISSION: (admissionId) => `/payments/admission/${admissionId}`,
        GET_BY_ID: (id) => `/payments/${id}`,
        UPDATE: (id) => `/payments/${id}`,
        CHECK_OVERDUE: '/payments/check-overdue'
    },
    REPORTS: {
        ADMISSIONS: '/reports/admissions',
        FEES: '/reports/fees',
        INSTALLMENT_ALERTS: '/reports/installments/alerts',
        COUNSELOR_PERFORMANCE: '/reports/counselor-performance',
        COURSE_PERFORMANCE: '/reports/course-performance'
    },
    DASHBOARD: {
        GET: '/dashboard',
        REVENUE: '/dashboard/revenue',
        ENQUIRIES: '/dashboard/enquiries',
        FOLLOWUPS: '/dashboard/followups',
        COUNSELOR: '/dashboard/counselor'
    },
    AUTH: {
        LOGIN: '/auth/login',
        REGISTER: '/auth/register'
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
METHODS
====================== */
async function apiGet(url, params = {}) {
    const res = await api.get(url, { params });
    const responseData = res.data;

    // If response has pagination, return full data object with mapped array
    if (responseData.pagination) {
        const dataArray = responseData.data || [];
        return {
            ...responseData,
            enquiries: dataArray,
            admissions: dataArray,
            payments: dataArray
        };
    }

    // For non-paginated responses, return data directly
    return responseData.data || responseData;
}

async function apiPost(url, data) {
    const isFormData = data instanceof FormData;
    const config = isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
    const res = await api.post(url, data, config);
    return res.data.data || res.data;
}

async function apiPut(url, data) {
    const res = await api.put(url, data);
    return res.data.data || res.data;
}
