import React, { useState, useRef, useEffect } from 'react';
import { useCart } from '../../context/CartContext';

const ORDER_TYPES = [
  { value: 'dine_in', label: 'Dine In', icon: '🍽️' },
  { value: 'takeaway', label: 'Takeaway', icon: '🛍️' },
  { value: 'delivery', label: 'Delivery', icon: '🚴' },
];

const OrderTypeBanner = ({ search, onSearchChange }) => {
  const { state, setOrderType } = useCart();
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  const handleSearchClose = () => {
    setSearchOpen(false);
    onSearchChange?.('');
  };

  return (
    <div style={s.strip}>
      {searchOpen ? (
        /* ── Expanded search ── */
        <div style={s.searchExpanded}>
          <span style={s.searchIcon}>🔍</span>
          <input
            ref={inputRef}
            style={s.searchInput}
            placeholder="Search for dishes…"
            value={search || ''}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
          <button style={s.closeSearch} onClick={handleSearchClose}>✕</button>
        </div>
      ) : (
        /* ── Order type pills + search trigger ── */
        <div style={s.row}>
          <div style={s.pills}>
            {ORDER_TYPES.map((t) => {
              const isActive = state.orderType === t.value;
              return (
                <button
                  key={t.value}
                  style={{ ...s.pill, ...(isActive ? s.pillActive : {}) }}
                  onClick={() => setOrderType(t.value)}
                >
                  <span style={s.pillIcon}>{t.icon}</span>
                  <span style={s.pillLabel}>{t.label}</span>
                  {isActive && <span style={s.pillDot} />}
                </button>
              );
            })}
          </div>
          <button style={s.searchTrigger} onClick={() => setSearchOpen(true)}>
            🔍
          </button>
        </div>
      )}

      {/* Delivery note */}
      {!searchOpen && state.orderType === 'delivery' && (
        <div style={s.deliveryNote}>
          🚴 Free delivery on orders above ₹199
        </div>
      )}
    </div>
  );
};

const s = {
  strip: {
    background: '#fff',
    borderBottom: '1px solid #ebebeb',
    padding: '0 12px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    height: 52,
  },
  pills: {
    display: 'flex',
    gap: 6,
    flex: 1,
  },
  pill: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '7px 12px',
    borderRadius: 20,
    border: '1.5px solid #e5e7eb',
    background: '#f4f4f5',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    color: '#6b7280',
    transition: 'all 0.15s',
    position: 'relative',
    whiteSpace: 'nowrap',
  },
  pillActive: {
    border: '1.5px solid #e23744',
    background: '#fff5f5',
    color: '#e23744',
    fontWeight: 800,
  },
  pillIcon: { fontSize: 14 },
  pillLabel: { fontSize: 12 },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#e23744',
    marginLeft: 2,
    flexShrink: 0,
  },
  searchTrigger: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: '1.5px solid #e5e7eb',
    background: '#f4f4f5',
    cursor: 'pointer',
    fontSize: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  // Expanded search
  searchExpanded: {
    display: 'flex',
    alignItems: 'center',
    height: 52,
    gap: 8,
  },
  searchIcon: { fontSize: 16, color: '#9ca3af', flexShrink: 0 },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: 15,
    background: 'transparent',
    color: '#1c1c1c',
  },
  closeSearch: {
    background: '#f4f4f5',
    border: 'none',
    width: 28,
    height: 28,
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 13,
    color: '#6b7280',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveryNote: {
    fontSize: 11,
    color: '#6b7280',
    paddingBottom: 8,
    paddingLeft: 4,
  },
};

export default OrderTypeBanner;
