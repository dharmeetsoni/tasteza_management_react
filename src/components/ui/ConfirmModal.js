import React from 'react';
import Modal from './Modal';

export default function ConfirmModal({ show, onClose, onConfirm, title, message, icon = '🗑️', confirmLabel = 'Delete', dangerous = true }) {
  return (
    <Modal show={show} onClose={onClose}>
      <div className="conf-modal">
        <div className="ci">{icon}</div>
        <h4>{title}</h4>
        <p className="msub" style={{ marginBottom: 0 }}>{message}</p>
      </div>
      <div className="mft" style={{ justifyContent: 'center', marginTop: 24 }}>
        <button className="btn-c" onClick={onClose}>Cancel</button>
        <button className={dangerous ? 'btn-danger' : 'btn-p'} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}
