import React, { useMemo, useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';

export default function StockAdjustModal({ open, item, kind, onClose, onSave }) {
  const [type, setType] = useState('restock');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');

  const numericQty = useMemo(() => Number(qty || 0), [qty]);

  const body = useMemo(() => {
    if (!item) return null;
    if (kind === 'ingredient') {
      return {
        ingredient_id: item.id,
        quantity_change: numericQty,
        adjustment_type: type,
        reason
      };
    }
    return {
      product_id: item.id,
      quantity_change: numericQty,
      adjustment_type: type,
      reason
    };
  }, [item, kind, numericQty, type, reason]);

  const title = item ? `Adjust Stock: ${item.name}` : 'Adjust Stock';

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ fontWeight: 800, opacity: 0.85 }}>
          Current: <span className="pink-text">{item ? item.quantity : '—'}</span>
          {item?.unit ? ` ${item.unit}` : ''}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button className={type === 'restock' ? 'btn-primary' : 'btn-secondary'} onClick={() => setType('restock')}>
            Restock (Add)
          </Button>
          <Button className={type === 'waste' ? 'btn-primary' : 'btn-secondary'} onClick={() => setType('waste')}>
            Waste (Subtract)
          </Button>
          <Button
            className={type === 'adjustment' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setType('adjustment')}
          >
            Manual Correction
          </Button>
        </div>

        <Input type="number" placeholder={kind === 'ingredient' ? 'Quantity (g/ml/pieces)' : 'Quantity (pcs)'} value={qty} onChange={(e) => setQty(e.target.value)} />
        <Input type="text" placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />

        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <Button className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>
            Cancel
          </Button>
          <Button
            className="btn-primary"
            onClick={() => onSave(body)}
            disabled={!item || !Number.isFinite(numericQty) || numericQty === 0}
            style={{ flex: 1 }}
          >
            Save Adjustment
          </Button>
        </div>
      </div>
    </Modal>
  );
}

