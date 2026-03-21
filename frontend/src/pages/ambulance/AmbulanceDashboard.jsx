import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { updateAmbulanceStatus, updateAmbulanceLocation } from '../../api/ambulance';
import { getAmbulanceActiveTrip, acceptTrip, updateTripStatus } from '../../api/trip';
import { navigateFromCurrent } from '../../components/LiveMap';
import DashboardShell, { DarkCard, SectionHeader, DashboardLoader } from '../../components/DashboardShell';

const statusFlow = { 'ACCEPTED': 'ARRIVED_PICKUP', 'ARRIVED_PICKUP': 'EN_ROUTE_HOSPITAL', 'EN_ROUTE_HOSPITAL': 'ARRIVED_HOSPITAL', 'ARRIVED_HOSPITAL': 'COMPLETED' };
const statusLabels = { 'ARRIVED_PICKUP': 'Arrived at Pickup', 'EN_ROUTE_HOSPITAL': 'En Route to Hospital', 'ARRIVED_HOSPITAL': 'Arrived at Hospital', 'COMPLETED': 'Complete Trip' };

const driverStatuses = [
    { value: 'offline', label: '🔴 Offline', color: '#6b7280' },
    { value: 'ready',   label: '🟢 Ready',   color: '#10b981' },
    { value: 'on-trip', label: '🟡 On Trip',  color: '#f59e0b' },
];

