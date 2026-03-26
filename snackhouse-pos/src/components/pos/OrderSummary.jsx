import React from 'react';
import Button from '../common/Button';
import { formatPHP } from '../../utils/formatters';

export default function OrderSummary({ lines, onInc, onDec, onRemove, subtotal }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ fontWeight: 900, fontSize: 20, marginBottom: 10 }}>Current Order</div>

      <div style={{ flex: 1, overflow: 'auto', paddingRight: 6 }}>
        {(lines || []).length === 0 ? (
          <div style={{ opacity: 0.8 }}>Tap products to add items.</div>
        ) : (
          lines.map((l) => (
            <div
              key={l.key}
              style={{
                border: '2px solid #FFB6C1',
                borderRadius: 12,
                padding: 12,
                background: 'white',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                marginBottom: 10
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 900 }}>
                    {l.quantity}x {l.product_name}
                    {l.variant_name ? <span style={{ opacity: 0.75 }}> ({l.variant_name})</span> : null}
                  </div>
                  <div className="pink-text" style={{ fontWeight: 900, marginTop: 4 }}>
                    {formatPHP(l.subtotal)}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button className="btn-secondary" onClick={() => onInc(l)} style={{ width: 52, padding: 0 }}>
                      +
                    </Button>
                    <Button
                      className="btn-secondary"
                      onClick={() => onDec(l)}
                      style={{ width: 52, padding: 0 }}
                      disabled={l.quantity <= 1}
                    >
                      -
                    </Button>
                    <Button className="btn-danger" onClick={() => onRemove(l)} style={{ width: 52, padding: 0 }}>
                      X
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, marginBottom: 8 }}>
          <div>Subtotal</div>
          <div>{formatPHP(subtotal)}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 20 }}>
          <div>TOTAL</div>
          <div className="pink-text">{formatPHP(subtotal)}</div>
        </div>
        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>VAT disabled.</div>
      </div>
    </div>
  );
}

