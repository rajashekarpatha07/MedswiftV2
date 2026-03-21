import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { createTrip, getActiveTrip, getTripHistory } from '../../api/trip';
import LiveMap from '../../components/LiveMap';
import DashboardShell, { DarkCard, SectionHeader, DashboardLoader } from '../../components/DashboardShell';

const statusConfig = {
    'SEARCHING':          { color: '#f59e0b', icon: '🔍', label: 'Searching' },
    'ACCEPTED':           { color: '#6366f1', icon: '✅', label: 'Accepted' },
    'ARRIVED_PICKUP':     { color: '#8b5cf6', icon: '📍', label: 'At Pickup' },
    'EN_ROUTE_HOSPITAL':  { color: '#10b981', icon: '🚑', label: 'En Route' },
    'ARRIVED_HOSPITAL':   { color: '#14b8a6', icon: '🏥', label: 'At Hospital' },
    'COMPLETED':          { color: '#10b981', icon: '✅', label: 'Completed' },
    'CANCELLED':          { color: '#ef4444', icon: '✕', label: 'Cancelled' },
};

export default function UserDashboard() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { isConnected, on, joinTrip } = useSocket();

    const [activeTrip, setActiveTrip] = useState(null);
    const [tripHistory, setTripHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [requesting, setRequesting] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ pickupAddress: '', requireBeds: false });
    const [ambulanceLocation, setAmbulanceLocation] = useState(null);

    useEffect(() => { loadData(); }, []);

    useEffect(() => {
        if (!isConnected || !activeTrip) return;
        if (activeTrip._id) joinTrip(activeTrip._id);

        const unsubLoc = on('location_updated', (data) => {
            if (data.location?.latitude && data.location?.longitude)
                setAmbulanceLocation([data.location.longitude, data.location.latitude]);
        });
        const unsubStatus = on('trip_status_update', (data) => { if (data.trip) setActiveTrip(data.trip); });
        return () => { unsubLoc(); unsubStatus(); };
    }, [isConnected, activeTrip?._id, on, joinTrip]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [active, history] = await Promise.all([
                getActiveTrip().catch(() => null),
                getTripHistory(5).catch(() => ({ data: { trips: [] } })),
            ]);
            if (active?.data) {
                setActiveTrip(active.data);
                if (active.data.ambulanceId?.location?.coordinates)
                    setAmbulanceLocation(active.data.ambulanceId.location.coordinates);
            }
            setTripHistory(history?.data?.trips || []);
        } finally { setLoading(false); }
    };

    const handleRequest = async () => {
        if (!navigator.geolocation) { notifications.show({ title: 'Error', message: 'Geolocation not supported', color: 'red' }); return; }
        setRequesting(true);
        notifications.show({ title: 'Locating…', message: '📍 Getting GPS coordinates', color: 'blue', loading: true, id: 'request' });
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                try {
                    notifications.update({ id: 'request', title: 'Searching…', message: '🔍 Finding nearest ambulance', loading: true });
                    const res = await createTrip({
                        pickupAddress: formData.pickupAddress || 'Current Location',
                        pickupCoordinates: [pos.coords.longitude, pos.coords.latitude],
                        bloodType: user.bloodGroup,
                        requireBeds: formData.requireBeds,
                    });
                    if (res.status) {
                        setActiveTrip(res.data);
                        setShowForm(false);
                        notifications.update({ id: 'request', title: '🚑 Ambulance dispatched!', message: 'Help is on the way', color: 'teal', loading: false });
                    }
                } catch (err) {
                    notifications.update({ id: 'request', title: 'Failed', message: err.response?.data?.message || 'Request failed', color: 'red', loading: false });
                } finally { setRequesting(false); }
            },
            () => { notifications.update({ id: 'request', title: 'Error', message: 'Could not get location', color: 'red', loading: false }); setRequesting(false); },
            { enableHighAccuracy: true, timeout: 15000 }
        );
    };

    const handleLogout = async () => { await logout(); notifications.show({ title: 'Logged out', message: 'See you soon!', color: 'gray' }); navigate('/'); };
    const getStatus = (s) => statusConfig[s] || { color: '#6b7280', label: s, icon: '' };
    const getPickupCoords = () => activeTrip?.pickup?.coordinates || null;
    const getHospitalCoords = () => activeTrip?.dropoff?.coordinates || activeTrip?.hospitalId?.location?.coordinates || null;

    if (loading) return <DashboardLoader />;

    return (
        <DashboardShell
            icon="👤" title="Patient Dashboard"
            subtitle={`Blood Group: ${user?.bloodGroup || '—'}`}
            gradient="linear-gradient(135deg, #667eea, #764ba2)"
            userName={user?.name}
            userMeta={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: 11, fontWeight: 700 }}>
                    🩸 {user?.bloodGroup}
                </span>
            }
            isConnected={isConnected}
            onLogout={handleLogout}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* ── ACTIVE TRIP ── */}
                {activeTrip && (
                    <DarkCard accentBorder="rgba(16,185,129,0.3)">
                        <SectionHeader icon="🚑" title="Active Trip"
                            badge={
                                <span style={{
                                    padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                                    background: `${getStatus(activeTrip.status).color}18`,
                                    border: `1px solid ${getStatus(activeTrip.status).color}40`,
                                    color: getStatus(activeTrip.status).color,
                                }}>
                                    {getStatus(activeTrip.status).icon} {getStatus(activeTrip.status).label}
                                </span>
                            }
                        />

                        {/* Map */}
                        {(ambulanceLocation || getPickupCoords() || getHospitalCoords()) && (
                            <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 20 }}>
                                <LiveMap
                                    ambulanceLocation={ambulanceLocation}
                                    pickupLocation={getPickupCoords()}
                                    hospitalLocation={getHospitalCoords()}
                                    height="260px"
                                    showAmbulance={!!ambulanceLocation}
                                    showPickup={activeTrip.status !== 'COMPLETED'}
                                    showHospital={activeTrip.status === 'EN_ROUTE_HOSPITAL' || activeTrip.status === 'ARRIVED_HOSPITAL'}
                                />
                            </div>
                        )}

                        {/* Trip details */}
                        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: 13 }}>
                                <span style={{ color: 'rgba(255,255,255,0.35)' }}>Pickup</span>
                                <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{activeTrip.pickup?.address || 'Current Location'}</span>

                                {activeTrip.ambulanceId && <>
                                    <span style={{ color: 'rgba(255,255,255,0.35)' }}>Ambulance</span>
                                    <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
                                        {typeof activeTrip.ambulanceId === 'object'
                                            ? `${activeTrip.ambulanceId.vehicleNumber} • ${activeTrip.ambulanceId.driverName}`
                                            : 'Assigned'}
                                    </span>
                                </>}

                                {activeTrip.dropoff?.address && <>
                                    <span style={{ color: 'rgba(255,255,255,0.35)' }}>Hospital</span>
                                    <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{activeTrip.dropoff.address}</span>
                                </>}
                            </div>
                        </div>

                        {/* Timeline */}
                        {activeTrip.timeline?.length > 0 && (
                            <div>
                                <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Timeline</p>
                                <div style={{ borderLeft: '2px solid rgba(255,255,255,0.08)', paddingLeft: 16 }}>
                                    {activeTrip.timeline.map((e, i) => (
                                        <div key={i} style={{ position: 'relative', paddingBottom: 16, paddingLeft: 8 }}>
                                            <div style={{
                                                position: 'absolute', left: -23, top: 2,
                                                width: 10, height: 10, borderRadius: '50%',
                                                background: i === activeTrip.timeline.length - 1 ? '#10b981' : 'rgba(255,255,255,0.15)',
                                                border: i === activeTrip.timeline.length - 1 ? '2px solid rgba(16,185,129,0.3)' : 'none',
                                            }} />
                                            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                                                {e.status.replace(/_/g, ' ')}
                                            </p>
                                            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                                                {new Date(e.timestamp).toLocaleTimeString()}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </DarkCard>
                )}

                {/* ── EMERGENCY REQUEST ── */}
                {!activeTrip && (
                    <DarkCard>
                        <SectionHeader icon="🚨" title="Emergency Request" />

                        {!showForm ? (
                            <button onClick={() => setShowForm(true)} style={{
                                width: '100%', padding: '22px 20px', borderRadius: 14, border: 'none',
                                background: 'linear-gradient(135deg, #ef4444, #ec4899)',
                                color: 'white', fontWeight: 800, fontSize: 18, cursor: 'pointer',
                                fontFamily: 'inherit',
                                boxShadow: '0 8px 32px rgba(239,68,68,0.3)',
                                transition: 'all 0.2s',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                            }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(239,68,68,0.4)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(239,68,68,0.3)'; }}
                            >
                                🚨 Request Ambulance Now
                            </button>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Pickup Address (optional)</label>
                                    <input
                                        placeholder="Leave blank for current GPS location"
                                        value={formData.pickupAddress}
                                        onChange={e => setFormData({ ...formData, pickupAddress: e.target.value })}
                                        style={{
                                            width: '100%', padding: '12px 14px', fontSize: 14,
                                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: 10, color: 'white', outline: 'none', fontFamily: 'inherit',
                                        }}
                                    />
                                </div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={formData.requireBeds} onChange={e => setFormData({ ...formData, requireBeds: e.target.checked })}
                                        style={{ width: 16, height: 16, accentColor: '#8b5cf6' }} />
                                    Require hospital bed
                                </label>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button onClick={handleRequest} disabled={requesting} style={{
                                        flex: 1, padding: '14px 20px', borderRadius: 12, border: 'none',
                                        background: 'linear-gradient(135deg, #ef4444, #ec4899)',
                                        color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
                                        opacity: requesting ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    }}>
                                        {requesting && <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />}
                                        🚑 Send Emergency Request
                                    </button>
                                    <button onClick={() => setShowForm(false)} disabled={requesting} style={{
                                        padding: '14px 20px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)',
                                        background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)',
                                        fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                                    }}>Cancel</button>
                                </div>
                            </div>
                        )}
                    </DarkCard>
                )}

                {/* ── TRIP HISTORY ── */}
                <DarkCard>
                    <SectionHeader icon="📋" title="Trip History" />
                    {tripHistory.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                            <p style={{ fontSize: 32, marginBottom: 8 }}>📋</p>
                            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)' }}>No previous trips</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {tripHistory.map(trip => (
                                <div key={trip._id} style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '14px 16px', borderRadius: 12,
                                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                                }}>
                                    <div>
                                        <span style={{
                                            display: 'inline-block', padding: '2px 10px', borderRadius: 999,
                                            background: `${getStatus(trip.status).color}18`,
                                            border: `1px solid ${getStatus(trip.status).color}35`,
                                            color: getStatus(trip.status).color,
                                            fontSize: 10, fontWeight: 700, marginBottom: 4,
                                        }}>{trip.status.replace(/_/g, ' ')}</span>
                                        <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{trip.pickup?.address || 'No address'}</p>
                                    </div>
                                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{new Date(trip.createdAt).toLocaleDateString()}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </DarkCard>
            </div>
        </DashboardShell>
    );
}
