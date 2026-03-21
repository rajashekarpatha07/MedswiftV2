import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { userLogin } from '../../api/auth';
import { useAuth } from '../../contexts/AuthContext';
import AuthLayout from '../../components/AuthLayout';
import { DarkInput, DarkPasswordInput, DarkButton, ErrorAlert } from '../../components/DarkFormControls';

export default function UserLogin() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [formData, setFormData] = useState({ phone: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const response = await userLogin(formData.phone, formData.password);
            if (response.status) {
                notifications.show({ title: 'Welcome back!', message: 'Login successful. Redirecting…', color: 'teal' });
                login(response.data.user, response.data.accessToken, 'user');
                navigate('/user/dashboard');
            }
        } catch (err) {
            const msg = err.response?.data?.message || 'Login failed. Please try again.';
            setError(msg);
            notifications.show({ title: 'Login Failed', message: msg, color: 'red' });
        } finally { setLoading(false); }
    };

    return (
        <AuthLayout
            icon="👤"
            title="Patient Login"
            subtitle="Sign in to request emergency services"
            gradient="linear-gradient(135deg, #667eea, #764ba2)"
            accentGlow="rgba(102,126,234,0.3)"
            footer={
                <span>
                    Don't have an account?{' '}
                    <Link to="/user/register" style={{ color: '#a5b4fc', fontWeight: 600, textDecoration: 'none' }}>
                        Register here
                    </Link>
                </span>
            }
        >
            <form onSubmit={handleSubmit}>
                <ErrorAlert message={error} />
                <DarkInput
                    label="Phone Number" placeholder="Enter your phone number"
                    name="phone" value={formData.phone} onChange={handleChange}
                    required accent="rgba(102,126,234,0.5)"
                />
                <DarkPasswordInput
                    label="Password" placeholder="Enter your password"
                    name="password" value={formData.password} onChange={handleChange}
                    required accent="rgba(102,126,234,0.5)"
                />
                <DarkButton gradient="linear-gradient(135deg, #667eea, #764ba2)" loading={loading}>
                    Sign In
                </DarkButton>
            </form>
        </AuthLayout>
    );
}
