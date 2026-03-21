import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import SimulationDemo from '../components/SimulationDemo';

const ROLES = [
    { to: '/user/login', icon: '👤', title: 'Patient', desc: 'Request emergency ambulance instantly', gradient: 'linear-gradient(135deg, #667eea, #764ba2)', glow: 'rgba(102,126,234,0.3)' },
    { to: '/ambulance/login', icon: '🚑', title: 'Ambulance Driver', desc: 'Accept and manage trips in real-time', gradient: 'linear-gradient(135deg, #10b981, #14b8a6)', glow: 'rgba(16,185,129,0.3)' },
    { to: '/hospital/login', icon: '🏥', title: 'Hospital', desc: 'Manage inventory, beds & blood stock', gradient: 'linear-gradient(135deg, #8b5cf6, #ec4899)', glow: 'rgba(139,92,246,0.3)' },
    { to: '/admin/login', icon: '⚙️', title: 'System Admin', desc: 'Monitor & control system operations', gradient: 'linear-gradient(135deg, #f43f5e, #ec4899)', glow: 'rgba(244,63,94,0.3)' },
];

const FEATURES = [
    { icon: '⚡', title: 'Sub-second Dispatch', desc: 'Redis geo indexes locate nearest ambulance in milliseconds across 5–30 km radius failover zones.' },
    { icon: '📍', title: 'Live GPS Tracking', desc: 'Socket.IO streams ambulance and patient coordinates to all trip participants in real time.' },
    { icon: '🏥', title: 'Smart Hospital Matching', desc: 'Matches hospitals by bed count, blood-type stock and geospatial proximity — automatically.' },
    { icon: '🔒', title: 'Secure Auth', desc: 'JWT access/refresh tokens, argon2 hashing, HTTP-only cookies and role-based access control.' },
    { icon: '🔔', title: 'Instant Notifications', desc: 'Socket.IO pushes assignment alerts, status updates, SOS signals, and cancellations live.' },
    { icon: '🔄', title: 'Automatic Failover', desc: 'No ambulance found at 5 km? Auto-expands to 10, 17, then 30 km without any user action.' },
];

const HOW_IT_WORKS = [
    { step: '01', icon: '🆘', title: 'Patient Requests', desc: 'One tap sends GPS location to the dispatch engine. No phone calls needed.' },
    { step: '02', icon: '🔍', title: 'AI Auto-Dispatch', desc: 'Redis geo search finds the nearest available ambulance in milliseconds.' },
    { step: '03', icon: '🚑', title: 'Ambulance Responds', desc: 'Driver gets instant assignment with navigation. Patient tracks arrival live.' },
    { step: '04', icon: '🏥', title: 'Hospital Ready', desc: 'Nearest hospital with matching blood type and beds is auto-selected.' },
];

function EkgLine() {
    return (
        <svg className="absolute w-full top-1/2 left-0 opacity-10 pointer-events-none" height="60" viewBox="0 0 1000 60" preserveAspectRatio="none">
            <polyline
                points="0,30 100,30 130,5 155,55 175,15 195,45 215,30 400,30 430,5 455,55 475,15 495,45 515,30 700,30 730,5 755,55 775,15 795,45 815,30 1000,30"
                fill="none" stroke="#ef4444" strokeWidth="2.5"
                className="ekg-line"
            />
        </svg>
    );
}

