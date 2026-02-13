import api from './api';

// Create a new trip request
export const createTrip = async (data) => {
    const response = await api.post('/trip/request', data);
    return response.data;
};

// Get active trip for current user
export const getActiveTrip = async () => {
    const response = await api.get('/trip/active');
    return response.data;
};

// Get active trip for ambulance
export const getAmbulanceActiveTrip = async () => {
    const response = await api.get('/trip/ambulance/active');
    return response.data;
};

// Get trip history
export const getTripHistory = async (limit = 10) => {
    const response = await api.get(`/trip/history?limit=${limit}`);
    return response.data;
};

// Accept a trip (ambulance only)
export const acceptTrip = async (tripId) => {
    const response = await api.post(`/trip/${tripId}/accept`);
    return response.data;
};

// Update trip status (ambulance only)
export const updateTripStatus = async (tripId, status, location) => {
    const response = await api.patch(`/trip/${tripId}/status`, { status, location });
    return response.data;
};

// Get trip details by ID
export const getTripDetails = async (tripId) => {
    const response = await api.patch(`/trip/${tripId}`);
    return response.data;
};

// Cancel trip (user)
export const cancelTrip = async (tripId) => {
    const response = await api.patch(`/trip/${tripId}/status`, {
        status: 'CANCELLED'
    });
    return response.data;
};
