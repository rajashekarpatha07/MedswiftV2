import api from './api';

// ============== USER AUTH ==============
export const userRegister = async (data) => {
    const response = await api.post('/user/register', data);
    return response.data;
};

export const userLogin = async (phone, password) => {
    const response = await api.post('/user/login', { phone, password });
    return response.data;
};

export const userLogout = async () => {
    const response = await api.post('/user/logout');
    return response.data;
};

export const getUserProfile = async () => {
    const response = await api.get('/user/me');
    return response.data;
};

// ============== AMBULANCE AUTH ==============
export const ambulanceRegister = async (data) => {
    const response = await api.post('/ambulance/register', data);
    return response.data;
};

export const ambulanceLogin = async (driverPhone, password) => {
    const response = await api.post('/ambulance/login', { driverPhone, password });
    return response.data;
};

export const ambulanceLogout = async () => {
    const response = await api.post('/ambulance/logout');
    return response.data;
};

export const getAmbulanceProfile = async () => {
    const response = await api.get('/ambulance/me');
    return response.data;
};

// ============== HOSPITAL AUTH ==============
export const hospitalRegister = async (data) => {
    const response = await api.post('/hospital/register', data);
    return response.data;
};

export const hospitalLogin = async (email, password) => {
    const response = await api.post('/hospital/login', { email, password });
    return response.data;
};

export const hospitalLogout = async () => {
    const response = await api.post('/hospital/logout');
    return response.data;
};

export const getHospitalProfile = async () => {
    const response = await api.get('/hospital/me');
    return response.data;
};

// ============== ADMIN AUTH ==============
export const adminRegister = async (data) => {
    const response = await api.post('/admin/register', data);
    return response.data;
};

export const adminLogin = async (email, password) => {
    const response = await api.post('/admin/login', { email, password });
    return response.data;
};

export const adminLogout = async () => {
    const response = await api.post('/admin/logout');
    return response.data;
};

export const getAdminProfile = async () => {
    const response = await api.get('/admin/me');
    return response.data;
};
