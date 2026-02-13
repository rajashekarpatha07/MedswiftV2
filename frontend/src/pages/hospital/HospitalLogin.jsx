import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Container, Title, Text, TextInput, PasswordInput, Button, Card, Stack, Group, Anchor, Box, ThemeIcon } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { hospitalLogin } from '../../api/auth';
import { useAuth } from '../../contexts/AuthContext';

function HospitalLogin() {
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
                notifications.show({ title: 'Welcome!', message: 'Managing hospital resources', color: 'violet' });
                login(response.data.hospital, response.data.accessToken, 'hospital');
                navigate('/hospital/dashboard');
            }
        } catch (err) {
            notifications.show({ title: 'Login Failed', message: err.response?.data?.message || 'Please check credentials', color: 'red' });
        } finally { setLoading(false); }
    };

    return (
        <Box style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', display: 'flex', alignItems: 'center' }}>
            <Container size={440}>
                <Card padding={40} radius="xl" className="glass">
                    <Anchor component={Link} to="/" c="dimmed" size="sm" mb="lg" style={{ display: 'block' }}>← Back to Home</Anchor>
                    <Group mb="xl">
                        <ThemeIcon size={50} radius="xl" variant="gradient" gradient={{ from: 'violet', to: 'grape' }}>
                            <span style={{ fontSize: '24px' }}>🏥</span>
                        </ThemeIcon>
                        <Box>
                            <Title order={2} fw={700}>Hospital Login</Title>
                            <Text c="dimmed" size="sm">Manage inventory & resources</Text>
                        </Box>
                    </Group>
                    <form onSubmit={handleSubmit}>
                        <Stack gap="md">
                            <TextInput label="Email" placeholder="Enter hospital email" name="email" type="email" value={formData.email} onChange={handleChange} size="md" required />
                            <PasswordInput label="Password" placeholder="Enter password" name="password" value={formData.password} onChange={handleChange} size="md" required />
                            <Button type="submit" fullWidth size="lg" variant="gradient" gradient={{ from: 'violet', to: 'grape' }} loading={loading} mt="sm">Sign In</Button>
                        </Stack>
                    </form>
                </Card>
            </Container>
        </Box>
    );
}

export default HospitalLogin;
