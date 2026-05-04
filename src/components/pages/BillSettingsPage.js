import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getSettings, saveSettings } from '../../api';
import { useToast } from '../../context/ToastContext';

const DEFAULTS = {
  restaurant_name: 'Tasteza Restaurant',
  tagline: 'Thank you for dining with us!',
  address: '', phone: '', email: '', website: '',
  gst_number: '', fssai_number: '',
  currency_symbol: '₹', logo_base64: null, logo_width: 120,
  bill_footer: 'Have a great day! 😊',
  show_logo: 1, show_gst_break: 1, show_qr: 1, show_thank_you: 1,
  bill_copies: 1, primary_color: '#e8572a',
  // Integrations
  firebase_api_key: '', firebase_auth_domain: '', firebase_project_id: '', firebase_app_id: '',
  phonepay_merchant_id: '', phonepay_salt_key: '', phonepay_salt_index: '1', phonepay_env: 'sandbox',
  phonepay_client_id: '', phonepay_client_secret: '', phonepay_client_version: '1',
  google_maps_key: '',
  delivery_charge: 40, delivery_free_above: 500, auto_accept_seconds: 30, online_ordering_enabled: 1,
};
const PRESET_COLORS = ['#e8572a', '#e84a5f', '#118ab2', '#1db97e', '#8b5cf6', '#f59e0b', '#1a1a2e', '#333'];

function Toggle({ on, onChange, label, sub }) {
  return (
    <div onClick={() => onChange(!on)} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '13px 16px', borderRadius: 12, cursor: 'pointer',
      background: on ? 'rgba(232,87,42,.06)' : 'var(--bg)',
      border: `1.5px solid ${on ? 'rgba(232,87,42,.3)' : 'var(--border)'}`,
      transition: 'all .15s', userSelect: 'none', marginBottom: 10,
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--ink2)', marginTop: 1 }}>{sub}</div>}
      </div>
      <div style={{ width: 44, height: 24, borderRadius: 12, position: 'relative', flexShrink: 0, background: on ? 'var(--accent)' : '#ccc', transition: 'background .2s' }}>
        <div style={{ position: 'absolute', top: 2, left: on ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.25)' }} />
      </div>
    </div>
  );
}

