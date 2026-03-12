import React, { useEffect } from 'react';

export default function Modal({ show, onClose, title, subtitle, wide, children, footer }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    if (show) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div className="ov show" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? 'wide' : ''}`}>
        {title && <h4>{title}</h4>}
        {subtitle && <p className="msub">{subtitle}</p>}
        {children}
        {footer && <div className="mft">{footer}</div>}
      </div>
    </div>
  );
}
