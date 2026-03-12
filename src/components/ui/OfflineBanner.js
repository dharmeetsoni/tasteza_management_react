import React, { useState } from 'react';
import { useOffline } from '../../context/OfflineContext';

export default function OfflineBanner() {
  const { isOnline, pending, syncing, lastSync, flush } = useOffline();
  const [expanded, setExpanded] = useState(false);

  // Fully online, nothing pending — hide completely
  if (isOnline && pending === 0) return null;

  const fmtTime = d => d ? d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }) : null;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: isOnline ? '#1a1a2e' : '#e84a5f',
      color: '#fff', fontSize: 13, fontWeight: 600,
      boxShadow: '0 -2px 16px rgba(0,0,0,.25)',
      transition: 'background .3s',
    }}>
      {/* Main bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 20px', cursor: pending > 0 ? 'pointer' : 'default',
      }} onClick={() => pending > 0 && setExpanded(e => !e)}>

        {/* Status dot */}
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: isOnline ? '#1db97e' : '#fff',
          boxShadow: isOnline ? '0 0 6px #1db97e' : 'none',
          flexShrink: 0,
        }} />

        {/* Message */}
        <span style={{ flex: 1 }}>
          {!isOnline && pending === 0 && '📡 Offline — changes will be saved locally'}
          {!isOnline && pending  >  0 && `📡 Offline — ${pending} action${pending>1?'s':''} waiting to sync`}
          {isOnline  && pending  >  0 && (
            syncing
              ? `🔄 Syncing ${pending} pending action${pending>1?'s':''}…`
              : `⏳ ${pending} action${pending>1?'s':''} pending sync`
          )}
        </span>

        {/* Last sync */}
        {lastSync && (
          <span style={{ fontSize: 11, opacity: .7 }}>
            Last sync {fmtTime(lastSync)}
          </span>
        )}

        {/* Manual sync button */}
        {isOnline && pending > 0 && !syncing && (
          <button
            onClick={e => { e.stopPropagation(); flush(); }}
            style={{
              background: 'rgba(255,255,255,.2)', border: 'none',
              color: '#fff', padding: '4px 12px', borderRadius: 6,
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Sync Now
          </button>
        )}

        {pending > 0 && (
          <span style={{ fontSize: 11, opacity: .7 }}>
            {expanded ? '▲' : '▼'}
          </span>
        )}
      </div>
    </div>
  );
}
