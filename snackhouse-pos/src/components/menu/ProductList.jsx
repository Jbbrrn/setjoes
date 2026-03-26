import React from 'react';
import Button from '../common/Button';

export default function ProductList({ products, onEdit, onDeactivate, onDelete, onRecipe }) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {(products || []).map((p) => (
        <div
          key={p.id}
          style={{
            border: '2px solid #FFB6C1',
            borderRadius: 12,
            padding: 16,
            background: 'white',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <div>
              {p.image_url ? (
                <img
                  src={p.image_url}
                  alt={p.name}
                  style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 12, marginBottom: 8, border: '1px solid #f1d6de' }}
                />
              ) : null}
              <div style={{ fontWeight: 900, fontSize: 18 }}>
                {p.name}{' '}
                <span style={{ fontSize: 12, fontWeight: 900, padding: '4px 8px', borderRadius: 999, background: p.is_active ? '#48BB78' : '#FC8181', color: 'white' }}>
                  {p.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div style={{ opacity: 0.8, marginTop: 4 }}>
                Category: {p.category_name}  •  Base Price: ₱{Number(p.base_price).toFixed(2)}  •  Type: {p.product_type}
              </div>
              <div style={{ opacity: 0.8, marginTop: 4 }}>
                Variants: {p.has_variants ? (p.variants || []).map((v) => `${v.variant_name} (₱${Number(v.price).toFixed(2)})`).join(', ') || '—' : 'None'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'start' }}>
              <Button className="btn-secondary" onClick={() => onRecipe(p)}>
                Recipe
              </Button>
              <Button className="btn-secondary" onClick={() => onEdit(p)}>
                Edit
              </Button>
              <Button className="btn-danger" onClick={() => onDeactivate(p)}>
                {p.is_active ? 'Deactivate' : 'Activate'}
              </Button>
              <Button className="btn-danger" onClick={() => onDelete(p)}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

