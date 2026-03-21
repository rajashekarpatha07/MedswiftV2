import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { adminLogin } from '../../api/auth';
import { useAuth } from '../../contexts/AuthContext';
import AuthLayout from '../../components/AuthLayout';
import { DarkInput, DarkPasswordInput, DarkButton } from '../../components/DarkFormControls';

export default function AdminLogin() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await adminLogin(formData.email, formData.password);
            if (response.status) {
                notifications.show({ title: 'Welcome Admin!', message: 'System access granted ⚙️', color: 'orange' });
                login(response.data.admin, response.data.accessToken, 'admin');
                navigate('/admin/dashboard');
            }
        } catch (err) {
            notifications.show({ title: 'Login Failed', message: err.response?.data?.message || 'Please check credentials', color: 'red' });
        } finally { setLoading(false); }
    };

    return (
        <AuthLayout
            icon="⚙️"
            title="Admin Login"
            subtitle="System administration & monitoring"
            gradient="linear-gradient(135deg, #f43f5e, #ef4444)"
            accentGlow="rgba(244,63,94,0.3)"
        >
            <form onSubmit={handleSubmit}>
                <DarkInput
                    label="Email" placeholder="Enter admin email"
                    name="email" type="email" value={formData.email} onChange={handleChange}
                    required accent="rgba(244,63,94,0.5)"
                />
                <DarkPasswordInput
                    label="Password" placeholder="Enter password"
                    name="password" value={formData.password} onChange={handleChange}
                    required accent="rgba(244,63,94,0.5)"
                />
                <DarkButton gradient="linear-gradient(135deg, #f43f5e, #ef4444)" loading={loading}>
                    Sign In
                </DarkButton>
            </form>
        </AuthLayout>
    );
}
