import api from './api';

// Update ambulance status (ready/offline/on-trip)
export const updateAmbulanceStatus = async (status) => {
    const response = await api.patch('/ambulance/status', { status });
    return response.data;
};

// Update ambulance location
export const updateAmbulanceLocation = async (coordinates) => {
    const response = await api.patch('/ambulance/location', {
        location: {
            type: 'Point',
            coordinates: coordinates // [longitude, latitude]
        }
    });
    return response.data;
};

// Get nearby ambulances
export const getNearbyAmbulances = async (longitude, latitude, limit = 5) => {
    const response = await api.get('/ambulance/nearby', {
        params: { longitude, latitude, limit }
    });
    return response.data;
};

// Get ambulance statistics
export const getAmbulanceStats = async () => {
    const response = await api.get('/ambulance/stats');
    return response.data;
};
