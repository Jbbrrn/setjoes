import React, { useEffect } from 'react';

export default function Modal({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="modal-content">
        {title ? <h2 className="pink-text" style={{ fontSize: 28, marginBottom: 12 }}>{title}</h2> : null}
        {children}
      </div>
    </div>
  );
}

