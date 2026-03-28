import React from 'react';
import { formatPHP } from '../../utils/formatters';

export default function TopProducts({ items }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 10 }}>Top Selling Products</div>
      {(items || []).length === 0 ? (
        <div style={{ opacity: 0.8 }}>No sales yet.</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {items.map((it, idx) => (
            <div
              key={`${it.product_name}-${it.variant_label ?? 'x'}-${idx}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 10,
                alignItems: 'center',
                padding: 10,
                border: '1px solid #E2E8F0',
                borderRadius: 12
              }}
            >
              <div>
                <div style={{ fontWeight: 800 }}>
                  {idx + 1}. {it.product_name}
                  {it.variant_label != null && it.variant_label !== '' ? (
                    <span style={{ fontWeight: 700 }}> — {it.variant_label}</span>
                  ) : null}
                </div>
                <div style={{ opacity: 0.85, marginTop: 2 }}>{it.quantity_sold} sold</div>
                <div style={{ opacity: 0.8, marginTop: 4, fontSize: 12 }}>
                  Cost {formatPHP(it.total_cost ?? 0)} · Profit{' '}
                  {formatPHP(
                    it.gross_profit != null
                      ? it.gross_profit
                      : Number(it.revenue || 0) - Number(it.total_cost || 0)
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="pink-text" style={{ fontWeight: 900 }}>
                  {formatPHP(it.revenue)}
                </div>
                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>revenue</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

