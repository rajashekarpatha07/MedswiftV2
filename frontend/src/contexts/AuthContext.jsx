import { createContext, useContext, useState, useEffect } from 'react';
import {
    getUserProfile, getAmbulanceProfile, getHospitalProfile, getAdminProfile,
    userLogout, ambulanceLogout, hospitalLogout, adminLogout
} from '../api/auth';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [role, setRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Check for existing session on mount
    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('accessToken');
            const savedRole = localStorage.getItem('userRole');

            if (token && savedRole) {
                try {
                    let profile;
                    switch (savedRole) {
                        case 'user':
                            profile = await getUserProfile();
                            break;
                        case 'ambulance':
                            profile = await getAmbulanceProfile();
                            break;
                        case 'hospital':
                            profile = await getHospitalProfile();
                            break;
                        case 'admin':
                            profile = await getAdminProfile();
                            break;
                        default:
                            throw new Error('Invalid role');
                    }
                    setUser(profile.data);
                    setRole(savedRole);
                    setIsAuthenticated(true);
                } catch (error) {
                    // Token invalid, clear storage
                    localStorage.removeItem('accessToken');
                    localStorage.removeItem('userRole');
                }
            }
            setLoading(false);
        };

        checkAuth();
    }, []);

    // Login handler - called after successful API login
    const login = (userData, accessToken, userRole) => {
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('userRole', userRole);
        setUser(userData);
        setRole(userRole);
        setIsAuthenticated(true);
    };

    // Logout handler
    const logout = async () => {
        try {
            switch (role) {
                case 'user':
                    await userLogout();
                    break;
                case 'ambulance':
                    await ambulanceLogout();
                    break;
                case 'hospital':
                    await hospitalLogout();
                    break;
                case 'admin':
                    await adminLogout();
                    break;
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('userRole');
            setUser(null);
            setRole(null);
            setIsAuthenticated(false);
        }
    };

    // Update user data
    const updateUser = (newData) => {
        setUser(prev => ({ ...prev, ...newData }));
    };

    const value = {
        user,
        role,
        loading,
        isAuthenticated,
        login,
        logout,
        updateUser
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
