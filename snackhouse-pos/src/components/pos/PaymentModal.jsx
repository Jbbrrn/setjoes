import React, { useMemo, useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import { formatPHP } from '../../utils/formatters';

export default function PaymentModal({ open, total, onCancel, onConfirm }) {
  const [method, setMethod] = useState('cash');
  const [amount, setAmount] = useState('');

  const amountNum = useMemo(() => Number(amount || 0), [amount]);
  const change = useMemo(() => Math.max(0, amountNum - Number(total || 0)), [amountNum, total]);
  const canConfirm = amountNum >= Number(total || 0) && Number(total || 0) > 0;

  return (
    <Modal open={open} title="Payment" onClose={onCancel}>
      <div style={{ fontSize: 34, fontWeight: 900, marginBottom: 14 }} className="pink-text">
        {formatPHP(total)}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <Button
          className={method === 'cash' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setMethod('cash')}
          style={{ flex: 1 }}
        >
          Cash
        </Button>
        <Button
          className={method === 'gcash' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setMethod('gcash')}
          style={{ flex: 1 }}
        >
          GCash
        </Button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <Input
          type="number"
          placeholder="Amount Received"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoFocus
        />
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <Button className="btn-secondary" onClick={() => setAmount(String(500))} style={{ flex: 1 }}>
          ₱500
        </Button>
        <Button className="btn-secondary" onClick={() => setAmount(String(1000))} style={{ flex: 1 }}>
          ₱1000
        </Button>
      </div>

      <div style={{ fontWeight: 800, marginBottom: 18 }}>
        Change: <span className="pink-text">{formatPHP(change)}</span>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <Button className="btn-secondary" onClick={onCancel} style={{ flex: 1 }}>
          Cancel
        </Button>
        <Button
          className="btn-primary"
          onClick={() => onConfirm({ payment_method: method, amount_paid: amountNum })}
          disabled={!canConfirm}
          style={{ flex: 1 }}
        >
          Confirm Sale
        </Button>
      </div>
    </Modal>
  );
}

