import React from 'react';
import { formatPHP } from '../../utils/formatters';

export default function ProductCard({ product, onClick }) {
  const stock = product.current_stock;
  const isOut = stock !== null && stock <= 0;
  const isLow = stock !== null && stock > 0 && stock < 10;

  const dotColor = isOut ? '#FC8181' : isLow ? '#ED8936' : '#48BB78';

  return (
    <button
      type="button"
      disabled={isOut}
      onClick={() => onClick(product)}
      style={{
        width: 160,
        height: 160,
        borderRadius: 12,
        border: '2px solid #FFB6C1',
        background: 'white',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        padding: 12,
        textAlign: 'left',
        cursor: isOut ? 'not-allowed' : 'pointer',
        position: 'relative'
      }}
    >
      {isOut ? (
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            background: '#FC8181',
            color: 'white',
            padding: '4px 8px',
            borderRadius: 8,
            fontWeight: 800,
            fontSize: 12
          }}
        >
          SOLD OUT
        </div>
      ) : null}

      <div
        style={{
          height: 70,
          borderRadius: 10,
          background: '#F8F9FA',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 32
        }}
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }}
          />
        ) : (
          '🍕'
        )}
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 16, lineHeight: '20px' }}>{product.name}</div>
        <div style={{ fontWeight: 900, marginTop: 6, color: '#FF69B4' }}>
          {formatPHP(product.base_price)}
        </div>
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, opacity: 0.9 }}>
          <span style={{ width: 10, height: 10, borderRadius: 99, background: dotColor, display: 'inline-block' }} />
          <span>
            Stock:{' '}
            <span style={{ fontWeight: 800 }}>
              {stock === null ? '—' : stock}
            </span>
          </span>
        </div>
      </div>
    </button>
  );
}

