import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Container, Title, Text, Button, Card, Stack, Group, Box, Badge,
    Alert, Timeline, ThemeIcon, Loader, Paper, Divider, TextInput, Checkbox
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { createTrip, getActiveTrip, getTripHistory } from '../../api/trip';
import LiveMap from '../../components/LiveMap';

const statusConfig = {
    'SEARCHING': { color: 'yellow', icon: '🔍', label: 'Searching' },
    'ACCEPTED': { color: 'blue', icon: '✓', label: 'Accepted' },
    'ARRIVED_PICKUP': { color: 'indigo', icon: '📍', label: 'At Pickup' },
    'EN_ROUTE_HOSPITAL': { color: 'violet', icon: '🚑', label: 'En Route' },
    'ARRIVED_HOSPITAL': { color: 'grape', icon: '🏥', label: 'At Hospital' },
    'COMPLETED': { color: 'teal', icon: '✓', label: 'Completed' },
    'CANCELLED': { color: 'red', icon: '✕', label: 'Cancelled' }
};

function UserDashboard() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { isConnected, on, joinTrip } = useSocket();

    const [activeTrip, setActiveTrip] = useState(null);
    const [tripHistory, setTripHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [requesting, setRequesting] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ pickupAddress: '', requireBeds: false });

    // Ambulance live location (from socket updates)
    const [ambulanceLocation, setAmbulanceLocation] = useState(null);

    useEffect(() => { loadData(); }, []);

    // Listen for ambulance location updates via socket
    useEffect(() => {
        if (!isConnected || !activeTrip) return;

        // Join the trip room to receive updates
        if (activeTrip._id) {
            joinTrip(activeTrip._id);
        }

        // Listen for location updates (event name matches backend: location_updated)
        const unsubLocation = on('location_updated', (data) => {
            console.log('📍 Ambulance location update:', data);
            if (data.location?.latitude && data.location?.longitude) {
                // Backend sends {location: {latitude, longitude}} format
                setAmbulanceLocation([data.location.longitude, data.location.latitude]);
            }
        });

        // Listen for trip status updates
        const unsubStatus = on('trip_status_update', (data) => {
            console.log('🔄 Trip status update:', data);
            if (data.trip) {
                setActiveTrip(data.trip);
            }
        });

        return () => {
            unsubLocation();
            unsubStatus();
        };
    }, [isConnected, activeTrip?._id, on, joinTrip]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [active, history] = await Promise.all([
                getActiveTrip().catch(() => null),
                getTripHistory(5).catch(() => ({ data: { trips: [] } }))
            ]);
            if (active?.data) {
                setActiveTrip(active.data);
                // If ambulance has location data, set it
                if (active.data.ambulanceId?.location?.coordinates) {
                    setAmbulanceLocation(active.data.ambulanceId.location.coordinates);
                }
            }
            setTripHistory(history?.data?.trips || []);
        } finally {
            setLoading(false);
        }
    };

    const handleRequest = async () => {
        if (!navigator.geolocation) {
            notifications.show({ title: 'Error', message: 'Geolocation not supported', color: 'red' });
            return;
        }
        setRequesting(true);
        notifications.show({ title: 'Locating...', message: '📍 Getting your GPS location', color: 'blue', loading: true, id: 'request' });

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                try {
                    notifications.update({ id: 'request', title: 'Searching...', message: '🔍 Finding nearest ambulance', loading: true });
                    const res = await createTrip({
                        pickupAddress: formData.pickupAddress || 'Current Location',
                        pickupCoordinates: [pos.coords.longitude, pos.coords.latitude],
                        bloodType: user.bloodGroup,
                        requireBeds: formData.requireBeds
                    });
                    if (res.status) {
                        setActiveTrip(res.data);
                        setShowForm(false);
                        notifications.update({ id: 'request', title: 'Success!', message: '🚑 Ambulance is on the way!', color: 'teal', loading: false });
                    }
                } catch (err) {
                    notifications.update({ id: 'request', title: 'Failed', message: err.response?.data?.message || 'Request failed', color: 'red', loading: false });
                } finally { setRequesting(false); }
            },
            () => {
                notifications.update({ id: 'request', title: 'Error', message: 'Could not get location', color: 'red', loading: false });
                setRequesting(false);
            },
            { enableHighAccuracy: true, timeout: 15000 }
        );
    };

    const handleLogout = async () => {
        await logout();
        notifications.show({ title: 'Logged out', message: 'See you soon!', color: 'gray' });
        navigate('/');
    };

    const getStatus = (s) => statusConfig[s] || { color: 'gray', label: s, icon: '' };

    // Get coordinates from different data structures
    const getPickupCoords = () => {
        if (activeTrip?.pickup?.coordinates) return activeTrip.pickup.coordinates;
        return null;
    };

    const getHospitalCoords = () => {
        if (activeTrip?.dropoff?.coordinates) return activeTrip.dropoff.coordinates;
        if (activeTrip?.hospitalId?.location?.coordinates) return activeTrip.hospitalId.location.coordinates;
        return null;
    };

    if (loading) {
        return (
            <Box style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loader size="xl" color="violet" />
            </Box>
        );
    }

    return (
        <Box style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
            {/* Header */}
            <Paper py="md" px="xl" style={{ background: 'rgba(255,255,255,0.95)', position: 'sticky', top: 0, zIndex: 100 }}>
                <Group justify="space-between">
                    <Group>
                        <ThemeIcon size={45} radius="xl" variant="gradient" gradient={{ from: 'blue', to: 'violet' }}>
                            <span style={{ fontSize: '20px' }}>👤</span>
                        </ThemeIcon>
                        <Box>
                            <Text fw={600} size="lg">Welcome, {user?.name}</Text>
                            <Badge color="red" variant="light" size="sm">🩸 {user?.bloodGroup}</Badge>
                        </Box>
                    </Group>
                    <Group>
                        <Badge color={isConnected ? 'teal' : 'gray'} variant="dot" size="lg">
                            {isConnected ? 'Live' : 'Offline'}
                        </Badge>
                        <Button variant="subtle" color="gray" onClick={handleLogout}>Logout</Button>
                    </Group>
                </Group>
            </Paper>

            <Container size="md" py="xl">
                <Stack gap="lg">
                    {/* Active Trip Card */}
                    {activeTrip && (
                        <Card radius="lg" padding="xl" className="glass" style={{ border: '2px solid #10b981' }}>
                            <Group justify="space-between" mb="md">
                                <Group>
                                    <ThemeIcon size={40} radius="xl" color="teal">
                                        <span>🚑</span>
                                    </ThemeIcon>
                                    <Title order={3}>Active Trip</Title>
                                </Group>
                                <Badge
                                    size="lg"
                                    variant="gradient"
                                    gradient={{ from: getStatus(activeTrip.status).color, to: getStatus(activeTrip.status).color }}
                                >
                                    {getStatus(activeTrip.status).icon} {getStatus(activeTrip.status).label}
                                </Badge>
                            </Group>

                            {/* Live Map showing ambulance location */}
                            {(ambulanceLocation || getPickupCoords() || getHospitalCoords()) && (
                                <Box mb="md">
                                    <Text fw={600} mb="sm">📍 Live Tracking</Text>
                                    <LiveMap
                                        ambulanceLocation={ambulanceLocation}
                                        pickupLocation={getPickupCoords()}
                                        hospitalLocation={getHospitalCoords()}
                                        height="250px"
                                        showAmbulance={!!ambulanceLocation}
                                        showPickup={activeTrip.status !== 'COMPLETED'}
                                        showHospital={activeTrip.status === 'EN_ROUTE_HOSPITAL' || activeTrip.status === 'ARRIVED_HOSPITAL'}
                                    />
                                </Box>
                            )}

                            <Paper p="md" radius="md" bg="gray.0">
                                <Stack gap="sm">
                                    <Group>
                                        <Text size="sm" c="dimmed" w={80}>Pickup:</Text>
                                        <Text fw={500}>{activeTrip.pickup?.address || 'Current Location'}</Text>
                                    </Group>
                                    {activeTrip.ambulanceId && (
                                        <Group>
                                            <Text size="sm" c="dimmed" w={80}>Ambulance:</Text>
                                            <Text fw={500}>
                                                {typeof activeTrip.ambulanceId === 'object'
                                                    ? `${activeTrip.ambulanceId.vehicleNumber} • ${activeTrip.ambulanceId.driverName}`
                                                    : 'Assigned'}
                                            </Text>
                                        </Group>
                                    )}
                                    {activeTrip.dropoff?.address && (
                                        <Group>
                                            <Text size="sm" c="dimmed" w={80}>Hospital:</Text>
                                            <Text fw={500}>{activeTrip.dropoff.address}</Text>
                                        </Group>
                                    )}
                                </Stack>
                            </Paper>

                            {activeTrip.timeline?.length > 0 && (
                                <>
                                    <Divider my="md" />
                                    <Text fw={600} mb="sm">Timeline</Text>
                                    <Timeline active={activeTrip.timeline.length - 1} bulletSize={24} lineWidth={2}>
                                        {activeTrip.timeline.map((e, i) => (
                                            <Timeline.Item
                                                key={i}
                                                title={e.status.replace(/_/g, ' ')}
                                                color={getStatus(e.status).color}
                                            >
                                                <Text size="xs" c="dimmed">{new Date(e.timestamp).toLocaleTimeString()}</Text>
                                            </Timeline.Item>
                                        ))}
                                    </Timeline>
                                </>
                            )}
                        </Card>
                    )}

                    {/* Request Form */}
                    {!activeTrip && (
                        <Card radius="lg" padding="xl" className="glass">
                            <Group mb="lg">
                                <ThemeIcon size={45} radius="xl" variant="gradient" gradient={{ from: 'red', to: 'pink' }} className="animate-pulse-glow">
                                    <span style={{ fontSize: '22px' }}>🚨</span>
                                </ThemeIcon>
                                <Box>
                                    <Title order={3}>Emergency Request</Title>
                                    <Text c="dimmed" size="sm">Get immediate help</Text>
                                </Box>
                            </Group>

                            {!showForm ? (
                                <Button
                                    fullWidth
                                    size="xl"
                                    variant="gradient"
                                    gradient={{ from: 'red', to: 'pink' }}
                                    onClick={() => setShowForm(true)}
                                    style={{ height: '70px', fontSize: '20px' }}
                                >
                                    🚨 Request Ambulance Now
                                </Button>
                            ) : (
                                <Stack gap="md">
                                    <TextInput
                                        label="Pickup Address (optional)"
                                        placeholder="Leave blank to use current GPS location"
                                        value={formData.pickupAddress}
                                        onChange={(e) => setFormData({ ...formData, pickupAddress: e.target.value })}
                                        size="md"
                                    />
                                    <Checkbox
                                        label="Require hospital bed"
                                        checked={formData.requireBeds}
                                        onChange={(e) => setFormData({ ...formData, requireBeds: e.target.checked })}
                                    />
                                    <Group mt="sm">
                                        <Button
                                            flex={1}
                                            size="lg"
                                            variant="gradient"
                                            gradient={{ from: 'red', to: 'pink' }}
                                            onClick={handleRequest}
                                            loading={requesting}
                                        >
                                            🚑 Send Emergency Request
                                        </Button>
                                        <Button variant="subtle" color="gray" onClick={() => setShowForm(false)} disabled={requesting}>
                                            Cancel
                                        </Button>
                                    </Group>
                                </Stack>
                            )}
                        </Card>
                    )}

                    {/* Trip History */}
                    <Card radius="lg" padding="xl" className="glass">
                        <Title order={3} mb="lg">📋 Trip History</Title>
                        {tripHistory.length === 0 ? (
                            <Text c="dimmed" ta="center" py="xl">No previous trips</Text>
                        ) : (
                            <Stack gap="sm">
                                {tripHistory.map((trip) => (
                                    <Paper key={trip._id} p="md" radius="md" bg="gray.0">
                                        <Group justify="space-between">
                                            <Box>
                                                <Badge color={getStatus(trip.status).color} variant="light" mb="xs">
                                                    {trip.status.replace(/_/g, ' ')}
                                                </Badge>
                                                <Text size="sm">{trip.pickup?.address || 'No address'}</Text>
                                            </Box>
                                            <Text size="xs" c="dimmed">{new Date(trip.createdAt).toLocaleDateString()}</Text>
                                        </Group>
                                    </Paper>
                                ))}
                            </Stack>
                        )}
                    </Card>
                </Stack>
            </Container>
        </Box>
    );
}

export default UserDashboard;
