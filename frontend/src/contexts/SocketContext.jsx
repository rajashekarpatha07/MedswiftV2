import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocket must be used within SocketProvider');
    }
    return context;
};

/**
 * Sync ambulance location to server
 * Extracted to reuse on initial connect and reconnect
 */
const syncAmbulanceLocation = (socket, onSuccess, onError) => {
    if (!navigator.geolocation) {
        console.warn('⚠️ Geolocation not supported');
        onError?.('Geolocation not supported');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            console.log(`📍 Syncing ambulance location: (${longitude}, ${latitude})`);

            socket.emit('sync_initial_location', {
                location: { latitude, longitude }
            }, (response) => {
                if (response?.success) {
                    console.log('✅ Location synced to server');
                    onSuccess?.();
                } else {
                    console.error('❌ Location sync failed:', response?.message);
                    onError?.(response?.message);
                }
            });
        },
        (error) => {
            console.error('❌ Geolocation error:', error.message);
            onError?.(error.message);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
};

export const SocketProvider = ({ children }) => {
    const { isAuthenticated, role } = useAuth();
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState(null);
    const reconnectAttempts = useRef(0);

    useEffect(() => {
        if (!isAuthenticated) {
            if (socket) {
                socket.disconnect();
                setSocket(null);
                setIsConnected(false);
            }
            return;
        }

        const token = localStorage.getItem('accessToken');
        if (!token) return;

        const BACKEND_URL = "/";
        
        // Connect to Socket.IO with reconnection options
        const newSocket = io(BACKEND_URL, {
            auth: { token },
            withCredentials: true,
            transports: ['websocket', 'polling'],
            extraHeaders: {
                "ngrok-skip-browser-warning": "true"
            },
            // Reconnection settings
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
        });

        newSocket.on('connect', () => {
            console.log('🔌 Socket connected');
            setIsConnected(true);
            setConnectionError(null);
            reconnectAttempts.current = 0;

            // CRITICAL: If ambulance, immediately sync current GPS location
            // This ensures the ambulance is findable in geo searches
            if (role === 'ambulance') {
                syncAmbulanceLocation(newSocket);
            }
        });

        newSocket.on('disconnect', (reason) => {
            console.log(`🔌 Socket disconnected (reason: ${reason})`);
            setIsConnected(false);

            // If disconnected due to server-side, the socket will auto-reconnect
            if (reason === 'io server disconnect') {
                // Server disconnected us, try to reconnect
                newSocket.connect();
            }
        });

        newSocket.on('connect_error', (error) => {
            console.error('Socket connection error:', error.message);
            setConnectionError(error.message);
            reconnectAttempts.current += 1;
        });

        // Handle reconnection - re-sync location for ambulances
        newSocket.io.on('reconnect', (attemptNumber) => {
            console.log(`🔄 Socket reconnected after ${attemptNumber} attempts`);
            setConnectionError(null);

            // Re-sync ambulance location after reconnecting
            if (role === 'ambulance') {
                console.log('📍 Re-syncing ambulance location after reconnect...');
                syncAmbulanceLocation(newSocket);
            }
        });

        newSocket.io.on('reconnect_attempt', (attemptNumber) => {
            console.log(`🔄 Reconnection attempt ${attemptNumber}...`);
        });

        newSocket.io.on('reconnect_failed', () => {
            console.error('❌ Failed to reconnect after all attempts');
            setConnectionError('Failed to reconnect to server');
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [isAuthenticated, role]);

    // Join a trip room
    const joinTrip = useCallback((tripId) => {
        return new Promise((resolve, reject) => {
            if (!socket) {
                reject(new Error('Socket not connected'));
                return;
            }
            socket.emit('join_trip', { tripId }, (response) => {
                if (response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response.message));
                }
            });
        });
    }, [socket]);

    // Leave a trip room
    const leaveTrip = useCallback((tripId) => {
        return new Promise((resolve, reject) => {
            if (!socket) {
                reject(new Error('Socket not connected'));
                return;
            }
            socket.emit('leave_trip', { tripId }, (response) => {
                if (response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response.message));
                }
            });
        });
    }, [socket]);

    // Update location (for ambulance)
    const updateLocation = useCallback((coordinates) => {
        if (!socket) return;
        socket.emit('update_location', { coordinates });
    }, [socket]);

    // Generic emit function
    const emit = useCallback((event, data, callback) => {
        if (!socket) {
            console.warn('⚠️ Socket not connected, cannot emit:', event);
            return;
        }
        console.log('📤 Emitting socket event:', event, data);
        socket.emit(event, data, callback);
    }, [socket]);

    // Subscribe to an event
    const on = useCallback((event, callback) => {
        if (!socket) return () => { };
        socket.on(event, callback);
        return () => socket.off(event, callback);
    }, [socket]);

    const value = {
        socket,
        isConnected,
        connectionError,
        joinTrip,
        leaveTrip,
        updateLocation,
        emit,
        on
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
};
