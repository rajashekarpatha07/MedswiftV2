import { Link } from 'react-router-dom';

/**
 * DashboardShell — premium dark-mode layout for all dashboards.
 *
 * Props:
 * - icon: emoji
 * - title: e.g. "Patient Dashboard"
 * - subtitle: role detail
 * - gradient: CSS gradient for the header accent
 * - userName: user display name
 * - userMeta: extra badge/text next to user name
 * - isConnected: socket connection status (optional)
 * - onLogout: logout handler
 * - children: dashboard content
 */
export default function DashboardShell({ icon, title, subtitle, gradient, userName, userMeta, isConnected, onLogout, children }) {
    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(180deg, #070a15 0%, #0d1225 100%)',
            fontFamily: "'Inter', -apple-system, sans-serif",
            color: 'white',
        }}>
            {/* ── Top nav bar ── */}
            <header style={{
                position: 'sticky', top: 0, zIndex: 100,
                background: 'rgba(7,10,21,0.85)',
                backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                padding: '12px 24px',
            }}>
                {/* Gradient accent */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: gradient }} />

                <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        {/* Home link */}
                        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 18 }}>🚑</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.35)' }}>MedSwift</span>
                        </Link>
                        <span style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.08)' }} />
                        <div style={{
                            width: 40, height: 40, borderRadius: '50%', background: gradient,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                            flexShrink: 0,
                        }}>{icon}</div>
                        <div>
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'white' }}>{userName || title}</p>
                            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{subtitle}</p>
                        </div>
                        {userMeta && <div>{userMeta}</div>}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {isConnected !== undefined && (
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                padding: '5px 12px', borderRadius: 999,
                                background: isConnected ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                border: `1px solid ${isConnected ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                                fontSize: 11, fontWeight: 600,
                                color: isConnected ? '#34d399' : '#f87171',
                            }}>
                                <span style={{
                                    width: 6, height: 6, borderRadius: '50%',
                                    background: isConnected ? '#34d399' : '#f87171',
                                    ...(isConnected ? { animation: 'breathe 2s ease-in-out infinite' } : {}),
                                }} />
                                {isConnected ? 'Live' : 'Offline'}
                            </span>
                        )}
                        <button onClick={onLogout} style={{
                            padding: '7px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.5)',
                            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                            transition: 'all 0.2s',
                        }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* ── Main content ── */}
            <main style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 60px' }}>
                {children}
            </main>
        </div>
    );
}

/* ── Reusable dark card component ── */
export function DarkCard({ children, style, accentBorder, className = '' }) {
    return (
        <div className={className} style={{
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${accentBorder || 'rgba(255,255,255,0.08)'}`,
            borderRadius: 16, padding: 24,
            ...style,
        }}>
            {children}
        </div>
    );
}

/* ── Section header ── */
export function SectionHeader({ icon, title, badge, right }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {icon && <span style={{ fontSize: 20 }}>{icon}</span>}
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'white' }}>{title}</h3>
                {badge}
            </div>
            {right}
        </div>
    );
}

/* ── Stat card ── */
export function StatCard({ icon, value, label, accent = '#10b981' }) {
    return (
        <div style={{
            background: `${accent}10`, border: `1px solid ${accent}30`,
            borderRadius: 14, padding: '20px 16px', textAlign: 'center',
        }}>
            <p style={{ fontSize: 20, marginBottom: 4 }}>{icon}</p>
            <p style={{ fontSize: 28, fontWeight: 800, color: 'white', lineHeight: 1.1 }}>{value}</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{label}</p>
        </div>
    );
}

/* ── Loader screen ── */
export function DashboardLoader({ gradient }) {
    return (
        <div style={{
            minHeight: '100vh', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(180deg, #070a15 0%, #0d1225 100%)',
            gap: 16,
        }}>
            <div style={{
                width: 48, height: 48, border: '3px solid rgba(255,255,255,0.1)',
                borderTopColor: '#10b981', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
            }} />
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', fontFamily: "'Inter', sans-serif" }}>Loading dashboard…</p>
        </div>
    );
}