export default function LandingPage() {
    const [activeAmbulances, setActiveAmbulances] = useState(null);
    const [statsLoaded, setStatsLoaded] = useState(false);
    const simRef = useRef(null);

    useEffect(() => {
        fetch('/api/v2/ambulance/stats')
            .then(r => r.json())
            .then(d => { if (d?.data?.activeAmbulances !== undefined) setActiveAmbulances(d.data.activeAmbulances); })
            .catch(() => setActiveAmbulances('—'))
            .finally(() => setStatsLoaded(true));
    }, []);

    const scrollToSim = () => simRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    return (
        <div className="min-h-screen bg-[#070d1a] text-white" style={{ fontFamily: "'Inter', sans-serif" }}>

            {/* ── HERO ── */}
            <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 40%, #091428 100%)' }}>

                {/* BG blobs */}
                <div className="absolute top-1/4 left-[5%] w-72 h-72 rounded-full opacity-20 pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.4), transparent 70%)', filter: 'blur(60px)' }} />
                <div className="absolute bottom-[10%] right-[5%] w-96 h-96 rounded-full opacity-20 pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.4), transparent 70%)', filter: 'blur(70px)' }} />

                <EkgLine />

                {/* Content */}
                <div className="relative z-10 max-w-3xl mx-auto">
                    {/* Live badge */}
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                        padding: '6px 16px', borderRadius: '999px',
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                        fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.7)',
                        backdropFilter: 'blur(12px)', marginBottom: '24px',
                    }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', animation: 'breathe 2s ease-in-out infinite' }} />
                        Platform Live — Real-time Emergency Dispatch
                    </div>

                    <div style={{ fontSize: '72px', marginBottom: '16px' }} className="animate-breathe">🚑</div>

                    <h1 style={{ fontSize: 'clamp(48px, 9vw, 88px)', fontWeight: 900, letterSpacing: '-3px', lineHeight: 0.95, marginBottom: '20px' }}>
                        Med<span style={{
                            background: 'linear-gradient(90deg, #ef4444, #ec4899)',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        }}>Swift</span>
                    </h1>

                    <p style={{ fontSize: 'clamp(16px, 2.5vw, 20px)', color: 'rgba(255,255,255,0.55)', maxWidth: '480px', margin: '0 auto 12px', lineHeight: 1.6 }}>
                        Real-Time Emergency Dispatch &amp; Medical Coordination
                    </p>
                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', maxWidth: '360px', margin: '0 auto 40px' }}>
                        "In cardiac arrest, brain damage begins after 4 minutes. Every second counts."
                    </p>

                    {/* CTAs */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', marginBottom: '40px' }}>
                        <button onClick={scrollToSim} style={{
                            padding: '14px 32px', borderRadius: '999px', border: 'none', cursor: 'pointer',
                            background: 'linear-gradient(90deg, #ef4444, #ec4899)', color: 'white',
                            fontWeight: 800, fontSize: '15px', fontFamily: 'inherit',
                            boxShadow: '0 8px 32px rgba(239,68,68,0.4)',
                            transition: 'all 0.2s',
                        }}>
                            ▶ Watch Live Demo
                        </button>
                        <Link to="/user/login" style={{
                            padding: '14px 32px', borderRadius: '999px', textDecoration: 'none',
                            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                            color: 'white', fontWeight: 600, fontSize: '15px',
                            transition: 'all 0.2s',
                        }}>
                            Request Ambulance →
                        </Link>
                    </div>

                    {/* Stats strip */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
                        {[
                            `🚑 ${statsLoaded ? activeAmbulances : '...'} Active`,
                            '⚡ Sub-second Dispatch',
                            '🌐 Redis Geo + Socket.IO',
                            '🔒 JWT Secured',
                        ].map(label => (
                            <span key={label} style={{
                                padding: '6px 14px', borderRadius: '999px',
                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                                color: 'rgba(255,255,255,0.65)', fontSize: '11px', fontWeight: 500,
                            }}>
                                {label}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Scroll hint */}
                <div className="absolute bottom-8 left-1/2 animate-float" style={{
                    transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: '4px', opacity: 0.3,
                }}>
                    <span style={{ fontSize: '10px', letterSpacing: '3px', color: 'rgba(255,255,255,0.5)' }}>SCROLL</span>
                    <span style={{ fontSize: '16px', color: 'rgba(255,255,255,0.5)' }}>↓</span>
                </div>
            </section>

            {/* ── HOW IT WORKS ── */}
            <section style={{ background: 'linear-gradient(180deg, #070d1a, #0d1422)', padding: '80px 16px' }}>
                <div style={{ maxWidth: '960px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '56px' }}>
                        <span style={{
                            display: 'inline-block', padding: '4px 14px', borderRadius: '999px',
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                            color: '#f87171', fontSize: '11px', fontWeight: 700, marginBottom: '12px',
                        }}>How It Works</span>
                        <h2 style={{ fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 800, letterSpacing: '-1px', color: 'white' }}>
                            From SOS to Hospital in Minutes
                        </h2>
                        <p style={{ color: 'rgba(255,255,255,0.35)', marginTop: '12px', fontSize: '14px' }}>
                            Automated pipeline — no manual calls, no delays
                        </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
                        {HOW_IT_WORKS.map((item, i) => (
                            <div key={i} style={{ textAlign: 'center', padding: '24px 16px' }}>
                                <div style={{
                                    width: 64, height: 64, borderRadius: '50%',
                                    background: 'rgba(239,68,68,0.1)', border: '2px solid rgba(239,68,68,0.2)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '28px', margin: '0 auto 16px',
                                }}>{item.icon}</div>
                                <p style={{ fontSize: '11px', fontWeight: 700, color: '#f87171', letterSpacing: '2px', marginBottom: '6px' }}>{item.step}</p>
                                <p style={{ fontWeight: 700, color: 'white', fontSize: '14px', marginBottom: '8px' }}>{item.title}</p>
                                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', lineHeight: 1.6 }}>{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── SIMULATION DEMO ── */}
            <section ref={simRef} style={{ background: 'linear-gradient(180deg, #0d1422, #111827)', padding: '80px 16px' }}>
                <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                        <span style={{
                            display: 'inline-block', padding: '4px 14px', borderRadius: '999px',
                            background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                            color: '#34d399', fontSize: '11px', fontWeight: 700, marginBottom: '12px',
                        }}>Interactive Simulation</span>
                        <h2 style={{ fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 800, letterSpacing: '-1px', color: 'white' }}>
                            Watch a Real Emergency Trip Unfold
                        </h2>
                        <p style={{ color: 'rgba(255,255,255,0.35)', marginTop: '12px', maxWidth: '440px', margin: '12px auto 0', fontSize: '14px' }}>
                            This interactive demo shows exactly what happens when a patient requests an ambulance on MedSwift
                        </p>
                    </div>

                    <div style={{
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '20px', padding: '24px',
                    }}>
                        <SimulationDemo />
                    </div>
                </div>
            </section>

            {/* ── FEATURES ── */}
            <section style={{ background: '#0a0f1e', padding: '80px 16px' }}>
                <div style={{ maxWidth: '960px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '56px' }}>
                        <span style={{
                            display: 'inline-block', padding: '4px 14px', borderRadius: '999px',
                            background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                            color: '#a5b4fc', fontSize: '11px', fontWeight: 700, marginBottom: '12px',
                        }}>Platform Capabilities</span>
                        <h2 style={{ fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 800, letterSpacing: '-1px', color: 'white' }}>
                            Built for the Golden Hour
                        </h2>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                        {FEATURES.map((f, i) => (
                            <div key={i} style={{
                                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: '16px', padding: '24px', transition: 'all 0.3s',
                                cursor: 'default',
                            }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(-4px)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                            >
                                <p style={{ fontSize: '28px', marginBottom: '12px' }}>{f.icon}</p>
                                <p style={{ fontWeight: 700, color: 'white', fontSize: '14px', marginBottom: '8px' }}>{f.title}</p>
                                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', lineHeight: 1.6 }}>{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── ROLE PORTALS ── */}
            <section style={{ background: 'linear-gradient(180deg, #0a0f1e, #0d1422)', padding: '80px 16px' }}>
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '56px' }}>
                        <span style={{
                            display: 'inline-block', padding: '4px 14px', borderRadius: '999px',
                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                            color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: 700, marginBottom: '12px',
                        }}>Access Portal</span>
                        <h2 style={{ fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 800, letterSpacing: '-1px', color: 'white' }}>
                            Select Your Role
                        </h2>
                        <p style={{ color: 'rgba(255,255,255,0.35)', marginTop: '12px', fontSize: '14px' }}>
                            Each role has a dedicated dashboard built for your workflow
                        </p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                        {ROLES.map(role => (
                            <Link key={role.to} to={role.to} style={{ textDecoration: 'none' }}>
                                <div style={{
                                    position: 'relative', overflow: 'hidden',
                                    border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px',
                                    padding: '28px', background: 'rgba(255,255,255,0.03)',
                                    textAlign: 'center', transition: 'all 0.3s', cursor: 'pointer',
                                }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                                        e.currentTarget.style.transform = 'translateY(-6px)';
                                        e.currentTarget.style.boxShadow = `0 16px 48px ${role.glow}`;
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                >
                                    {/* Top gradient bar */}
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: role.gradient }} />

                                    <div style={{
                                        width: 60, height: 60, borderRadius: '50%', background: role.gradient,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '28px', margin: '0 auto 16px',
                                        boxShadow: `0 4px 16px ${role.glow}`,
                                    }}>{role.icon}</div>
                                    <p style={{ fontWeight: 700, color: 'white', fontSize: '16px', marginBottom: '8px' }}>{role.title}</p>
                                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '16px', lineHeight: 1.5 }}>{role.desc}</p>
                                    <span style={{
                                        display: 'inline-block', padding: '8px 20px', borderRadius: '999px',
                                        background: role.gradient, color: 'white', fontSize: '12px', fontWeight: 700,
                                    }}>
                                        Enter Portal →
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── FOOTER ── */}
            <footer style={{
                background: '#060b14', borderTop: '1px solid rgba(255,255,255,0.05)',
                padding: '32px 16px',
            }}>
                <div style={{
                    maxWidth: '960px', margin: '0 auto',
                    display: 'flex', flexWrap: 'wrap', alignItems: 'center',
                    justifyContent: 'space-between', gap: '16px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>🚑</span>
                        <span style={{ fontWeight: 700, color: 'white' }}>MedSwift</span>
                        <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '13px' }}>— Rapid Response, Better Outcomes</span>
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '13px' }}>
                        © 2026 MedSwift • Built for the Golden Hour
                    </span>
                </div>
            </footer>
        </div>
    );
}
