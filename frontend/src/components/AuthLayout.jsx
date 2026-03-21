import { Link } from 'react-router-dom';

/**
 * Shared premium dark-mode layout for all auth pages (login/register).
 * 
 * Props:
 * - icon: emoji string
 * - title: heading text
 * - subtitle: description text
 * - gradient: CSS gradient for the icon circle & button (e.g. 'linear-gradient(135deg, #667eea, #764ba2)')
 * - accentGlow: rgba color for the background blob (e.g. 'rgba(102,126,234,0.3)')
 * - backLink: where "← Back" goes (default "/")
 * - footer: JSX for bottom of card (e.g. "Don't have an account?" link)
 * - children: the form content
 * - wide: if true, uses 520px max width (for register forms)
 */
export default function AuthLayout({ icon, title, subtitle, gradient, accentGlow, backLink = '/', footer, children, wide }) {
    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #070a15 0%, #0d1225 40%, #0a1628 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '40px 16px', position: 'relative', overflow: 'hidden',
            fontFamily: "'Inter', -apple-system, sans-serif",
        }}>
            {/* Background blobs */}
            <div style={{
                position: 'absolute', top: '15%', right: '8%', width: 340, height: 340,
                background: `radial-gradient(circle, ${accentGlow || 'rgba(99,102,241,0.2)'}, transparent 70%)`,
                borderRadius: '50%', filter: 'blur(70px)', pointerEvents: 'none',
            }} />
            <div style={{
                position: 'absolute', bottom: '10%', left: '5%', width: 260, height: 260,
                background: 'radial-gradient(circle, rgba(239,68,68,0.15), transparent 70%)',
                borderRadius: '50%', filter: 'blur(60px)', pointerEvents: 'none',
            }} />

            {/* EKG line */}
            <svg style={{ position: 'absolute', width: '100%', top: '50%', left: 0, opacity: 0.06, pointerEvents: 'none' }}
                height="60" viewBox="0 0 1000 60" preserveAspectRatio="none">
                <polyline
                    points="0,30 100,30 130,5 155,55 175,15 195,45 215,30 400,30 430,5 455,55 475,15 495,45 515,30 700,30 730,5 755,55 775,15 795,45 815,30 1000,30"
                    fill="none" stroke="#ef4444" strokeWidth="2.5" className="ekg-line"
                />
            </svg>

            {/* Card */}
            <div style={{
                position: 'relative', zIndex: 1,
                width: '100%', maxWidth: wide ? 520 : 440,
            }}>
                {/* Back link */}
                <Link to={backLink} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    color: 'rgba(255,255,255,0.35)', textDecoration: 'none',
                    fontSize: 13, fontWeight: 500, marginBottom: 20,
                    transition: 'color 0.2s',
                }}
                    onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.35)'}
                >
                    ← Back to Home
                </Link>

                <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 20, padding: wide ? '36px 32px' : '40px 36px',
                    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                }}>
                    {/* Gradient accent bar */}
                    <div style={{
                        position: 'absolute', top: 0, left: 24, right: 24, height: 2,
                        background: gradient, borderRadius: '0 0 2px 2px',
                    }} />

                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
                        <div style={{
                            width: 56, height: 56, borderRadius: '50%', background: gradient,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 28, boxShadow: `0 4px 20px ${accentGlow || 'rgba(99,102,241,0.3)'}`,
                            flexShrink: 0,
                        }}>
                            {icon}
                        </div>
                        <div>
                            <h2 style={{
                                margin: 0, fontSize: 22, fontWeight: 800, color: 'white',
                                letterSpacing: '-0.5px',
                            }}>{title}</h2>
                            <p style={{
                                margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.4)',
                            }}>{subtitle}</p>
                        </div>
                    </div>

                    {/* Form content */}
                    {children}

                    {/* Footer */}
                    {footer && (
                        <div style={{ textAlign: 'center', marginTop: 28, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
                            {footer}
                        </div>
                    )}
                </div>

                {/* Platform badge */}
                <div style={{
                    textAlign: 'center', marginTop: 24,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                    <span style={{ fontSize: 14 }}>🚑</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontWeight: 600 }}>
                        MedSwift — Emergency Dispatch Platform
                    </span>
                </div>
            </div>
        </div>
    );
}
