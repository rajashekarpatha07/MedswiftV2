import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    Container, Title, Text, TextInput, PasswordInput, Button, Card,
    Stack, Group, Anchor, Box, ThemeIcon
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ambulanceLogin } from '../../api/auth';
import { useAuth } from '../../contexts/AuthContext';

function AmbulanceLogin() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [formData, setFormData] = useState({ driverPhone: '', password: '' });
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await ambulanceLogin(formData.driverPhone, formData.password);
            if (response.status) {
                notifications.show({ title: 'Welcome!', message: 'Ready to save lives', color: 'teal' });
                login(response.data.ambulance, response.data.accessToken, 'ambulance');
                navigate('/ambulance/dashboard');
            }
        } catch (err) {
            notifications.show({ title: 'Login Failed', message: err.response?.data?.message || 'Please check credentials', color: 'red' });
        } finally { setLoading(false); }
    };

    return (
        <Box style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            display: 'flex',
            alignItems: 'center'
        }}>
            <Container size={440}>
                <Card padding={40} radius="xl" className="glass">
                    <Anchor component={Link} to="/" c="dimmed" size="sm" mb="lg" style={{ display: 'block' }}>
                        ← Back to Home
                    </Anchor>

                    <Group mb="xl">
                        <ThemeIcon size={50} radius="xl" variant="gradient" gradient={{ from: 'teal', to: 'green' }}>
                            <span style={{ fontSize: '24px' }}>🚑</span>
                        </ThemeIcon>
                        <Box>
                            <Title order={2} fw={700}>Ambulance Login</Title>
                            <Text c="dimmed" size="sm">Sign in to manage trips</Text>
                        </Box>
                    </Group>

                    <form onSubmit={handleSubmit}>
                        <Stack gap="md">
                            <TextInput label="Phone Number" placeholder="Enter your phone number" name="driverPhone" value={formData.driverPhone} onChange={handleChange} size="md" required />
                            <PasswordInput label="Password" placeholder="Enter your password" name="password" value={formData.password} onChange={handleChange} size="md" required />
                            <Button type="submit" fullWidth size="lg" variant="gradient" gradient={{ from: 'teal', to: 'green' }} loading={loading} mt="sm">
                                Sign In
                            </Button>
                        </Stack>
                    </form>
                </Card>
            </Container>
        </Box>
    );
}

export default AmbulanceLogin;
