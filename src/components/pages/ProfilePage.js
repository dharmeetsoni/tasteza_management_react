import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { fmtDate, fmtDateShort, avatarColor, initials } from '../../utils';

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <div>
      <div className="ph">
        <div className="ph-left">
          <div className="pt">My Profile</div>
          <div className="ps">Your account details</div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 460, padding: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div className="av-lg" style={{ background: avatarColor(user?.name) }}>
            {initials(user?.name)}
          </div>
          <div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{user?.name}</div>
            <span className={`rtag ${user?.role}`} style={{ marginTop: 4, display: 'inline-block' }}>{user?.role}</span>
          </div>
        </div>
        <div>
          <div className="prof-row">
            <span className="pk">Phone</span>
            <span className="pv" style={{ fontFamily: 'monospace' }}>{user?.phone}</span>
          </div>
          <div className="prof-row">
            <span className="pk">Last Login</span>
            <span className="pv">{fmtDate(user?.last_login)}</span>
          </div>
          <div className="prof-row">
            <span className="pk">Member Since</span>
            <span className="pv">{fmtDateShort(user?.created_at)}</span>
          </div>
          <div className="prof-row">
            <span className="pk">Role</span>
            <span className={`badge ${user?.role}`}>{user?.role}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
