import React from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { formatPHP } from '../../utils/formatters';

export default function ReceiptPreview({ open, receipt, onNewOrder, onPrint, onClose }) {
  if (!receipt) return null;

  return (
    <Modal open={open} title="Receipt Preview" onClose={onClose}>
      <div
        style={{
          border: '2px dashed #FFB6C1',
          borderRadius: 12,
          padding: 16,
          background: '#fff'
        }}
      >
        <div style={{ textAlign: 'center', fontWeight: 900, marginBottom: 10 }}>SNACKHOUSE RECEIPT</div>
        <div style={{ fontSize: 14, opacity: 0.85, marginBottom: 10 }}>
          <div>Date: {new Date(receipt.created_at).toLocaleString()}</div>
          <div>Order: {receipt.order_number}</div>
          <div>Cashier: {receipt.cashier_name || '—'}</div>
        </div>

        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 10, marginTop: 10 }}>
          {receipt.items.map((it) => (
            <div key={it.product_id + ':' + (it.variant_id || '')} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontWeight: 700 }}>
                {it.quantity}x {it.product_name}
                {it.variant_name ? <span style={{ opacity: 0.75 }}> ({it.variant_name})</span> : null}
              </div>
              <div style={{ fontWeight: 800 }}>{formatPHP(it.subtotal)}</div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 10, marginTop: 10, fontSize: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <div>Subtotal:</div>
            <div>{formatPHP(receipt.subtotal)}</div>
          </div>
          {/* VAT intentionally omitted */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 18 }}>
            <div>TOTAL:</div>
            <div className="pink-text">{formatPHP(receipt.total_amount)}</div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 10, marginTop: 10, fontSize: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <div>Paid ({receipt.payment.payment_method}):</div>
            <div>{formatPHP(receipt.payment.amount_paid)}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <div>Change:</div>
            <div className="pink-text" style={{ fontWeight: 900 }}>
              {formatPHP(receipt.payment.change_given)}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 14, fontWeight: 800, opacity: 0.85 }}>
          Thank you! Come again!
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <Button className="btn-secondary" onClick={onPrint} style={{ flex: 1 }}>
          Print Receipt
        </Button>
        <Button className="btn-primary" onClick={onNewOrder} style={{ flex: 1 }}>
          New Order
        </Button>
      </div>
    </Modal>
  );
}

