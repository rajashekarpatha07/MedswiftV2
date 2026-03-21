import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../contexts/AuthContext';
import { getAmbulanceStats } from '../../api/ambulance';
import DashboardShell, { DarkCard, SectionHeader, StatCard, DashboardLoader } from '../../components/DashboardShell';

export default function AdminDashboard() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [stats, setStats] = useState({ activeAmbulances: 0, ambulanceIds: [] });
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);

    useEffect(() => {
        loadStats();
        const interval = setInterval(loadStats, 30000);
        return () => clearInterval(interval);
    }, []);

    const loadStats = async () => {
        try {
            const res = await getAmbulanceStats();
            if (res.status) { setStats(res.data); setLastUpdated(new Date()); }
        } catch { notifications.show({ title: 'Error', message: 'Failed to load stats', color: 'red' }); }
        finally { setLoading(false); }
    };

    const handleLogout = async () => { await logout(); navigate('/'); };

    if (loading) return <DashboardLoader />;

    const ringPct = Math.min((stats.activeAmbulances / 10) * 100, 100);

    return (
        <DashboardShell
            icon="⚙️" title="System Admin"
            subtitle={user?.name || 'Administrator'}
            gradient="linear-gradient(135deg, #f43f5e, #ef4444)"
            userName={user?.name}
            onLogout={handleLogout}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* ── STATS OVERVIEW ── */}
                <DarkCard>
                    <SectionHeader icon="📊" title="System Statistics"
                        right={lastUpdated && (
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                                Updated {lastUpdated.toLocaleTimeString()} • refreshes every 30s
                            </span>
                        )}
                    />

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
                        <StatCard icon="🚑" value={stats.activeAmbulances} label="Active Ambulances" accent="#10b981" />
                        <StatCard icon="📡" value={stats.ambulanceIds.length} label="Connected Units" accent="#6366f1" />
                        <StatCard icon="⚡" value="< 1s" label="Dispatch Latency" accent="#f59e0b" />
                        <StatCard icon="🛡️" value="Healthy" label="System Status" accent="#14b8a6" />
                    </div>

                    {/* Capacity ring */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
                        <div style={{ position: 'relative', width: 120, height: 120 }}>
                            <svg width="120" height="120" viewBox="0 0 120 120">
                                <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
                                <circle cx="60" cy="60" r="50" fill="none" stroke="#10b981" strokeWidth="10"
                                    strokeLinecap="round" strokeDasharray={`${ringPct * 3.14} ${(100 - ringPct) * 3.14}`}
                                    transform="rotate(-90 60 60)"
                                    style={{ transition: 'stroke-dasharray 0.8s ease' }} />
                            </svg>
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: 28, fontWeight: 800, color: '#10b981' }}>{stats.activeAmbulances}</span>
                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>active</span>
                            </div>
                        </div>
                        <div>
                            <p style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>Fleet Utilisation</p>
                            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>
                                {stats.activeAmbulances} out of 10 ambulances<br />currently active on the platform
                            </p>
                        </div>
                    </div>
                </DarkCard>

                {/* ── ACTIVE AMBULANCE IDS ── */}
                <DarkCard>
                    <SectionHeader icon="🚑" title="Active Ambulance IDs"
                        badge={
                            <span style={{ padding: '3px 10px', borderRadius: 999, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399', fontSize: 11, fontWeight: 700 }}>
                                {stats.ambulanceIds.length}
                            </span>
                        }
                    />

                    {stats.ambulanceIds.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                            <p style={{ fontSize: 32, marginBottom: 8 }}>🚑</p>
                            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)' }}>No active ambulances</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {stats.ambulanceIds.map(id => (
                                <div key={id} style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '12px 14px', borderRadius: 10,
                                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                                }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981', animation: 'breathe 2s ease-in-out infinite' }} />
                                    <code style={{ fontSize: 13, color: '#34d399', fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>{id}</code>
                                </div>
                            ))}
                        </div>
                    )}
                </DarkCard>

                {/* ── ADMIN PROFILE ── */}
                <DarkCard>
                    <SectionHeader icon="👤" title="Admin Profile" />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div>
                            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Name</p>
                            <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{user?.name}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Email</p>
                            <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{user?.email}</p>
                        </div>
                    </div>
                </DarkCard>
            </div>
        </DashboardShell>
    );
}
