import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Title, Text, Button, Card, Stack, Group, Box, Paper, ThemeIcon, Loader, Badge, Code, RingProgress, Center } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../contexts/AuthContext';
import { getAmbulanceStats } from '../../api/ambulance';

function AdminDashboard() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [stats, setStats] = useState({ activeAmbulances: 0, ambulanceIds: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
        const interval = setInterval(loadStats, 30000);
        return () => clearInterval(interval);
    }, []);

    const loadStats = async () => {
        try {
            const res = await getAmbulanceStats();
            if (res.status) setStats(res.data);
        } catch {
            notifications.show({ title: 'Error', message: 'Failed to load stats', color: 'red' });
        } finally { setLoading(false); }
    };

    const handleLogout = async () => { await logout(); navigate('/'); };

    if (loading) {
        return (
            <Box style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loader size="xl" color="orange" />
            </Box>
        );
    }

    return (
        <Box style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
            <Paper py="md" px="xl" style={{ background: 'rgba(255,255,255,0.95)', position: 'sticky', top: 0, zIndex: 100 }}>
                <Group justify="space-between">
                    <Group>
                        <ThemeIcon size={45} radius="xl" variant="gradient" gradient={{ from: 'orange', to: 'red' }}>
                            <span style={{ fontSize: '20px' }}>⚙️</span>
                        </ThemeIcon>
                        <Box>
                            <Text fw={600} size="lg">Admin Dashboard</Text>
                            <Text size="sm" c="dimmed">{user?.name}</Text>
                        </Box>
                    </Group>
                    <Button variant="subtle" color="gray" onClick={handleLogout}>Logout</Button>
                </Group>
            </Paper>

            <Container size="lg" py="xl">
                <Stack gap="lg">
                    {/* System Stats */}
                    <Card radius="lg" padding="xl" className="glass">
                        <Group mb="lg">
                            <ThemeIcon size={40} radius="xl" color="orange"><span>📊</span></ThemeIcon>
                            <Title order={3}>System Statistics</Title>
                        </Group>

                        <Center>
                            <Box ta="center">
                                <RingProgress
                                    size={180}
                                    thickness={16}
                                    roundCaps
                                    sections={[{ value: Math.min((stats.activeAmbulances / 10) * 100, 100), color: 'teal' }]}
                                    label={
                                        <Center>
                                            <Box ta="center">
                                                <Text size="3rem" fw={800} c="teal">{stats.activeAmbulances}</Text>
                                                <Text size="sm" c="dimmed">Active</Text>
                                            </Box>
                                        </Center>
                                    }
                                />
                                <Text mt="md" fw={600}>Active Ambulances</Text>
                            </Box>
                        </Center>
                    </Card>

                    {/* Active Ambulance IDs */}
                    <Card radius="lg" padding="xl" className="glass">
                        <Group mb="lg">
                            <ThemeIcon size={40} radius="xl" color="teal"><span>🚑</span></ThemeIcon>
                            <Title order={3}>Active Ambulance IDs</Title>
                            <Badge color="teal" variant="light" size="lg">{stats.ambulanceIds.length}</Badge>
                        </Group>

                        {stats.ambulanceIds.length === 0 ? (
                            <Text c="dimmed" ta="center" py="xl">No active ambulances</Text>
                        ) : (
                            <Stack gap="sm">
                                {stats.ambulanceIds.map((id) => (
                                    <Paper key={id} p="md" radius="md" bg="gray.0">
                                        <Group>
                                            <Box className="status-dot status-online" />
                                            <Code c="teal">{id}</Code>
                                        </Group>
                                    </Paper>
                                ))}
                            </Stack>
                        )}
                    </Card>

                    {/* Admin Profile */}
                    <Card radius="lg" padding="xl" className="glass">
                        <Group mb="md">
                            <ThemeIcon size={40} radius="xl" color="blue"><span>👤</span></ThemeIcon>
                            <Title order={3}>Admin Profile</Title>
                        </Group>
                        <Stack gap="sm">
                            <Box><Text c="dimmed" size="sm">Name</Text><Text fw={500}>{user?.name}</Text></Box>
                            <Box><Text c="dimmed" size="sm">Email</Text><Text fw={500}>{user?.email}</Text></Box>
                        </Stack>
                    </Card>
                </Stack>
            </Container>
        </Box>
    );
}

export default AdminDashboard;
