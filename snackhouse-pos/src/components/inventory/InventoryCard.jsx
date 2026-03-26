import React from 'react';
import Button from '../common/Button';

export default function InventoryCard({ title, subtitle, progress, badge, onAdjust }) {
  return (
    <div
      style={{
        border: '2px solid #FFB6C1',
        borderRadius: 12,
        padding: 16,
        background: 'white',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start' }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>{title}</div>
          {subtitle ? <div style={{ opacity: 0.8, marginTop: 4 }}>{subtitle}</div> : null}
        </div>
        {badge ? (
          <div
            style={{
              background: badge.color,
              color: 'white',
              padding: '6px 10px',
              borderRadius: 999,
              fontWeight: 900,
              fontSize: 12
            }}
          >
            {badge.text}
          </div>
        ) : null}
      </div>

      {typeof progress === 'number' ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ height: 12, background: '#EDF2F7', borderRadius: 999, overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.max(0, Math.min(100, progress))}%`,
                height: '100%',
                background: '#FF69B4'
              }}
            />
          </div>
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <Button className="btn-secondary" onClick={onAdjust}>
          Adjust Stock
        </Button>
      </div>
    </div>
  );
}

