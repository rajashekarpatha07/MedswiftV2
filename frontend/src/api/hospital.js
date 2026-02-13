import api from './api';

// Update hospital inventory
export const updateHospitalInventory = async (inventoryData) => {
    const response = await api.patch('/hospital/inventory', inventoryData);
    return response.data;
};

// Get nearby hospitals with optional filters
export const getNearbyHospitals = async (longitude, latitude, options = {}) => {
    const params = { longitude, latitude };

    if (options.bloodType) {
        params.bloodType = options.bloodType;
    }
    if (options.requireBeds !== undefined) {
        params.requireBeds = options.requireBeds;
    }

    const response = await api.get('/hospital/nearby', { params });
    return response.data;
};
