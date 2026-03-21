import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { hospitalLogin } from '../../api/auth';
import { useAuth } from '../../contexts/AuthContext';
import AuthLayout from '../../components/AuthLayout';
import { DarkInput, DarkPasswordInput, DarkButton } from '../../components/DarkFormControls';

export default function HospitalLogin() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await hospitalLogin(formData.email, formData.password);
            if (response.status) {
                notifications.show({ title: 'Welcome!', message: 'Managing hospital resources 🏥', color: 'violet' });
                login(response.data.hospital, response.data.accessToken, 'hospital');
                navigate('/hospital/dashboard');
            }
        } catch (err) {
            notifications.show({ title: 'Login Failed', message: err.response?.data?.message || 'Please check credentials', color: 'red' });
        } finally { setLoading(false); }
    };

    return (
        <AuthLayout
            icon="🏥"
            title="Hospital Login"
            subtitle="Manage inventory, beds & blood stock"
            gradient="linear-gradient(135deg, #8b5cf6, #a855f7)"
            accentGlow="rgba(139,92,246,0.3)"
        >
            <form onSubmit={handleSubmit}>
                <DarkInput
                    label="Email" placeholder="Enter hospital email"
                    name="email" type="email" value={formData.email} onChange={handleChange}
                    required accent="rgba(139,92,246,0.5)"
                />
                <DarkPasswordInput
                    label="Password" placeholder="Enter password"
                    name="password" value={formData.password} onChange={handleChange}
                    required accent="rgba(139,92,246,0.5)"
                />
                <DarkButton gradient="linear-gradient(135deg, #8b5cf6, #a855f7)" loading={loading}>
                    Sign In
                </DarkButton>
            </form>
        </AuthLayout>
    );
}
