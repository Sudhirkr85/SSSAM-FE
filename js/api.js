const API_BASE_URL = 'http://localhost:5000/api';

/* ======================
AXIOS INSTANCE
====================== */

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000
});

/* ======================
INTERCEPTORS
====================== */

api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

api.interceptors.response.use(
    res => res,
    err => {
        const status = err.response?.status;

        ```
if (status === 401) {
  localStorage.clear();
  window.location.href = 'index.html';
}

return Promise.reject(err);
```

    }
);

/* ======================
ENDPOINTS (CLEAN)
====================== */

const API_ENDPOINTS = {

    AUTH: {
        LOGIN: '/auth/login',
        LOGOUT: '/auth/logout'
    },

    ENQUIRIES: {
        GET_ALL: '/enquiries',
        GET_ONE: id => `/enquiries/${id}`,
        CREATE: '/enquiries',
        UPDATE_STATUS: id => `/enquiries/${id}/update`,
        DELETE: id => `/enquiries/${id}`
    },

    ADMISSIONS: {
        GET_ALL: '/admissions',
        CREATE_FROM_ENQUIRY: id => `/admissions/from-enquiry/${id}`,
        UPDATE: id => `/admissions/${id}`
    },

    PAYMENTS: {
        GET_ALL: '/payments',
        CREATE: '/payments'
    },

    DASHBOARD: '/dashboard'
};

/* ======================
HELPERS
====================== */

async function apiGet(url, params = {}) {
    const res = await api.get(url, { params });
    return res.data;
}

async function apiPost(url, data = {}) {
    const res = await api.post(url, data);
    return res.data;
}

async function apiPut(url, data = {}) {
    const res = await api.put(url, data);
    return res.data;
}

async function apiDelete(url) {
    const res = await api.delete(url);
    return res.data;
}

/* ======================
STATIC COURSES
====================== */

const STATIC_COURSES = [
    'BCC',
    'DIT',
    'ADCA',
    'MS Office',
    'Tally GST',
    'Web Designing',
    'Full Stack',
    'Python',
    'Java',
    'C/C++',
    'Data Science',
    'AI/ML',
    'Cyber Security',
    'Cloud',
    'Networking',
    'SQL',
    'Mobile Dev',
    'Graphic Design',
    'UI/UX',
    'Digital Marketing',
    'Video Editing',
    'DevOps'
];

/* ======================
EXPORT
====================== */

window.api = api;
window.API_ENDPOINTS = API_ENDPOINTS;
window.apiGet = apiGet;
window.apiPost = apiPost;
window.apiPut = apiPut;
window.apiDelete = apiDelete;
window.STATIC_COURSES = STATIC_COURSES;