function SectionLabel({ icon, title, sub }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(232,87,42,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

function F({ label, children, col, hint }) {
  return (
    <div style={{ gridColumn: col || 'auto', marginBottom: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 11, color: 'var(--ink2)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function BillPreview({ s }) {
  const cur = s.currency_symbol || '₹';
  const color = s.primary_color || '#e8572a';
  return (
    <div style={{ width: 300, margin: '0 auto', fontFamily: 'monospace', fontSize: 12.5, background: '#fff', color: '#111', borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 40px rgba(26,26,46,.15)', border: '1px solid var(--border)' }}>
      <div style={{ height: 10, background: 'repeating-linear-gradient(90deg,#fff 0,#fff 8px,var(--bg) 8px,var(--bg) 16px)', borderBottom: '1.5px dashed #ccc' }} />
      <div style={{ padding: '18px 18px 14px' }}>
        {s.show_logo && s.logo_base64 && (
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <img src={s.logo_base64} alt="logo" style={{ width: s.logo_width || 120, maxHeight: 80, objectFit: 'contain' }} />
          </div>
        )}
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color, letterSpacing: -.5 }}>{s.restaurant_name || 'Restaurant Name'}</div>
          {s.tagline && <div style={{ fontSize: 10, color: '#666', marginTop: 3 }}>{s.tagline}</div>}
          {s.address && <div style={{ fontSize: 10, color: '#777', marginTop: 3, whiteSpace: 'pre-line', lineHeight: 1.5 }}>{s.address}</div>}
          {s.phone && <div style={{ fontSize: 10, color: '#777', marginTop: 2 }}>📞 {s.phone}</div>}
          {s.email && <div style={{ fontSize: 10, color: '#777' }}>✉ {s.email}</div>}
          {s.gst_number && <div style={{ fontSize: 10, color: '#777', marginTop: 3, background: '#f5f5f5', borderRadius: 4, display: 'inline-block', padding: '2px 8px' }}>GSTIN: {s.gst_number}</div>}
          {s.fssai_number && <div style={{ fontSize: 10, color: '#777', marginTop: 3 }}>FSSAI: {s.fssai_number}</div>}
        </div>
        <div style={{ borderTop: '1.5px dashed #ccc', margin: '10px 0' }} />
        <div style={{ fontSize: 11, marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Bill No: <b>#ORD-0001</b></span>
            <span>{new Date().toLocaleDateString('en-IN')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
            <span>Table: 3 · Dine-In</span>
            <span>{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
        <div style={{ borderTop: '1px dashed #ccc', margin: '8px 0' }} />
        <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
          <thead><tr>
            {['Item', 'Qty', 'Price', 'Total'].map((h, i) => (
              <th key={h} style={{ textAlign: i === 0 ? 'left' : 'right', paddingBottom: 5, fontWeight: 700, borderBottom: '1px dashed #ccc', textAlign: i === 1 ? 'center' : i === 0 ? 'left' : 'right' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {[['Butter Chicken', 2, 280, 560], ['Garlic Naan', 4, 40, 160], ['Mango Lassi', 2, 90, 180]].map(([n, q, p, t]) => (
              <tr key={n}>
                <td style={{ paddingTop: 5 }}>{n}</td>
                <td style={{ textAlign: 'center' }}>{q}</td>
                <td style={{ textAlign: 'right' }}>{cur}{p}</td>
                <td style={{ textAlign: 'right' }}>{cur}{t}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ borderTop: '1px dashed #ccc', margin: '8px 0' }} />
        <div style={{ fontSize: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}><span>Subtotal</span><span>{cur}900</span></div>
          {!!s.show_gst_break && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, color: '#777' }}><span>GST (5%)</span><span>{cur}45</span></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, color: 'green' }}><span>Discount</span><span>-{cur}50</span></div>
          <div style={{ borderTop: '1.5px solid #222', margin: '6px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 14 }}>
            <span>TOTAL</span><span style={{ color }}>{cur}895</span>
          </div>
          <div style={{ fontSize: 10, color: '#888', marginTop: 3 }}>Payment: UPI ✓ Paid</div>
        </div>
        {!!s.show_qr && (
          <div style={{ textAlign: 'center', margin: '12px 0 4px' }}>
            <div style={{ width: 72, height: 72, margin: '0 auto', background: '#f0f0f0', border: '1px solid #ddd', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#aaa' }}>▦</div>
          </div>
        )}
        {!!s.show_thank_you && (
          <div style={{ textAlign: 'center', marginTop: 10, paddingTop: 10, borderTop: '1.5px dashed #ccc', fontSize: 11, color: '#555' }}>
            {s.bill_footer || 'Have a great day! 😊'}
            {s.website && <div style={{ marginTop: 2, color: '#888', fontSize: 10 }}>{s.website}</div>}
          </div>
        )}
      </div>
      <div style={{ height: 10, background: 'repeating-linear-gradient(90deg,#fff 0,#fff 8px,var(--bg) 8px,var(--bg) 16px)', borderTop: '1.5px dashed #ccc' }} />
    </div>
  );
}

export default function BillSettingsPage() {
  const toast = useToast();
  const [form, setForm] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('info');
  const logoRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getSettings();
      if (r.success && r.data && r.data.id) setForm({ ...DEFAULTS, ...r.data });
    } catch { }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 600 * 1024) { toast('Image too large — max 600KB', 'er'); return; }
    const reader = new FileReader();
    reader.onload = ev => set('logo_base64', ev.target.result);
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!form.restaurant_name?.trim()) { toast('Restaurant name is required', 'er'); return; }
    setSaving(true);
    try {
      const r = await saveSettings(form);
      if (r.success) toast('✅ Settings saved!', 'ok');
      else toast(r.message || 'Save failed', 'er');
    } catch (e) { toast('Save failed: ' + e.message, 'er'); }
    setSaving(false);
  };

  const TABS = [
    { id: 'info', icon: '🏪', label: 'Restaurant' },
    { id: 'legal', icon: '📋', label: 'Legal & Tax' },
    { id: 'logo', icon: '🖼️', label: 'Logo' },
    { id: 'options', icon: '⚙️', label: 'Options' },
    { id: 'integrations', icon: '🔌', label: 'Integrations' },
    { id: 'preview', icon: '👁️', label: 'Preview' },
  ];

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400, flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 40, animation: 'bsSpin 1s linear infinite' }}>🧾</div>
      <div style={{ color: 'var(--ink2)', fontSize: 14 }}>Loading settings…</div>
      <style>{`@keyframes bsSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const inp = { className: 'mfi', style: { width: '100%' } };

  return (
    <div>
      <style>{`
        .bsi{width:100%;padding:11px 14px;border:1.5px solid var(--border);border-radius:10px;
          font-size:14px;background:var(--surface);color:var(--ink);outline:none;
          transition:border-color .2s,box-shadow .2s;font-family:inherit;}
        .bsi:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(232,87,42,.09);}
        .bsi::placeholder{color:#bbb;}
        .bs-nav-btn{width:100%;padding:11px 14px;border:none;background:transparent;font-family:inherit;
          font-size:13px;font-weight:700;cursor:pointer;border-radius:10px;
          display:flex;align-items:center;gap:9px;transition:all .15s;color:var(--ink2);text-align:left;}
        .bs-nav-btn:hover{background:var(--bg);color:var(--ink);}
        .bs-nav-btn.act{background:rgba(232,87,42,.09);color:var(--accent);}
      `}</style>

      {/* Header */}
      <div className="ph" style={{ marginBottom: 24 }}>
        <div className="ph-left">
          <div className="pt">🧾 Bill Settings</div>
          <div className="ps">Customize your restaurant receipt — logo, info &amp; layout</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-c" onClick={() => setTab('preview')}>👁️ Preview</button>
          <button className="btn-p" onClick={save} disabled={saving} style={{ minWidth: 140 }}>
            {saving ? '⏳ Saving…' : '💾 Save Settings'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '210px 1fr', gap: 20, alignItems: 'start' }}>

        {/* ── Left sidebar nav ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="card" style={{ padding: 8 }}>
            {TABS.map(t => (
              <button key={t.id} className={`bs-nav-btn${tab === t.id ? ' act' : ''}`} onClick={() => setTab(t.id)}>
                <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{t.icon}</span>
                <span style={{ flex: 1 }}>{t.label}</span>
                {tab === t.id && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}
              </button>
            ))}
          </div>

          {/* Mini live preview */}
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink2)', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 10 }}>Live Preview</div>
            <div style={{ transform: 'scale(.44)', transformOrigin: 'top center', height: 148, overflow: 'hidden', pointerEvents: 'none' }}>
              <BillPreview s={form} />
            </div>
            <button className="btn-c" onClick={() => setTab('preview')} style={{ width: '100%', marginTop: 10, fontSize: 12 }}>
              Full Preview →
            </button>
          </div>
        </div>

        {/* ── Right content ── */}
        <div>

          {/* Restaurant Info */}
          {tab === 'info' && (
            <div className="card">
              <div style={{ padding: '22px 24px 0' }}>
                <SectionLabel icon="🏪" title="Restaurant Information" sub="Appears at the top of every printed bill" />
              </div>
              <div style={{ padding: '0 24px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <F label="Restaurant Name *" col="1/-1">
                  <input className="bsi" value={form.restaurant_name || ''} onChange={e => set('restaurant_name', e.target.value)} placeholder="Tasteza Restaurant" />
                </F>
                <F label="Tagline / Slogan" col="1/-1">
                  <input className="bsi" value={form.tagline || ''} onChange={e => set('tagline', e.target.value)} placeholder="Thank you for dining with us!" />
                </F>
                <F label="Address" col="1/-1">
                  <textarea className="bsi" rows={3} value={form.address || ''} onChange={e => set('address', e.target.value)} placeholder={"Shop No. 1, Main Street\nCity - 380001"} style={{ resize: 'vertical' }} />
                </F>
                <F label="Phone Number">
                  <input className="bsi" value={form.phone || ''} onChange={e => set('phone', e.target.value)} placeholder="+91 98765 43210" />
                </F>
                <F label="Email Address">
                  <input className="bsi" value={form.email || ''} onChange={e => set('email', e.target.value)} placeholder="info@restaurant.com" />
                </F>
                <F label="Website" col="1/-1">
                  <input className="bsi" value={form.website || ''} onChange={e => set('website', e.target.value)} placeholder="www.tasteza.com" />
                </F>
              </div>
            </div>
          )}

          {/* Legal & Tax */}
          {tab === 'legal' && (
            <div className="card">
              <div style={{ padding: '22px 24px 0' }}>
                <SectionLabel icon="📋" title="Legal & Tax Information" sub="GST, FSSAI and currency settings" />
              </div>
              <div style={{ padding: '0 24px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <F label="GST Number" col="1/-1" hint="Leave blank if not GST registered">
                  <input className="bsi" value={form.gst_number || ''} onChange={e => set('gst_number', e.target.value)} placeholder="27XXXXX1234X1ZX" />
                </F>
                <F label="FSSAI License Number" col="1/-1">
                  <input className="bsi" value={form.fssai_number || ''} onChange={e => set('fssai_number', e.target.value)} placeholder="14-digit FSSAI number" />
                </F>
                <F label="Currency Symbol" hint="e.g. ₹, $, €">
                  <input className="bsi" value={form.currency_symbol || '₹'} onChange={e => set('currency_symbol', e.target.value)} style={{ fontFamily: 'monospace', letterSpacing: 1 }} placeholder="₹" />
                </F>
                <F label="Brand / Accent Color">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="color" value={form.primary_color || '#e8572a'} onChange={e => set('primary_color', e.target.value)}
                      style={{ width: 44, height: 42, border: '1.5px solid var(--border)', borderRadius: 10, cursor: 'pointer', padding: 3, background: 'var(--surface)', flexShrink: 0 }} />
                    <input className="bsi" value={form.primary_color || '#e8572a'} onChange={e => set('primary_color', e.target.value)} style={{ fontFamily: 'monospace' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                    {PRESET_COLORS.map(c => (
                      <div key={c} onClick={() => set('primary_color', c)} title={c} style={{
                        width: 28, height: 28, borderRadius: 8, background: c, cursor: 'pointer',
                        border: form.primary_color === c ? '2.5px solid var(--ink)' : '2px solid transparent',
                        boxShadow: form.primary_color === c ? '0 0 0 1.5px var(--border)' : 'none',
                        transform: form.primary_color === c ? 'scale(1.18)' : 'scale(1)',
                        transition: 'transform .1s',
                      }} />
                    ))}
                  </div>
                </F>
              </div>
            </div>
          )}

          {/* Logo */}
          {tab === 'logo' && (
            <div className="card">
              <div style={{ padding: '22px 24px 0' }}>
                <SectionLabel icon="🖼️" title="Restaurant Logo" sub="Upload your logo to print on every bill" />
              </div>
              <div style={{ padding: '0 24px 24px' }}>
                <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={handleLogo} style={{ display: 'none' }} />
                {form.logo_base64 ? (
                  <div style={{ marginBottom: 22, padding: 24, background: 'var(--bg)', borderRadius: 14, border: '2px dashed var(--border)', textAlign: 'center' }}>
                    <img src={form.logo_base64} alt="logo" style={{ maxHeight: 120, maxWidth: 280, objectFit: 'contain', display: 'block', margin: '0 auto 16px', borderRadius: 8 }} />
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                      <button className="btn-c" onClick={() => logoRef.current?.click()}>🔄 Change Logo</button>
                      <button onClick={() => set('logo_base64', null)} style={{ padding: '9px 18px', background: 'rgba(232,74,95,.1)', color: 'var(--red)', borderRadius: 9, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}>🗑️ Remove</button>
                    </div>
                  </div>
                ) : (
                  <div onClick={() => logoRef.current?.click()}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'rgba(232,87,42,.03)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg)'; }}
                    style={{ marginBottom: 22, padding: '44px 20px', background: 'var(--bg)', borderRadius: 14, border: '2px dashed var(--border)', textAlign: 'center', cursor: 'pointer', transition: 'all .2s' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🖼️</div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Click to upload your logo</div>
                    <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 16 }}>PNG, JPG, SVG, WebP · Max 600KB</div>
                    <span className="btn-p" style={{ display: 'inline-block', pointerEvents: 'none' }}>📂 Choose File</span>
                  </div>
                )}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: .5 }}>
                    Logo Width on Bill: <span style={{ color: 'var(--accent)' }}>{form.logo_width || 120}px</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 11, color: 'var(--ink2)', flexShrink: 0 }}>50px</span>
                    <input type="range" min={50} max={250} step={5} value={form.logo_width || 120}
                      onChange={e => set('logo_width', parseInt(e.target.value))}
                      style={{ flex: 1, accentColor: 'var(--accent)' }} />
                    <span style={{ fontSize: 11, color: 'var(--ink2)', flexShrink: 0 }}>250px</span>
                  </div>
                  {form.logo_base64 && (
                    <div style={{ marginTop: 14, padding: 14, background: 'var(--bg)', borderRadius: 10, textAlign: 'center' }}>
                      <img src={form.logo_base64} alt="size preview" style={{ width: form.logo_width || 120, maxHeight: 80, objectFit: 'contain' }} />
                      <div style={{ fontSize: 11, color: 'var(--ink2)', marginTop: 6 }}>Preview at {form.logo_width || 120}px</div>
                    </div>
                  )}
                </div>
                <Toggle on={!!form.show_logo} onChange={v => set('show_logo', v ? 1 : 0)} label="Show logo on printed bill" sub="Turn off to hide logo even if uploaded" />
              </div>
            </div>
          )}

          {/* Options */}
          {tab === 'options' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div className="card">
                <div style={{ padding: '22px 24px 0' }}>
                  <SectionLabel icon="📄" title="Bill Content" sub="What to show on the printed receipt" />
                </div>
                <div style={{ padding: '0 16px 20px' }}>
                  <Toggle on={!!form.show_gst_break} onChange={v => set('show_gst_break', v ? 1 : 0)} label="GST breakdown line" sub="Shows CGST / SGST split" />
                  <Toggle on={!!form.show_qr} onChange={v => set('show_qr', v ? 1 : 0)} label="QR code on bill" sub="Scannable code at bottom" />
                  <Toggle on={!!form.show_thank_you} onChange={v => set('show_thank_you', v ? 1 : 0)} label="Footer message" sub="Thank you text + website" />
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>Footer Message</div>
                    <input className="bsi" value={form.bill_footer || ''} onChange={e => set('bill_footer', e.target.value)} placeholder="Have a great day! 😊" />
                  </div>
                </div>
              </div>
              <div className="card">
                <div style={{ padding: '22px 24px 0' }}>
                  <SectionLabel icon="🖨️" title="Print Settings" sub="Copies per transaction" />
                </div>
                <div style={{ padding: '0 24px 24px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink2)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: .5 }}>Bill Copies to Print</div>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                    {[1, 2, 3].map(n => (
                      <button key={n} onClick={() => set('bill_copies', n)} style={{
                        flex: 1, padding: '14px 0', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer',
                        fontFamily: 'inherit', transition: 'all .15s',
                        border: `2px solid ${form.bill_copies === n ? 'var(--accent)' : 'var(--border)'}`,
                        background: form.bill_copies === n ? 'rgba(232,87,42,.08)' : 'var(--bg)',
                        color: form.bill_copies === n ? 'var(--accent)' : 'var(--ink2)',
                        boxShadow: form.bill_copies === n ? '0 2px 10px rgba(232,87,42,.15)' : 'none',
                      }}>
                        {n}<div style={{ fontSize: 10, fontWeight: 600, marginTop: 2 }}>{n === 1 ? 'copy' : 'copies'}</div>
                      </button>
                    ))}
                  </div>
                  <div style={{ padding: '14px 16px', background: 'rgba(232,87,42,.06)', borderRadius: 12, border: '1.5px solid rgba(232,87,42,.2)' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', marginBottom: 5 }}>💡 Tip</div>
                    <div style={{ fontSize: 12, color: 'var(--ink2)', lineHeight: 1.6 }}>
                      2 copies = customer + kitchen. 3 copies = customer + kitchen + accounts.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Integrations */}
          {tab === 'integrations' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

              {/* Firebase */}
              <div className="card">
                <div style={{ padding: '22px 24px 0' }}>
                  <SectionLabel icon="🔥" title="Firebase (SMS OTP)" sub="Used for customer phone verification on online orders" />
                </div>
                <div style={{ padding: '0 24px 24px', display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                  <F label="API Key"><input className="bsi" value={form.firebase_api_key || ''} onChange={e => set('firebase_api_key', e.target.value)} placeholder="AIzaSyXXXXX" /></F>
                  <F label="Auth Domain"><input className="bsi" value={form.firebase_auth_domain || ''} onChange={e => set('firebase_auth_domain', e.target.value)} placeholder="your-app.firebaseapp.com" /></F>
                  <F label="Project ID"><input className="bsi" value={form.firebase_project_id || ''} onChange={e => set('firebase_project_id', e.target.value)} placeholder="your-project-id" /></F>
                  <F label="App ID"><input className="bsi" value={form.firebase_app_id || ''} onChange={e => set('firebase_app_id', e.target.value)} placeholder="1:123456:web:abc123" /></F>
                </div>
              </div>

              {/* PhonePe */}
              <div className="card">
                <div style={{ padding: '22px 24px 0' }}>
                  <SectionLabel icon="📱" title="PhonePe Gateway (V2)" sub="Client ID & Secret from PhonePe Business Dashboard → Developer Settings" />
                </div>
                <div style={{ padding: '0 24px 24px', display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                  <F label="Client ID"><input className="bsi" value={form.phonepay_client_id || ''} onChange={e => set('phonepay_client_id', e.target.value)} placeholder="Client ID from PhonePe Business Dashboard" /></F>
                  <F label="Client Secret"><input className="bsi" type="password" value={form.phonepay_client_secret || ''} onChange={e => set('phonepay_client_secret', e.target.value)} placeholder="Client Secret from PhonePe Business Dashboard" /></F>
                  <F label="Client Version"><input className="bsi" value={form.phonepay_client_version || '1'} onChange={e => set('phonepay_client_version', e.target.value)} placeholder="1" /></F>
                  <F label="Environment">
                    <div style={{ display: 'flex', gap: 10 }}>
                      {['sandbox', 'production'].map(env => (
                        <button key={env} onClick={() => set('phonepay_env', env)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: `2px solid ${form.phonepay_env === env ? 'var(--accent)' : 'var(--border)'}`, background: form.phonepay_env === env ? 'rgba(232,87,42,.08)' : 'var(--bg)', color: form.phonepay_env === env ? 'var(--accent)' : 'var(--ink2)', fontWeight: 700, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', textTransform: 'capitalize' }}>{env}</button>
                      ))}
                    </div>
                  </F>
                </div>
              </div>

              {/* Google Maps */}
              <div className="card">
                <div style={{ padding: '22px 24px 0' }}>
                  <SectionLabel icon="🗺️" title="Google Maps" sub="Address autocomplete for delivery orders" />
                </div>
                <div style={{ padding: '0 24px 24px' }}>
                  <F label="Maps API Key" hint="Enable Maps JavaScript API + Places API in Google Cloud Console">
                    <input className="bsi" value={form.google_maps_key || ''} onChange={e => set('google_maps_key', e.target.value)} placeholder="AIzaSyXXXX" />
                  </F>
                </div>
              </div>

              {/* Delivery config */}
              <div className="card">
                <div style={{ padding: '22px 24px 0' }}>
                  <SectionLabel icon="🛵" title="Online Ordering" sub="Delivery fees and auto-accept settings" />
                </div>
                <div style={{ padding: '0 24px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <F label="Delivery Charge (₹)">
                    <input className="bsi" type="number" min="0" value={form.delivery_charge || 0} onChange={e => set('delivery_charge', Number(e.target.value))} />
                  </F>
                  <F label="Free Delivery Above (₹)" hint="0 = always charge">
                    <input className="bsi" type="number" min="0" value={form.delivery_free_above || 0} onChange={e => set('delivery_free_above', Number(e.target.value))} />
                  </F>
                  <F label="Auto-accept (seconds)" hint="0 = manual accept only">
                    <input className="bsi" type="number" min="0" value={form.auto_accept_seconds || 0} onChange={e => set('auto_accept_seconds', Number(e.target.value))} />
                  </F>
                  <F label="Online Ordering">
                    <Toggle on={!!form.online_ordering_enabled} onChange={v => set('online_ordering_enabled', v ? 1 : 0)} label="Enabled" sub="Show/hide online menu" />
                  </F>
                </div>
              </div>

            </div>
          )}

          {/* Preview */}
          {tab === 'preview' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>Bill Preview</div>
                  <div style={{ fontSize: 13, color: 'var(--ink2)' }}>Exactly how your receipt will print</div>
                </div>
                <button className="btn-p" onClick={save} disabled={saving}>
                  {saving ? '⏳ Saving…' : '💾 Save Settings'}
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 24, alignItems: 'start' }}>
                <BillPreview s={form} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="card" style={{ padding: '16px 18px' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 12 }}>Quick Toggles</div>
                    <Toggle on={!!form.show_logo} onChange={v => set('show_logo', v ? 1 : 0)} label="Logo" />
                    <Toggle on={!!form.show_gst_break} onChange={v => set('show_gst_break', v ? 1 : 0)} label="GST line" />
                    <Toggle on={!!form.show_qr} onChange={v => set('show_qr', v ? 1 : 0)} label="QR Code" />
                    <Toggle on={!!form.show_thank_you} onChange={v => set('show_thank_you', v ? 1 : 0)} label="Footer" />
                  </div>
                  <div className="card" style={{ padding: '16px 18px' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 10 }}>Brand Color</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {PRESET_COLORS.map(c => (
                        <div key={c} onClick={() => set('primary_color', c)} style={{
                          width: 32, height: 32, borderRadius: 9, background: c, cursor: 'pointer',
                          border: form.primary_color === c ? '2.5px solid var(--ink)' : '2px solid transparent',
                          transform: form.primary_color === c ? 'scale(1.18)' : 'scale(1)',
                          transition: 'transform .1s',
                        }} />
                      ))}
                    </div>
                  </div>
                  <button className="btn-p" onClick={save} disabled={saving} style={{ padding: '14px', fontWeight: 800 }}>
                    {saving ? '⏳ Saving…' : '💾 Save Settings'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
