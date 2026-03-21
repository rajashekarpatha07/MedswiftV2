import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../contexts/AuthContext';
import { updateHospitalInventory } from '../../api/hospital';
import DashboardShell, { DarkCard, SectionHeader, StatCard } from '../../components/DashboardShell';

const bloodTypes = [
    { key: 'A_positive', label: 'A+' }, { key: 'A_negative', label: 'A-' },
    { key: 'B_positive', label: 'B+' }, { key: 'B_negative', label: 'B-' },
    { key: 'O_positive', label: 'O+' }, { key: 'O_negative', label: 'O-' },
    { key: 'AB_positive', label: 'AB+' }, { key: 'AB_negative', label: 'AB-' },
];

export default function HospitalDashboard() {
    const navigate = useNavigate();
    const { user, logout, updateUser } = useAuth();

    const [inventory, setInventory] = useState(user?.inventory || {
        beds: { total: 0, available: 0 },
        bloodStock: { A_positive: 0, A_negative: 0, B_positive: 0, B_negative: 0, O_positive: 0, O_negative: 0, AB_positive: 0, AB_negative: 0 },
    });
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);

    const handleBedChange = (field, value) => setInventory({ ...inventory, beds: { ...inventory.beds, [field]: parseInt(value) || 0 } });
    const handleBloodChange = (type, value) => setInventory({ ...inventory, bloodStock: { ...inventory.bloodStock, [type]: parseInt(value) || 0 } });

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await updateHospitalInventory(inventory);
            if (res.status) { updateUser({ inventory: res.data.inventory }); notifications.show({ title: 'Saved!', message: 'Inventory updated', color: 'teal' }); setEditing(false); }
        } catch (err) { notifications.show({ title: 'Error', message: err.response?.data?.message || 'Failed to save', color: 'red' }); }
        finally { setSaving(false); }
    };

    const handleLogout = async () => { await logout(); navigate('/'); };
    const occupiedBeds = inventory.beds.total - inventory.beds.available;
    const occupancyPct = inventory.beds.total > 0 ? Math.round((occupiedBeds / inventory.beds.total) * 100) : 0;

    return (
        <DashboardShell
            icon="🏥" title={user?.name || 'Hospital'}
            subtitle={user?.address || 'Hospital Dashboard'}
            gradient="linear-gradient(135deg, #8b5cf6, #a855f7)"
            userName={user?.name}
            onLogout={handleLogout}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* ── BED AVAILABILITY ── */}
                <DarkCard>
                    <SectionHeader icon="🛏️" title="Bed Availability"
                        right={!editing && (
                            <button onClick={() => setEditing(true)} style={{
                                padding: '7px 16px', borderRadius: 10, border: '1px solid rgba(139,92,246,0.3)',
                                background: 'rgba(139,92,246,0.1)', color: '#a78bfa',
                                fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                            }}>Edit</button>
                        )}
                    />

                    {/* Occupancy bar */}
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Occupancy</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: occupancyPct > 80 ? '#f87171' : '#34d399' }}>{occupancyPct}%</span>
                        </div>
                        <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{
                                height: '100%', borderRadius: 99, transition: 'width 0.5s ease',
                                width: `${occupancyPct}%`,
                                background: occupancyPct > 80 ? 'linear-gradient(90deg, #ef4444, #f97316)' : 'linear-gradient(90deg, #10b981, #14b8a6)',
                            }} />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 20, textAlign: 'center' }}>
                            <p style={{ fontSize: 36, fontWeight: 800, color: 'white', lineHeight: 1 }}>{inventory.beds.total}</p>
                            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>Total Beds</p>
                            {editing && <input type="number" value={inventory.beds.total} onChange={e => handleBedChange('total', e.target.value)} min={0}
                                style={{ width: '100%', marginTop: 10, padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'white', fontSize: 14, outline: 'none', textAlign: 'center', fontFamily: 'inherit' }} />}
                        </div>
                        <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 14, padding: 20, textAlign: 'center' }}>
                            <p style={{ fontSize: 36, fontWeight: 800, color: '#34d399', lineHeight: 1 }}>{inventory.beds.available}</p>
                            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>Available</p>
                            {editing && <input type="number" value={inventory.beds.available} onChange={e => handleBedChange('available', e.target.value)} min={0} max={inventory.beds.total}
                                style={{ width: '100%', marginTop: 10, padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(16,185,129,0.2)', background: 'rgba(16,185,129,0.06)', color: '#34d399', fontSize: 14, outline: 'none', textAlign: 'center', fontFamily: 'inherit' }} />}
                        </div>
                        <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 14, padding: 20, textAlign: 'center' }}>
                            <p style={{ fontSize: 36, fontWeight: 800, color: '#f87171', lineHeight: 1 }}>{occupiedBeds}</p>
                            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>Occupied</p>
                        </div>
                    </div>
                </DarkCard>

                {/* ── BLOOD STOCK ── */}
                <DarkCard>
                    <SectionHeader icon="🩸" title="Blood Stock" />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
                        {bloodTypes.map(({ key, label }) => {
                            const count = inventory.bloodStock[key] || 0;
                            const isLow = count < 3;
                            return (
                                <div key={key} style={{
                                    background: isLow ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.03)',
                                    border: `1px solid ${isLow ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'}`,
                                    borderRadius: 12, padding: '16px 12px', textAlign: 'center',
                                }}>
                                    <span style={{
                                        display: 'inline-block', padding: '3px 10px', borderRadius: 999,
                                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                                        color: '#f87171', fontSize: 11, fontWeight: 700, marginBottom: 8,
                                    }}>{label}</span>
                                    {editing ? (
                                        <input type="number" value={count} onChange={e => handleBloodChange(key, e.target.value)} min={0}
                                            style={{ width: '100%', padding: '8px 6px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'white', fontSize: 16, fontWeight: 700, outline: 'none', textAlign: 'center', fontFamily: 'inherit' }} />
                                    ) : (
                                        <div>
                                            <p style={{ fontSize: 22, fontWeight: 800, color: isLow ? '#f87171' : 'white', lineHeight: 1 }}>{count}</p>
                                            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>units</p>
                                            {isLow && <p style={{ fontSize: 9, color: '#f87171', fontWeight: 700, marginTop: 4 }}>⚠ LOW</p>}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </DarkCard>

                {/* ── SAVE/CANCEL ── */}
                {editing && (
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={handleSave} disabled={saving} style={{
                            flex: 1, padding: '15px', borderRadius: 12, border: 'none',
                            background: 'linear-gradient(135deg, #8b5cf6, #a855f7)',
                            color: 'white', fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit',
                            boxShadow: '0 6px 24px rgba(139,92,246,0.3)',
                            opacity: saving ? 0.6 : 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        }}>
                            {saving && <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />}
                            Save Changes
                        </button>
                        <button onClick={() => { setEditing(false); setInventory(user?.inventory || inventory); }} style={{
                            padding: '15px 24px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)',
                            fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                        }}>Cancel</button>
                    </div>
                )}

                {/* ── CONTACT ── */}
                <DarkCard>
                    <SectionHeader icon="📞" title="Contact Info" />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div>
                            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Email</p>
                            <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{user?.email}</p>
                        </div>
                        <div>
                            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Phone</p>
                            <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{user?.phone}</p>
                        </div>
                    </div>
                </DarkCard>
            </div>
        </DashboardShell>
    );
}
