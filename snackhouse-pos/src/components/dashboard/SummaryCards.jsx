import React from 'react';
import { formatPHP } from '../../utils/formatters';

export default function SummaryCards({ summary }) {
  const totalSales = Number(summary?.total_sales || 0);
  const totalCost = Number(summary?.total_cost || 0);
  const grossProfit = Number(summary?.gross_profit ?? totalSales - totalCost);
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
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 14
      }}
    >
      <div style={cardStyle}>
        <div style={labelStyle}>Sales (revenue)</div>
        <div style={{ ...valueStyle }} className="pink-text">
          {formatPHP(totalSales)}
        </div>
      </div>
      <div style={cardStyle}>
        <div style={labelStyle}>Cost of sales</div>
        <div style={valueStyle}>{formatPHP(totalCost)}</div>
      </div>
      <div style={cardStyle}>
        <div style={labelStyle}>Gross profit</div>
        <div style={{ ...valueStyle }} className="pink-text">
          {formatPHP(grossProfit)}
        </div>
      </div>
      <div style={cardStyle}>
        <div style={labelStyle}>Total orders</div>
        <div style={valueStyle}>{totalOrders}</div>
      </div>
      <div style={cardStyle}>
        <div style={labelStyle}>Avg order</div>
        <div style={{ ...valueStyle }} className="pink-text">
          {formatPHP(avgOrder)}
        </div>
      </div>
    </div>
  );
}

