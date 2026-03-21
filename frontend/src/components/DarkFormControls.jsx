/**
 * Premium dark-themed form controls used across auth pages.
 * They work as controlled components with name/value/onChange.
 */

const inputBase = {
    width: '100%', padding: '14px 16px', fontSize: 14, fontWeight: 500,
    fontFamily: "'Inter', sans-serif",
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12, color: 'white', outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
};

const labelStyle = {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: 'rgba(255,255,255,0.5)', marginBottom: 6, letterSpacing: '0.3px',
};

function focusHandler(e, accent) {
    e.target.style.borderColor = accent || 'rgba(99,102,241,0.5)';
    e.target.style.boxShadow = `0 0 0 3px ${accent || 'rgba(99,102,241,0.15)'}`;
}
function blurHandler(e) {
    e.target.style.borderColor = 'rgba(255,255,255,0.1)';
    e.target.style.boxShadow = 'none';
}

export function DarkInput({ label, type = 'text', name, value, onChange, placeholder, required, disabled, accent, ...rest }) {
    return (
        <div style={{ marginBottom: 16 }}>
            {label && <label style={labelStyle}>{label}{required && <span style={{ color: '#f87171', marginLeft: 3 }}>*</span>}</label>}
            <input
                type={type} name={name} value={value} onChange={onChange}
                placeholder={placeholder} required={required} disabled={disabled}
                onFocus={e => focusHandler(e, accent)} onBlur={blurHandler}
                style={{ ...inputBase, ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
                {...rest}
            />
        </div>
    );
}

export function DarkPasswordInput({ label, name, value, onChange, placeholder, required, accent, minLength }) {
    return (
        <div style={{ marginBottom: 16 }}>
            {label && <label style={labelStyle}>{label}{required && <span style={{ color: '#f87171', marginLeft: 3 }}>*</span>}</label>}
            <input
                type="password" name={name} value={value} onChange={onChange}
                placeholder={placeholder} required={required} minLength={minLength}
                onFocus={e => focusHandler(e, accent)} onBlur={blurHandler}
                style={inputBase}
            />
        </div>
    );
}

export function DarkSelect({ label, name, value, onChange, options, required, accent }) {
    return (
        <div style={{ marginBottom: 16 }}>
            {label && <label style={labelStyle}>{label}{required && <span style={{ color: '#f87171', marginLeft: 3 }}>*</span>}</label>}
            <select
                name={name} value={value}
                onChange={e => onChange(e.target.value)}
                onFocus={e => focusHandler(e, accent)} onBlur={blurHandler}
                style={{ ...inputBase, cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center' }}
            >
                {options.map(opt => (
                    <option key={opt} value={opt} style={{ background: '#1a1a2e', color: 'white' }}>{opt}</option>
                ))}
            </select>
        </div>
    );
}

export function DarkButton({ children, gradient, loading, disabled, type = 'submit', onClick, style: extraStyle, fullWidth = true }) {
    return (
        <button
            type={type} onClick={onClick}
            disabled={loading || disabled}
            style={{
                width: fullWidth ? '100%' : 'auto',
                padding: '15px 24px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: gradient || 'linear-gradient(135deg, #667eea, #764ba2)',
                color: 'white', fontWeight: 800, fontSize: 15, fontFamily: "'Inter', sans-serif",
                boxShadow: '0 8px 28px rgba(0,0,0,0.3)',
                transition: 'all 0.2s', opacity: (loading || disabled) ? 0.6 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                marginTop: 8,
                ...extraStyle,
            }}
            onMouseEnter={e => { if (!loading && !disabled) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 36px rgba(0,0,0,0.4)'; }}}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.3)'; }}
        >
            {loading && <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />}
            {children}
        </button>
    );
}

export function ErrorAlert({ message }) {
    if (!message) return null;
    return (
        <div style={{
            padding: '12px 16px', borderRadius: 12, marginBottom: 16,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            color: '#fca5a5', fontSize: 13, fontWeight: 500,
        }}>
            ⚠️ {message}
        </div>
    );
}
