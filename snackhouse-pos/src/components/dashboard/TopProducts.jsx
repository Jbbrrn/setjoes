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
              key={it.product_name + idx}
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
                </div>
                <div style={{ opacity: 0.85, marginTop: 2 }}>{it.quantity_sold} sold</div>
              </div>
              <div className="pink-text" style={{ fontWeight: 900 }}>
                {formatPHP(it.revenue)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

