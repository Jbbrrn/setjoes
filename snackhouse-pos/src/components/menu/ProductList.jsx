import React from 'react';
import Button from '../common/Button';

export default function ProductList({ products, onEdit, onDeactivate, onDelete, onRecipe, onVariants }) {
  const toIsActive = (value) => {
    if (value === true || value === 1 || value === '1' || value === 'true') return true;
    if (value === false || value === 0 || value === '0' || value === 'false' || value === null) return false;
    // If backend omits the field, default to active so old payloads do not appear inactive.
    return true;
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {(products || []).map((p) => {
        const isActive = toIsActive(p.is_active);
        const isFinished = p.product_type === 'finished-goods';
        const showRecipe = !isFinished;
        const showVariants = !isFinished || p.has_variants;
        return (
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
                <span style={{ fontSize: 12, fontWeight: 900, padding: '4px 8px', borderRadius: 999, background: isActive ? '#48BB78' : '#FC8181', color: 'white' }}>
                  {isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div style={{ opacity: 0.8, marginTop: 4 }}>
                Category: {p.category_name}  •  Price (base): ₱{Number(p.base_price).toFixed(2)}  •  Type: {p.product_type}
              </div>
              <div style={{ opacity: 0.8, marginTop: 4 }}>
                Cost: {p.cost_price != null && p.cost_price !== '' ? `₱${Number(p.cost_price).toFixed(2)}` : '—'}
                {p.product_type === 'made-to-order' ? ' (from recipe)' : ''}
              </div>
              {!isFinished ? (
                <div style={{ opacity: 0.8, marginTop: 4 }}>
                  Variants:{' '}
                  {p.has_variants
                    ? (p.variants || []).map((v) => `${v.variant_name} (₱${Number(v.price).toFixed(2)})`).join(', ') || '—'
                    : 'None'}
                </div>
              ) : p.has_variants ? (
                <div style={{ opacity: 0.85, marginTop: 4, color: '#C05621' }}>
                  Legacy variants present — open Variants to remove them (finished goods use base price only).
                </div>
              ) : null}
            </div>
            <div className="actions-row">
              {showRecipe ? (
                <Button className="btn-secondary" onClick={() => onRecipe(p)}>
                  Recipe
                </Button>
              ) : null}
              {showVariants ? (
                <Button className="btn-secondary" onClick={() => onVariants(p)}>
                  {isFinished && p.has_variants ? 'Remove variants' : 'Variants'}
                </Button>
              ) : null}
              <Button className="btn-secondary" onClick={() => onEdit(p)}>
                Edit
              </Button>
              <Button className={isActive ? 'btn-danger' : 'btn-primary'} onClick={() => onDeactivate(p)}>
                {isActive ? 'Set Inactive' : 'Set Active'}
              </Button>
              <Button className="btn-danger" onClick={() => onDelete(p)}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )})}
    </div>
  );
}

