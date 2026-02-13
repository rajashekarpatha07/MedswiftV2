import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Title, Text, Button, Card, Stack, Group, Box, Paper, ThemeIcon, SimpleGrid, NumberInput, Badge } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../contexts/AuthContext';
import { updateHospitalInventory } from '../../api/hospital';

const bloodTypes = [
    { key: 'A_positive', label: 'A+' }, { key: 'A_negative', label: 'A-' },
    { key: 'B_positive', label: 'B+' }, { key: 'B_negative', label: 'B-' },
    { key: 'O_positive', label: 'O+' }, { key: 'O_negative', label: 'O-' },
    { key: 'AB_positive', label: 'AB+' }, { key: 'AB_negative', label: 'AB-' }
];

function HospitalDashboard() {
    const navigate = useNavigate();
    const { user, logout, updateUser } = useAuth();

    const [inventory, setInventory] = useState(user?.inventory || {
        beds: { total: 0, available: 0 },
        bloodStock: { A_positive: 0, A_negative: 0, B_positive: 0, B_negative: 0, O_positive: 0, O_negative: 0, AB_positive: 0, AB_negative: 0 }
    });
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);

    const handleBedChange = (field, value) => setInventory({ ...inventory, beds: { ...inventory.beds, [field]: value || 0 } });
    const handleBloodChange = (type, value) => setInventory({ ...inventory, bloodStock: { ...inventory.bloodStock, [type]: value || 0 } });

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await updateHospitalInventory(inventory);
            if (res.status) {
                updateUser({ inventory: res.data.inventory });
                notifications.show({ title: 'Saved!', message: 'Inventory updated successfully', color: 'teal' });
                setEditing(false);
            }
        } catch (err) {
            notifications.show({ title: 'Error', message: err.response?.data?.message || 'Failed to save', color: 'red' });
        } finally { setSaving(false); }
    };

    const handleLogout = async () => { await logout(); navigate('/'); };

    return (
        <Box style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
            <Paper py="md" px="xl" style={{ background: 'rgba(255,255,255,0.95)', position: 'sticky', top: 0, zIndex: 100 }}>
                <Group justify="space-between">
                    <Group>
                        <ThemeIcon size={45} radius="xl" variant="gradient" gradient={{ from: 'violet', to: 'grape' }}>
                            <span style={{ fontSize: '20px' }}>🏥</span>
                        </ThemeIcon>
                        <Box>
                            <Text fw={600} size="lg">{user?.name}</Text>
                            <Text size="sm" c="dimmed">{user?.address}</Text>
                        </Box>
                    </Group>
                    <Button variant="subtle" color="gray" onClick={handleLogout}>Logout</Button>
                </Group>
            </Paper>

            <Container size="lg" py="xl">
                <Stack gap="lg">
                    {/* Bed Inventory */}
                    <Card radius="lg" padding="xl" className="glass">
                        <Group justify="space-between" mb="lg">
                            <Group>
                                <ThemeIcon size={40} radius="xl" color="violet"><span>🛏️</span></ThemeIcon>
                                <Title order={3}>Bed Availability</Title>
                            </Group>
                            {!editing && <Button variant="light" color="violet" onClick={() => setEditing(true)}>Edit</Button>}
                        </Group>
                        <SimpleGrid cols={3} spacing="md">
                            <Paper p="xl" radius="md" bg="gray.0" ta="center">
                                <Text size="3rem" fw={700} c="dark">{inventory.beds.total}</Text>
                                <Text c="dimmed">Total Beds</Text>
                                {editing && <NumberInput mt="sm" value={inventory.beds.total} onChange={(v) => handleBedChange('total', v)} min={0} />}
                            </Paper>
                            <Paper p="xl" radius="md" ta="center" style={{ background: 'linear-gradient(135deg, #11998e22 0%, #38ef7d22 100%)', border: '1px solid #10b981' }}>
                                <Text size="3rem" fw={700} c="teal">{inventory.beds.available}</Text>
                                <Text c="dimmed">Available</Text>
                                {editing && <NumberInput mt="sm" value={inventory.beds.available} onChange={(v) => handleBedChange('available', v)} min={0} max={inventory.beds.total} />}
                            </Paper>
                            <Paper p="xl" radius="md" ta="center" style={{ background: 'linear-gradient(135deg, #ff416c22 0%, #ff4b2b22 100%)', border: '1px solid #ef4444' }}>
                                <Text size="3rem" fw={700} c="red">{inventory.beds.total - inventory.beds.available}</Text>
                                <Text c="dimmed">Occupied</Text>
                            </Paper>
                        </SimpleGrid>
                    </Card>

                    {/* Blood Stock */}
                    <Card radius="lg" padding="xl" className="glass">
                        <Group mb="lg">
                            <ThemeIcon size={40} radius="xl" color="red"><span>🩸</span></ThemeIcon>
                            <Title order={3}>Blood Stock</Title>
                        </Group>
                        <SimpleGrid cols={4} spacing="md">
                            {bloodTypes.map(({ key, label }) => (
                                <Paper key={key} p="lg" radius="md" bg="gray.0" ta="center">
                                    <Badge color="red" size="lg" mb="xs">{label}</Badge>
                                    {editing ? (
                                        <NumberInput value={inventory.bloodStock[key]} onChange={(v) => handleBloodChange(key, v)} min={0} />
                                    ) : (
                                        <Text size="xl" fw={700}>{inventory.bloodStock[key]} <Text span size="sm" c="dimmed">units</Text></Text>
                                    )}
                                </Paper>
                            ))}
                        </SimpleGrid>
                    </Card>

                    {editing && (
                        <Group>
                            <Button flex={1} size="lg" variant="gradient" gradient={{ from: 'violet', to: 'grape' }} onClick={handleSave} loading={saving}>
                                Save Changes
                            </Button>
                            <Button variant="subtle" color="gray" onClick={() => { setEditing(false); setInventory(user?.inventory || inventory); }}>Cancel</Button>
                        </Group>
                    )}

                    {/* Contact */}
                    <Card radius="lg" padding="xl" className="glass">
                        <Group mb="md">
                            <ThemeIcon size={40} radius="xl" color="blue"><span>📞</span></ThemeIcon>
                            <Title order={3}>Contact Info</Title>
                        </Group>
                        <SimpleGrid cols={2}>
                            <Box><Text c="dimmed" size="sm">Email</Text><Text fw={500}>{user?.email}</Text></Box>
                            <Box><Text c="dimmed" size="sm">Phone</Text><Text fw={500}>{user?.phone}</Text></Box>
                        </SimpleGrid>
                    </Card>
                </Stack>
            </Container>
        </Box>
    );
}

export default HospitalDashboard;
