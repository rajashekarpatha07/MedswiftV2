import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    Container, Title, Text, TextInput, PasswordInput, Button, Card,
    Stack, Group, Anchor, Box, Alert, Select, ThemeIcon, SimpleGrid
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { userRegister } from '../../api/auth';
import { useAuth } from '../../contexts/AuthContext';

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

function UserRegister() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [formData, setFormData] = useState({
        name: '', email: '', phone: '', password: '',
        bloodGroup: 'A+', longitude: '', latitude: ''
    });
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const getCurrentLocation = () => {
        if (!navigator.geolocation) {
            notifications.show({ title: 'Error', message: 'Geolocation not supported', color: 'red' });
            return;
        }
        notifications.show({ title: 'Locating...', message: '📍 Getting your GPS location', color: 'blue', loading: true, id: 'loc' });
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setFormData({ ...formData, longitude: pos.coords.longitude.toString(), latitude: pos.coords.latitude.toString() });
                notifications.update({ id: 'loc', title: 'Success', message: '✅ Location captured', color: 'teal', loading: false });
            },
            () => notifications.update({ id: 'loc', title: 'Error', message: 'Could not get location', color: 'red', loading: false })
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        // Validate location is provided
        if (!formData.longitude || !formData.latitude) {
            notifications.show({ 
                title: 'Location Required', 
                message: 'Please capture your location before registering', 
                color: 'yellow' 
            });
            setLoading(false);
            return;
        }

        try {
            const res = await userRegister({
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                password: formData.password,
                bloodGroup: formData.bloodGroup,
                location: {
                    type: 'Point',
                    coordinates: [parseFloat(formData.longitude), parseFloat(formData.latitude)]
                }
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
        <Box style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            display: 'flex',
            alignItems: 'center',
            padding: '40px 0'
        }}>
            <Container size={480}>
                <Card padding={40} radius="xl" className="glass">
                    <Anchor component={Link} to="/" c="dimmed" size="sm" mb="lg" style={{ display: 'block' }}>
                        ← Back to Home
                    </Anchor>

                    <Group mb="xl">
                        <ThemeIcon size={50} radius="xl" variant="gradient" gradient={{ from: 'blue', to: 'violet' }}>
                            <span style={{ fontSize: '24px' }}>👤</span>
                        </ThemeIcon>
                        <Box>
                            <Title order={2} fw={700}>Patient Registration</Title>
                            <Text c="dimmed" size="sm">Create your emergency profile</Text>
                        </Box>
                    </Group>

                    <form onSubmit={handleSubmit}>
                        <Stack gap="md">
                            <TextInput label="Full Name" placeholder="Enter your full name" name="name" value={formData.name} onChange={handleChange} size="md" required />
                            <TextInput label="Email" placeholder="Enter your email" name="email" type="email" value={formData.email} onChange={handleChange} size="md" required />
                            <TextInput label="Phone Number" placeholder="Enter your phone" name="phone" type="tel" value={formData.phone} onChange={handleChange} size="md" required />
                            <PasswordInput label="Password" placeholder="Create a password (min 6 chars)" name="password" value={formData.password} onChange={handleChange} size="md" minLength={6} required />

                            <Select
                                label="Blood Group"
                                data={bloodGroups}
                                value={formData.bloodGroup}
                                onChange={(val) => setFormData({ ...formData, bloodGroup: val })}
                                size="md"
                            />

                            <Box>
                                <Text size="sm" fw={500} mb="xs">Location <span style={{color: 'red'}}>*</span></Text>
                                <SimpleGrid cols={2} spacing="sm">
                                    <TextInput placeholder="Longitude" name="longitude" value={formData.longitude} onChange={handleChange} disabled required />
                                    <TextInput placeholder="Latitude" name="latitude" value={formData.latitude} onChange={handleChange} disabled required />
                                </SimpleGrid>
                                <Button variant="light" fullWidth mt="xs" onClick={getCurrentLocation}>
                                    📍 Get Current Location
                                </Button>
                            </Box>

                            <Button
                                type="submit"
                                fullWidth
                                size="lg"
                                variant="gradient"
                                gradient={{ from: 'blue', to: 'violet' }}
                                loading={loading}
                                mt="sm"
                            >
                                Create Account
                            </Button>
                        </Stack>
                    </form>

                    <Text ta="center" mt="xl" c="dimmed" size="sm">
                        Already have an account?{' '}
                        <Anchor component={Link} to="/user/login" fw={600}>Login here</Anchor>
                    </Text>
                </Card>
            </Container>
        </Box>
    );
}

export default UserRegister;