export default function AmbulanceDashboard() {
    const navigate = useNavigate();
    const { user, logout, updateUser } = useAuth();
    const { isConnected, connectionError, joinTrip, on, emit } = useSocket();

    const [status, setStatus] = useState(user?.status || 'offline');
    const [activeTrip, setActiveTrip] = useState(null);
    const [pendingTrips, setPendingTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    useEffect(() => { loadActiveTrip(); const cleanup = startLocationUpdates(); return cleanup; }, [status]);

    useEffect(() => {
        if (!isConnected) return;
        const unsubReq = on('new_trip_request', (trip) => { notifications.show({ title: 'New Request!', message: 'A patient needs help', color: 'blue' }); setPendingTrips(p => [...p, trip]); });
        const unsubAssign = on('new_trip_assigned', (data) => {
            notifications.show({ title: '🚨 Trip Assigned!', message: 'New emergency trip assigned to you', color: 'red' });
            setActiveTrip(data.trip); setStatus('on-trip'); if (data.tripId) joinTrip(data.tripId);
            if (data.trip?.pickup?.coordinates) { const [lng, lat] = data.trip.pickup.coordinates; setTimeout(() => { navigateFromCurrent(lat, lng); }, 1500); }
        });
        return () => { unsubReq(); unsubAssign(); };
    }, [isConnected, on, joinTrip]);

    const loadActiveTrip = async () => {
        try {
            const res = await getAmbulanceActiveTrip();
            if (res.data) { setActiveTrip(res.data); setStatus('on-trip'); updateUser({ status: 'on-trip' }); if (res.data._id) joinTrip(res.data._id); }
        } catch {} finally { setLoading(false); }
    };

    const startLocationUpdates = () => {
        if (!navigator.geolocation) return () => {};
        navigator.geolocation.getCurrentPosition(async (pos) => {
            try { await updateAmbulanceLocation([pos.coords.longitude, pos.coords.latitude]);
                if (emit && activeTrip?._id) emit('location_update', { tripId: activeTrip._id, location: { latitude: pos.coords.latitude, longitude: pos.coords.longitude } });
            } catch {}
        });
        const id = setInterval(() => {
            if (status === 'ready' || status === 'on-trip') {
                navigator.geolocation.getCurrentPosition(async (pos) => {
                    try { await updateAmbulanceLocation([pos.coords.longitude, pos.coords.latitude]);
                        if (emit && activeTrip?._id) emit('location_update', { tripId: activeTrip._id, location: { latitude: pos.coords.latitude, longitude: pos.coords.longitude } });
                    } catch {}
                });
            }
        }, 10000);
        return () => clearInterval(id);
    };

    const handleStatusChange = async (newStatus) => {
        setUpdating(true);
        try { await updateAmbulanceStatus(newStatus); setStatus(newStatus); updateUser({ status: newStatus }); notifications.show({ title: 'Status Updated', message: `Now ${newStatus}`, color: 'teal' });
        } catch (err) { notifications.show({ title: 'Error', message: err.response?.data?.message || 'Failed', color: 'red' }); } finally { setUpdating(false); }
    };

    const handleAcceptTrip = async (tripId, pickupCoords) => {
        setUpdating(true);
        try {
            const res = await acceptTrip(tripId);
            if (res.status) { setActiveTrip(res.data); setPendingTrips(p => p.filter(t => t._id !== tripId)); handleStatusChange('on-trip'); joinTrip(tripId);
                notifications.show({ title: 'Trip Accepted!', message: 'Opening navigation…', color: 'teal' });
                if (pickupCoords || res.data?.pickup?.coordinates) { const coords = pickupCoords || res.data.pickup.coordinates; const [lng, lat] = coords; setTimeout(() => navigateFromCurrent(lat, lng), 1000); }
            }
        } catch (err) { notifications.show({ title: 'Error', message: err.response?.data?.message || 'Failed', color: 'red' }); } finally { setUpdating(false); }
    };

    const handleUpdateTrip = async (newStatus) => {
        if (!activeTrip) return;
        setUpdating(true);
        try {
            const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }));
            const location = [pos.coords.longitude, pos.coords.latitude];
            const res = await updateTripStatus(activeTrip._id, newStatus, location);
            setActiveTrip(res.data); notifications.show({ title: 'Updated', message: statusLabels[newStatus] || newStatus, color: 'teal' });
            if (newStatus === 'EN_ROUTE_HOSPITAL' && res.data?.dropoff?.coordinates) { const [lng, lat] = res.data.dropoff.coordinates; setTimeout(() => navigateFromCurrent(lat, lng), 1500); }
            if (newStatus === 'COMPLETED') { handleStatusChange('ready'); setActiveTrip(null); }
        } catch (err) { notifications.show({ title: 'Error', message: err.code ? 'Enable GPS' : (err.response?.data?.message || 'Failed'), color: 'red' }); } finally { setUpdating(false); }
    };

    const openNavigationTo = (type) => {
        let coords = type === 'pickup' ? activeTrip?.pickup?.coordinates : activeTrip?.dropoff?.coordinates;
        if (coords) { const [lng, lat] = coords; navigateFromCurrent(lat, lng); }
        else notifications.show({ title: 'Error', message: 'No coordinates', color: 'red' });
    };

    const handleLogout = async () => { await handleStatusChange('offline'); await logout(); navigate('/'); };

    if (loading) return <DashboardLoader />;

    const currentStatusColor = driverStatuses.find(s => s.value === status)?.color || '#6b7280';

    return (
        <DashboardShell
            icon="🚑" title={user?.driverName || 'Ambulance'}
            subtitle={user?.vehicleNumber || 'Driver Dashboard'}
            gradient="linear-gradient(135deg, #10b981, #14b8a6)"
            userName={user?.driverName}
            isConnected={isConnected}
            onLogout={handleLogout}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* ── STATUS CONTROL ── */}
                <DarkCard>
                    <SectionHeader icon="📡" title="Driver Status"
                        badge={
                            <span style={{ padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: `${currentStatusColor}18`, border: `1px solid ${currentStatusColor}40`, color: currentStatusColor }}>
                                {status.toUpperCase()}
                            </span>
                        }
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                        {driverStatuses.filter(s => s.value !== 'on-trip' || status === 'on-trip').map(s => (
                            <button key={s.value} onClick={() => s.value !== 'on-trip' && handleStatusChange(s.value)}
                                disabled={updating || status === 'on-trip'}
                                style={{
                                    flex: 1, padding: '14px 12px', borderRadius: 12,
                                    border: `1px solid ${status === s.value ? s.color + '50' : 'rgba(255,255,255,0.08)'}`,
                                    background: status === s.value ? s.color + '15' : 'rgba(255,255,255,0.03)',
                                    color: status === s.value ? s.color : 'rgba(255,255,255,0.5)',
                                    fontWeight: 700, fontSize: 13, cursor: status === 'on-trip' ? 'not-allowed' : 'pointer',
                                    fontFamily: 'inherit', transition: 'all 0.2s',
                                    opacity: (updating || (status === 'on-trip' && s.value !== 'on-trip')) ? 0.4 : 1,
                                }}>
                                {s.label}
                            </button>
                        ))}
                    </div>
                </DarkCard>

                {/* ── ACTIVE TRIP ── */}
                {activeTrip && (
                    <DarkCard accentBorder="rgba(239,68,68,0.3)">
                        <SectionHeader icon="🚨" title="Active Emergency"
                            badge={<span style={{ padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }}>{activeTrip.status.replace(/_/g, ' ')}</span>}
                        />

                        {/* Patient details */}
                        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                                <span style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>{activeTrip.patientSnapshot?.name}</span>
                                <span style={{ padding: '3px 10px', borderRadius: 999, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: 11, fontWeight: 700 }}>🩸 {activeTrip.patientSnapshot?.bloodGroup}</span>
                            </div>
                            <p style={{ margin: '0 0 4px', fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>📞 {activeTrip.patientSnapshot?.phone}</p>
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 10, paddingTop: 10 }}>
                                <p style={{ margin: '0 0 4px', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>📍 Pickup: {activeTrip.pickup?.address}</p>
                                <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>🏥 Hospital: {activeTrip.dropoff?.address}</p>
                            </div>
                        </div>

                        {/* Navigation buttons */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                            <button onClick={() => openNavigationTo('pickup')} disabled={!activeTrip.pickup?.coordinates}
                                style={{ padding: '12px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', opacity: !activeTrip.pickup?.coordinates ? 0.4 : 1 }}>
                                🗺️ Navigate to Pickup
                            </button>
                            <button onClick={() => openNavigationTo('hospital')} disabled={!activeTrip.dropoff?.coordinates}
                                style={{ padding: '12px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #8b5cf6, #a855f7)', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', opacity: !activeTrip.dropoff?.coordinates ? 0.4 : 1 }}>
                                🏥 Navigate to Hospital
                            </button>
                        </div>

                        {/* Next status button */}
                        {statusFlow[activeTrip.status] && (
                            <button onClick={() => handleUpdateTrip(statusFlow[activeTrip.status])} disabled={updating}
                                style={{
                                    width: '100%', padding: '16px', borderRadius: 12, border: 'none',
                                    background: 'linear-gradient(135deg, #10b981, #14b8a6)',
                                    color: 'white', fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit',
                                    boxShadow: '0 6px 24px rgba(16,185,129,0.3)',
                                    opacity: updating ? 0.6 : 1,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                }}>
                                {updating && <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />}
                                ✓ {statusLabels[statusFlow[activeTrip.status]]}
                            </button>
                        )}
                    </DarkCard>
                )}

                {/* ── INCOMING REQUESTS ── */}
                {status === 'ready' && !activeTrip && (
                    <DarkCard>
                        <SectionHeader icon="📡" title="Incoming Requests"
                            badge={pendingTrips.length > 0 && <span style={{ padding: '3px 10px', borderRadius: 999, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', fontSize: 11, fontWeight: 700 }}>{pendingTrips.length}</span>}
                        />
                        {pendingTrips.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '48px 0' }}>
                                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(16,185,129,0.08)', border: '2px solid rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 16px', animation: 'breathe 3s ease-in-out infinite' }}>📡</div>
                                <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Waiting for trip requests…</p>
                                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>You'll be notified when a patient needs help nearby</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {pendingTrips.map(trip => (
                                    <div key={trip._id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <span style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>{trip.patientSnapshot?.name}</span>
                                            <span style={{ padding: '3px 10px', borderRadius: 999, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: 11, fontWeight: 700 }}>🩸 {trip.patientSnapshot?.bloodGroup}</span>
                                        </div>
                                        <p style={{ margin: '0 0 12px', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{trip.pickup?.address}</p>
                                        <button onClick={() => handleAcceptTrip(trip._id, trip.pickup?.coordinates)} disabled={updating}
                                            style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #10b981, #14b8a6)', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', opacity: updating ? 0.6 : 1 }}>
                                            Accept & Navigate
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </DarkCard>
                )}
            </div>
        </DashboardShell>
    );
}
