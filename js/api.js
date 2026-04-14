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
        BULK_UPLOAD: '/enquiries/bulk-upload'
    },
    ADMISSIONS: {
        GET_ALL: '/admissions',
        CREATE: '/admissions'
    },
    PAYMENTS: {
        CREATE: '/payments',
        GET_ALL: '/payments'
    },
    REPORTS: {
        GET: '/reports'
    },
    AUTH: {
        LOGIN: '/auth/login'
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
    return res.data.data || res.data;
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
