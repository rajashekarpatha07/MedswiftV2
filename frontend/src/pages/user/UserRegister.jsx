import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { userRegister } from '../../api/auth';
import { useAuth } from '../../contexts/AuthContext';
import AuthLayout from '../../components/AuthLayout';
import { DarkInput, DarkPasswordInput, DarkSelect, DarkButton } from '../../components/DarkFormControls';

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

export default function UserRegister() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [formData, setFormData] = useState({
        name: '', email: '', phone: '', password: '',
        bloodGroup: 'A+', longitude: '', latitude: '',
    });
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const getCurrentLocation = () => {
        if (!navigator.geolocation) {
            notifications.show({ title: 'Error', message: 'Geolocation not supported', color: 'red' });
            return;
        }
        notifications.show({ title: 'Locating…', message: '📍 Getting your GPS location', color: 'blue', loading: true, id: 'loc' });
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setFormData(prev => ({ ...prev, longitude: pos.coords.longitude.toString(), latitude: pos.coords.latitude.toString() }));
                notifications.update({ id: 'loc', title: 'Success', message: '✅ Location captured', color: 'teal', loading: false });
            },
            () => notifications.update({ id: 'loc', title: 'Error', message: 'Could not get location', color: 'red', loading: false })
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.longitude || !formData.latitude) {
            notifications.show({ title: 'Location Required', message: 'Please capture your location before registering', color: 'yellow' });
            return;
        }
        setLoading(true);
        try {
            const res = await userRegister({
                name: formData.name, email: formData.email, phone: formData.phone,
                password: formData.password, bloodGroup: formData.bloodGroup,
                location: { type: 'Point', coordinates: [parseFloat(formData.longitude), parseFloat(formData.latitude)] },
            });
            if (res.status) {
                notifications.show({ title: 'Welcome!', message: 'Account created successfully', color: 'teal' });
                login(res.data.user, res.data.accessToken, 'user');
                navigate('/user/dashboard');
            }
        } catch (err) {
            notifications.show({ title: 'Error', message: err.response?.data?.message || 'Registration failed', color: 'red' });
        } finally { setLoading(false); }
    };

    return (
        <AuthLayout
            icon="👤" wide
            title="Patient Registration"
            subtitle="Create your emergency profile"
            gradient="linear-gradient(135deg, #667eea, #764ba2)"
            accentGlow="rgba(102,126,234,0.3)"
            footer={
                <span>
                    Already have an account?{' '}
                    <Link to="/user/login" style={{ color: '#a5b4fc', fontWeight: 600, textDecoration: 'none' }}>Login here</Link>
                </span>
            }
        >
            <form onSubmit={handleSubmit}>
                <DarkInput label="Full Name" placeholder="Enter your full name" name="name" value={formData.name} onChange={handleChange} required accent="rgba(102,126,234,0.5)" />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <DarkInput label="Email" placeholder="you@email.com" name="email" type="email" value={formData.email} onChange={handleChange} required accent="rgba(102,126,234,0.5)" />
                    <DarkInput label="Phone" placeholder="+91 98765 43210" name="phone" type="tel" value={formData.phone} onChange={handleChange} required accent="rgba(102,126,234,0.5)" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <DarkPasswordInput label="Password" placeholder="Min 6 characters" name="password" value={formData.password} onChange={handleChange} required minLength={6} accent="rgba(102,126,234,0.5)" />
                    <DarkSelect label="Blood Group" name="bloodGroup" value={formData.bloodGroup} onChange={val => setFormData(prev => ({ ...prev, bloodGroup: val }))} options={bloodGroups} accent="rgba(102,126,234,0.5)" />
                </div>

                {/* Location section */}
                <div style={{
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 14, padding: 16, marginBottom: 16,
                }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>
                        📍 Location <span style={{ color: '#f87171' }}>*</span>
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                        <DarkInput placeholder="Longitude" name="longitude" value={formData.longitude} onChange={handleChange} disabled />
                        <DarkInput placeholder="Latitude" name="latitude" value={formData.latitude} onChange={handleChange} disabled />
                    </div>
                    <button type="button" onClick={getCurrentLocation} style={{
                        width: '100%', padding: '11px 16px', borderRadius: 10, border: '1px solid rgba(99,102,241,0.25)',
                        background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', fontWeight: 600, fontSize: 13,
                        cursor: 'pointer', fontFamily: "'Inter', sans-serif", transition: 'all 0.2s',
                    }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.18)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(99,102,241,0.1)'}
                    >
                        📍 Get Current Location
                    </button>
                    {formData.longitude && (
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 8, textAlign: 'center' }}>
                            ✅ Location captured: {parseFloat(formData.latitude).toFixed(4)}°N, {parseFloat(formData.longitude).toFixed(4)}°E
                        </p>
                    )}
                </div>

                <DarkButton gradient="linear-gradient(135deg, #667eea, #764ba2)" loading={loading}>
                    Create Account
                </DarkButton>
            </form>
        </AuthLayout>
    );
}
