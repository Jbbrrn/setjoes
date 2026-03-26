import React from 'react';
import { formatPHP } from '../../utils/formatters';

export default function SummaryCards({ summary }) {
  const totalSales = Number(summary?.total_sales || 0);
  const totalOrders = Number(summary?.total_orders || 0);
  const avgOrder = Number(summary?.avg_order || 0);

  const cardStyle = {
    background: 'white',
    border: '2px solid #FFB6C1',
    borderRadius: 12,
    padding: 16,
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
  };

  const labelStyle = { opacity: 0.8, fontWeight: 800, marginBottom: 8 };
  const valueStyle = { fontSize: 28, fontWeight: 900 };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
      <div style={cardStyle}>
        <div style={labelStyle}>Today Sales</div>
        <div style={{ ...valueStyle }} className="pink-text">
          {formatPHP(totalSales)}
        </div>
      </div>
      <div style={cardStyle}>
        <div style={labelStyle}>Total Orders</div>
        <div style={valueStyle}>{totalOrders}</div>
      </div>
      <div style={cardStyle}>
        <div style={labelStyle}>Avg Order</div>
        <div style={{ ...valueStyle }} className="pink-text">
          {formatPHP(avgOrder)}
        </div>
      </div>
    </div>
  );
}

