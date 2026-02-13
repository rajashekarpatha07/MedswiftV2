import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Container, Title, Text, Button, Card, Stack, Group, Box, Badge,
    Paper, ThemeIcon, Loader, SegmentedControl, Divider
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { updateAmbulanceStatus, updateAmbulanceLocation } from '../../api/ambulance';
import { getAmbulanceActiveTrip, acceptTrip, updateTripStatus } from '../../api/trip';
import { navigateFromCurrent } from '../../components/LiveMap';

const statusFlow = {
    'ACCEPTED': 'ARRIVED_PICKUP',
    'ARRIVED_PICKUP': 'EN_ROUTE_HOSPITAL',
    'EN_ROUTE_HOSPITAL': 'ARRIVED_HOSPITAL',
    'ARRIVED_HOSPITAL': 'COMPLETED'
};

const statusLabels = {
    'ARRIVED_PICKUP': 'Arrived at Pickup',
    'EN_ROUTE_HOSPITAL': 'En Route to Hospital',
    'ARRIVED_HOSPITAL': 'Arrived at Hospital',
    'COMPLETED': 'Complete Trip'
};

function AmbulanceDashboard() {
    const navigate = useNavigate();
    const { user, logout, updateUser } = useAuth();
    const { isConnected, connectionError, joinTrip, on, emit } = useSocket();

    const [status, setStatus] = useState(user?.status || 'offline');
    const [activeTrip, setActiveTrip] = useState(null);
    const [pendingTrips, setPendingTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        loadActiveTrip();
        const cleanup = startLocationUpdates();
        return cleanup;
    }, [status]);

    useEffect(() => {
        if (!isConnected) return;

        const unsubRequest = on('new_trip_request', (trip) => {
            notifications.show({ title: 'New Request!', message: 'A patient needs help', color: 'blue' });
            setPendingTrips(prev => [...prev, trip]);
        });

        const unsubAssigned = on('new_trip_assigned', (data) => {
            notifications.show({ title: '🚨 Trip Assigned!', message: 'New emergency trip assigned to you', color: 'red' });
            setActiveTrip(data.trip);
            setStatus('on-trip');
            if (data.tripId) joinTrip(data.tripId);

            // Auto-open navigation to pickup location
            if (data.trip?.pickup?.coordinates) {
                const [lng, lat] = data.trip.pickup.coordinates;
                setTimeout(() => {
                    notifications.show({
                        title: '🗺️ Opening Navigation',
                        message: 'Navigate to pickup location',
                        color: 'teal'
                    });
                    navigateFromCurrent(lat, lng);
                }, 1500);
            }
        });

        return () => { unsubRequest(); unsubAssigned(); };
    }, [isConnected, on, joinTrip]);

    const loadActiveTrip = async () => {
        try {
            const res = await getAmbulanceActiveTrip();
            console.log('📍 Ambulance active trip loaded:', res);
            if (res.data) {
                setActiveTrip(res.data);
                // CRITICAL: Also set status to on-trip so UI shows trip details
                setStatus('on-trip');
                updateUser({ status: 'on-trip' });
                if (res.data._id) joinTrip(res.data._id);
            }
        } catch (err) {
            console.log('No active trip or error:', err);
        }
        finally { setLoading(false); }
    };

    const startLocationUpdates = () => {
        if (!navigator.geolocation) return () => { };

        // Send location immediately
        navigator.geolocation.getCurrentPosition(async (pos) => {
            try {
                await updateAmbulanceLocation([pos.coords.longitude, pos.coords.latitude]);
                // Also emit via socket for real-time updates to patient
                if (emit && activeTrip?._id) {
                    emit('location_update', {
                        tripId: activeTrip._id,
                        location: {
                            latitude: pos.coords.latitude,
                            longitude: pos.coords.longitude
                        }
                    });
                }
            } catch { }
        });

        // Then update every 10 seconds for more frequent updates
        const id = setInterval(() => {
            if (status === 'ready' || status === 'on-trip') {
                navigator.geolocation.getCurrentPosition(async (pos) => {
                    try {
                        await updateAmbulanceLocation([pos.coords.longitude, pos.coords.latitude]);
                        // Emit location to patient via socket
                        if (emit && activeTrip?._id) {
                            emit('location_update', {
                                tripId: activeTrip._id,
                                location: {
                                    latitude: pos.coords.latitude,
                                    longitude: pos.coords.longitude
                                }
                            });
                        }
                    } catch { }
                });
            }
        }, 10000);
        return () => clearInterval(id);
    };

    const handleStatusChange = async (newStatus) => {
        setUpdating(true);
        try {
            await updateAmbulanceStatus(newStatus);
            setStatus(newStatus);
            updateUser({ status: newStatus });
            notifications.show({ title: 'Status Updated', message: `Now ${newStatus}`, color: 'teal' });
        } catch (err) {
            notifications.show({ title: 'Error', message: err.response?.data?.message || 'Failed to update', color: 'red' });
        } finally { setUpdating(false); }
    };

    const handleAcceptTrip = async (tripId, pickupCoords) => {
        setUpdating(true);
        try {
            const res = await acceptTrip(tripId);
            if (res.status) {
                setActiveTrip(res.data);
                setPendingTrips(prev => prev.filter(t => t._id !== tripId));
                handleStatusChange('on-trip');
                joinTrip(tripId);
                notifications.show({ title: 'Trip Accepted!', message: 'Opening navigation...', color: 'teal' });

                // Open Google Maps with route to pickup
                if (pickupCoords || res.data?.pickup?.coordinates) {
                    const coords = pickupCoords || res.data.pickup.coordinates;
                    const [lng, lat] = coords;
                    setTimeout(() => navigateFromCurrent(lat, lng), 1000);
                }
            }
        } catch (err) {
            notifications.show({ title: 'Error', message: err.response?.data?.message || 'Failed to accept', color: 'red' });
        } finally { setUpdating(false); }
    };

    const handleUpdateTrip = async (newStatus) => {
        if (!activeTrip) return;
        setUpdating(true);

        try {
            const pos = await new Promise((res, rej) => {
                navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
            });

            const location = [pos.coords.longitude, pos.coords.latitude];
            const res = await updateTripStatus(activeTrip._id, newStatus, location);

            setActiveTrip(res.data);
            notifications.show({ title: 'Updated', message: statusLabels[newStatus] || newStatus, color: 'teal' });

            // If moving to hospital, open navigation to hospital
            if (newStatus === 'EN_ROUTE_HOSPITAL' && res.data?.dropoff?.coordinates) {
                const [lng, lat] = res.data.dropoff.coordinates;
                notifications.show({ title: '🗺️ Opening Navigation', message: 'Navigate to hospital', color: 'blue' });
                setTimeout(() => navigateFromCurrent(lat, lng), 1500);
            }

            if (newStatus === 'COMPLETED') {
                handleStatusChange('ready');
                setActiveTrip(null);
            }
        } catch (err) {
            notifications.show({ title: 'Error', message: err.code ? 'Enable GPS' : (err.response?.data?.message || 'Failed'), color: 'red' });
        } finally { setUpdating(false); }
    };

    // Helper to open navigation manually
    const openNavigationTo = (type) => {
        let coords = null;
        if (type === 'pickup' && activeTrip?.pickup?.coordinates) {
            coords = activeTrip.pickup.coordinates;
        } else if (type === 'hospital' && activeTrip?.dropoff?.coordinates) {
            coords = activeTrip.dropoff.coordinates;
        }

        if (coords) {
            const [lng, lat] = coords;
            navigateFromCurrent(lat, lng);
        } else {
            notifications.show({ title: 'Error', message: 'No coordinates available', color: 'red' });
        }
    };

    const handleLogout = async () => {
        await handleStatusChange('offline');
        await logout();
        navigate('/');
    };

    if (loading) {
        return (
            <Box style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loader size="xl" color="teal" />
            </Box>
        );
    }

    return (
        <Box style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
            {/* Header */}
            <Paper py="md" px="xl" style={{ background: 'rgba(255,255,255,0.95)', position: 'sticky', top: 0, zIndex: 100 }}>
                <Group justify="space-between">
                    <Group>
                        <ThemeIcon size={45} radius="xl" variant="gradient" gradient={{ from: 'teal', to: 'green' }}>
                            <span style={{ fontSize: '20px' }}>🚑</span>
                        </ThemeIcon>
                        <Box>
                            <Text fw={600} size="lg">{user?.driverName}</Text>
                            <Text size="sm" c="dimmed">{user?.vehicleNumber}</Text>
                        </Box>
                    </Group>
                    <Group>
                        <Badge color={isConnected ? 'teal' : 'red'} variant="dot" size="lg">
                            {isConnected ? 'Connected' : 'Disconnected'}
                        </Badge>
                        <Button variant="subtle" color="gray" onClick={handleLogout}>Logout</Button>
                    </Group>
                </Group>
            </Paper>

            <Container size="md" py="xl">
                <Stack gap="lg">
                    {/* Status Control */}
                    <Card radius="lg" padding="xl" className="glass">
                        <Title order={4} mb="md">Driver Status</Title>
                        <SegmentedControl
                            fullWidth
                            size="lg"
                            value={status}
                            onChange={handleStatusChange}
                            disabled={updating || status === 'on-trip'}
                            data={[
                                { label: '🔴 Offline', value: 'offline' },
                                { label: '🟢 Ready', value: 'ready' },
                                ...(status === 'on-trip' ? [{ label: '🟡 On Trip', value: 'on-trip' }] : [])
                            ]}
                            color={status === 'ready' ? 'teal' : status === 'on-trip' ? 'yellow' : 'gray'}
                        />
                    </Card>

                    {/* Active Trip */}
                    {activeTrip && (
                        <Card radius="lg" padding="xl" className="glass" style={{ border: '2px solid #10b981' }}>
                            <Group justify="space-between" mb="md">
                                <Group>
                                    <ThemeIcon size={40} radius="xl" color="red">
                                        <span>🚨</span>
                                    </ThemeIcon>
                                    <Title order={3}>Active Emergency</Title>
                                </Group>
                                <Badge size="lg" color="teal">{activeTrip.status.replace(/_/g, ' ')}</Badge>
                            </Group>

                            <Paper p="md" radius="md" bg="gray.0" mb="md">
                                <Stack gap="xs">
                                    <Group>
                                        <Text fw={700} size="lg">{activeTrip.patientSnapshot?.name}</Text>
                                        <Badge color="red" variant="light">🩸 {activeTrip.patientSnapshot?.bloodGroup}</Badge>
                                    </Group>
                                    <Text size="sm">📞 {activeTrip.patientSnapshot?.phone}</Text>
                                    <Divider my="xs" />
                                    <Text size="sm" c="dimmed">📍 Pickup: {activeTrip.pickup?.address}</Text>
                                    <Text size="sm" c="dimmed">🏥 Dropoff: {activeTrip.dropoff?.address}</Text>
                                </Stack>
                            </Paper>

                            {/* Navigation Buttons */}
                            <Group mb="md">
                                <Button
                                    flex={1}
                                    variant="gradient"
                                    gradient={{ from: 'blue', to: 'cyan' }}
                                    leftSection="🗺️"
                                    onClick={() => openNavigationTo('pickup')}
                                    disabled={!activeTrip.pickup?.coordinates}
                                >
                                    Navigate to Pickup
                                </Button>
                                <Button
                                    flex={1}
                                    variant="gradient"
                                    gradient={{ from: 'violet', to: 'grape' }}
                                    leftSection="🏥"
                                    onClick={() => openNavigationTo('hospital')}
                                    disabled={!activeTrip.dropoff?.coordinates}
                                >
                                    Navigate to Hospital
                                </Button>
                            </Group>

                            {statusFlow[activeTrip.status] && (
                                <Button
                                    fullWidth
                                    size="lg"
                                    variant="gradient"
                                    gradient={{ from: 'teal', to: 'green' }}
                                    onClick={() => handleUpdateTrip(statusFlow[activeTrip.status])}
                                    loading={updating}
                                >
                                    ✓ {statusLabels[statusFlow[activeTrip.status]]}
                                </Button>
                            )}
                        </Card>
                    )}

                    {/* Pending Requests */}
                    {status === 'ready' && !activeTrip && (
                        <Card radius="lg" padding="xl" className="glass">
                            <Title order={4} mb="md">📡 Incoming Requests</Title>
                            {pendingTrips.length === 0 ? (
                                <Box ta="center" py="xl">
                                    <Text size="xl" mb="xs">📡</Text>
                                    <Text c="dimmed">Waiting for trip requests...</Text>
                                </Box>
                            ) : (
                                <Stack gap="md">
                                    {pendingTrips.map((trip) => (
                                        <Paper key={trip._id} p="md" radius="md" bg="gray.0">
                                            <Group justify="space-between" mb="sm">
                                                <Box>
                                                    <Text fw={600}>{trip.patientSnapshot?.name}</Text>
                                                    <Badge color="red" variant="light" size="sm">🩸 {trip.patientSnapshot?.bloodGroup}</Badge>
                                                </Box>
                                            </Group>
                                            <Text size="sm" c="dimmed" mb="sm">{trip.pickup?.address}</Text>
                                            <Button
                                                fullWidth
                                                variant="gradient"
                                                gradient={{ from: 'teal', to: 'green' }}
                                                onClick={() => handleAcceptTrip(trip._id, trip.pickup?.coordinates)}
                                                loading={updating}
                                            >
                                                Accept & Navigate
                                            </Button>
                                        </Paper>
                                    ))}
                                </Stack>
                            )}
                        </Card>
                    )}
                </Stack>
            </Container>
        </Box>
    );
}

export default AmbulanceDashboard;
