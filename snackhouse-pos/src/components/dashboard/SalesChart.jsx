import React from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function SalesChart({ points }) {
  const normalized = (points || []).map((p) => ({
    day: String(p.day || '').slice(5),
    total_sales: Number(p.total_sales || 0)
  }));
  const maxValue = normalized.reduce((m, p) => Math.max(m, p.total_sales), 0);
  const yMax = maxValue <= 0 ? 100 : Math.ceil(maxValue * 1.15);
  const formatMoneyTick = (v) => {
    const n = Number(v || 0);
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(Math.round(n));
  };

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 10 }}>Sales (Last 7 Days)</div>
      <div style={{ width: '100%', height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={normalized}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis domain={[0, yMax]} tickFormatter={formatMoneyTick} width={56} />
            <Tooltip formatter={(value) => [`₱${Number(value || 0).toFixed(2)}`, 'Sales']} />
            <Bar dataKey="total_sales" fill="#FF69B4" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

