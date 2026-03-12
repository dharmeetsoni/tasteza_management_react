import React, { useState } from 'react';
import { login } from '../../api';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const { signIn } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!phone || !password) { setError('Phone and password are required.'); return; }
    setError(''); setLoading(true);
    try {
      const d = await login(phone, password);
      if (d.success) signIn(d.token, d.user);
      else setError(d.message || 'Login failed.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Server error. Please try again.');
    } finally { setLoading(false); }
  };

  const fill = (ph, pw) => { setPhone(ph); setPassword(pw); };

  return (
    <div className="login-page">
      {/* Left Panel */}
      <div className="ll">
        <div className="brand">
          <div className="brand-icon">🍽️</div>
          <div className="brand-name">Taste<span>za</span></div>
        </div>
        <div className="ll-hero">
          <h2>Smart Kitchen<br /><em>Management</em><br />System</h2>
          <p>Track inventory, build recipes, manage costs — all in one place. Built for modern restaurants.</p>
        </div>
        <div className="ll-foot"><p>© 2024 Tasteza. All rights reserved.</p></div>
      </div>

      {/* Right Panel */}
      <div className="lr">
        <div className="lbox">
          <h3>Welcome back</h3>
          <p className="lsub">Sign in to your Tasteza account</p>

          {error && <div className="err-box">{error}</div>}

          <form onSubmit={handleLogin}>
            <div className="fg">
              <label className="fl">Phone Number</label>
              <div className="iw">
                <span className="ii">📱</span>
                <input
                  className="fi"
                  type="tel"
                  placeholder="Enter your phone number"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="fg">
              <label className="fl">Password</label>
              <div className="iw">
                <span className="ii">🔒</span>
                <input
                  className="fi"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button type="button" className="eye" onClick={() => setShowPw(s => !s)}>
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <button className="btn-login" type="submit" disabled={loading}>
              {loading ? 'Signing in…' : '→ Sign In'}
            </button>
          </form>

          <div className="demo">
            <p>Demo Credentials</p>
            <div className="drow">
              <span>👑 Admin</span>
              <code>9999999999 / admin123</code>
              <button className="dfill" onClick={() => fill('9999999999', 'admin123')}>Fill</button>
            </div>
            <div className="drow">
              <span>👤 Staff</span>
              <code>8888888888 / staff123</code>
              <button className="dfill" onClick={() => fill('8888888888', 'staff123')}>Fill</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
