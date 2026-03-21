import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { ambulanceLogin } from '../../api/auth';
import { useAuth } from '../../contexts/AuthContext';
import AuthLayout from '../../components/AuthLayout';
import { DarkInput, DarkPasswordInput, DarkButton } from '../../components/DarkFormControls';

export default function AmbulanceLogin() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [formData, setFormData] = useState({ driverPhone: '', password: '' });
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await ambulanceLogin(formData.driverPhone, formData.password);
            if (response.status) {
                notifications.show({ title: 'Welcome!', message: 'Ready to save lives 🚑', color: 'teal' });
                login(response.data.ambulance, response.data.accessToken, 'ambulance');
                navigate('/ambulance/dashboard');
            }
        } catch (err) {
            notifications.show({ title: 'Login Failed', message: err.response?.data?.message || 'Please check credentials', color: 'red' });
        } finally { setLoading(false); }
    };

    return (
        <AuthLayout
            icon="🚑"
            title="Ambulance Driver Login"
            subtitle="Sign in to manage trips and save lives"
            gradient="linear-gradient(135deg, #10b981, #14b8a6)"
            accentGlow="rgba(16,185,129,0.3)"
        >
            <form onSubmit={handleSubmit}>
                <DarkInput
                    label="Phone Number" placeholder="Enter your phone number"
                    name="driverPhone" value={formData.driverPhone} onChange={handleChange}
                    required accent="rgba(16,185,129,0.5)"
                />
                <DarkPasswordInput
                    label="Password" placeholder="Enter your password"
                    name="password" value={formData.password} onChange={handleChange}
                    required accent="rgba(16,185,129,0.5)"
                />
                <DarkButton gradient="linear-gradient(135deg, #10b981, #14b8a6)" loading={loading}>
                    Sign In
                </DarkButton>
            </form>
        </AuthLayout>
    );
}
