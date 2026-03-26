import React, { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatPHP } from '../../utils/formatters';

export default function PaymentBreakdown({ breakdown }) {
  const data = useMemo(() => {
    const cash = Number(breakdown?.cash || 0);
    const gcash = Number(breakdown?.gcash || 0);
    return [
      { name: 'Cash', value: cash },
      { name: 'GCash', value: gcash }
    ];
  }, [breakdown]);

  const total = data.reduce((a, d) => a + d.value, 0);

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 10 }}>Payment Method Breakdown</div>
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 14, alignItems: 'center' }}>
        <div style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" outerRadius={80} innerRadius={40}>
                <Cell fill="#FF69B4" />
                <Cell fill="#FFB6C1" />
              </Pie>
              <Tooltip formatter={(v) => formatPHP(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: 'grid', gap: 8, fontWeight: 800 }}>
          <div>
            Cash: <span className="pink-text">{formatPHP(data[0].value)}</span>{' '}
            <span style={{ opacity: 0.7 }}>
              ({total ? Math.round((data[0].value / total) * 100) : 0}%)
            </span>
          </div>
          <div>
            GCash: <span className="pink-text">{formatPHP(data[1].value)}</span>{' '}
            <span style={{ opacity: 0.7 }}>
              ({total ? Math.round((data[1].value / total) * 100) : 0}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

