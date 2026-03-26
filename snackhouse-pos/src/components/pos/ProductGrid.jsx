import React from 'react';
import ProductCard from './ProductCard';

export default function ProductGrid({ products, onProductClick }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: 14
      }}
    >
      {(products || []).map((p) => (
        <ProductCard key={p.id} product={p} onClick={onProductClick} />
      ))}
    </div>
  );
}

