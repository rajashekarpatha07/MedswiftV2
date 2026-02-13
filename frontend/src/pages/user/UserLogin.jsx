import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    Container, Title, Text, TextInput, PasswordInput, Button, Card,
    Stack, Group, Anchor, Box, Alert, Loader, ThemeIcon
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { userLogin } from '../../api/auth';
import { useAuth } from '../../contexts/AuthContext';

function UserLogin() {
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
                notifications.show({
                    title: 'Welcome back!',
                    message: 'Login successful. Redirecting...',
                    color: 'teal',
                });
                login(response.data.user, response.data.accessToken, 'user');
                navigate('/user/dashboard');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed. Please try again.');
            notifications.show({
                title: 'Login Failed',
                message: err.response?.data?.message || 'Please check your credentials',
                color: 'red',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            display: 'flex',
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Background decorations */}
            <Box style={{
                position: 'absolute',
                top: '20%',
                right: '10%',
                width: '300px',
                height: '300px',
                background: 'radial-gradient(circle, rgba(102,126,234,0.3) 0%, transparent 70%)',
                borderRadius: '50%',
                filter: 'blur(40px)',
            }} />
            <Box style={{
                position: 'absolute',
                bottom: '10%',
                left: '5%',
                width: '250px',
                height: '250px',
                background: 'radial-gradient(circle, rgba(255,107,107,0.2) 0%, transparent 70%)',
                borderRadius: '50%',
                filter: 'blur(50px)',
            }} />

            <Container size={440} style={{ position: 'relative', zIndex: 1 }}>
                <Card
                    padding={40}
                    radius="xl"
                    className="glass"
                    style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                >
                    <Anchor component={Link} to="/" c="dimmed" size="sm" mb="lg" style={{ display: 'block' }}>
                        ← Back to Home
                    </Anchor>

                    <Group mb="xl">
                        <ThemeIcon size={50} radius="xl" variant="gradient" gradient={{ from: 'blue', to: 'violet' }}>
                            <span style={{ fontSize: '24px' }}>👤</span>
                        </ThemeIcon>
                        <Box>
                            <Title order={2} fw={700}>Patient Login</Title>
                            <Text c="dimmed" size="sm">Sign in to request emergency services</Text>
                        </Box>
                    </Group>

                    <form onSubmit={handleSubmit}>
                        <Stack gap="md">
                            <TextInput
                                label="Phone Number"
                                placeholder="Enter your phone number"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                size="md"
                                required
                            />

                            <PasswordInput
                                label="Password"
                                placeholder="Enter your password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                size="md"
                                required
                            />

                            {error && (
                                <Alert color="red" variant="light" radius="md">
                                    {error}
                                </Alert>
                            )}

                            <Button
                                type="submit"
                                fullWidth
                                size="lg"
                                variant="gradient"
                                gradient={{ from: 'blue', to: 'violet' }}
                                loading={loading}
                                mt="sm"
                            >
                                Sign In
                            </Button>
                        </Stack>
                    </form>

                    <Text ta="center" mt="xl" c="dimmed" size="sm">
                        Don't have an account?{' '}
                        <Anchor component={Link} to="/user/register" fw={600}>
                            Register here
                        </Anchor>
                    </Text>
                </Card>
            </Container>
        </Box>
    );
}

export default UserLogin;
