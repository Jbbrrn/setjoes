import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/common/Button';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import SummaryCards from '../components/dashboard/SummaryCards';
import TopProducts from '../components/dashboard/TopProducts';
import PaymentBreakdown from '../components/dashboard/PaymentBreakdown';
import { formatPHP } from '../utils/formatters';

export default function Dashboard() {
  const { employee, logout } = useAuth();
  const navigate = useNavigate();

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('en-PH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      }).format(new Date()),
    []
  );
  const [summary, setSummary] = useState(null);
  const [chartPoints, setChartPoints] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('daily');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const now = new Date();
        const end = now.toISOString().slice(0, 10);
        const start = new Date(now);
        if (range === 'weekly') start.setDate(now.getDate() - 6);
        else if (range === 'monthly') start.setDate(now.getDate() - 29);
        const startDate = start.toISOString().slice(0, 10);
        const [s, c, t, p] = await Promise.all([
          api.reports.getSummary(range === 'daily' ? today : null, range),
          api.reports.getSalesChart(startDate, end),
          api.reports.getTopProducts(range === 'daily' ? today : null, 10, range),
          api.reports.getPaymentBreakdown(range === 'daily' ? today : null, range)
        ]);
        if (!alive) return;
        setSummary(s.data);
        setChartPoints(c.data?.points || []);
        setTopProducts(t.data?.items || []);
        setPaymentBreakdown(p.data);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [today, range]);

  const exportCsv = async () => {
    const start = today;
    const end = today;
    const res = await api.reports.exportCSV(start, end);
    const blob = new Blob([res.data], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snackhouse_export_${start}_to_${end}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: 20 }}>
      <div className="header-row" style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 26, fontWeight: 800 }} className="pink-text">
          Sales Dashboard
        </div>
        <div className="actions-row" style={{ alignItems: 'center' }}>
          <div style={{ fontWeight: 700 }}>
            Today: <span className="pink-text">{todayLabel}</span>
          </div>
          <div style={{ fontWeight: 700 }}>
            Manager: <span className="pink-text">{employee?.full_name || '—'}</span>
          </div>
          <Button className="btn-secondary" onClick={() => navigate('/pos')}>
            POS
          </Button>
          <Button className="btn-secondary" onClick={() => navigate('/inventory')}>
            Inventory
          </Button>
          <Button className="btn-secondary" onClick={() => navigate('/menu')}>
            Menu
          </Button>
          <Button className="btn-secondary" onClick={() => navigate('/users')}>
            Users
          </Button>
          <Button
            className="btn-danger"
            onClick={() => {
              logout();
              navigate('/', { replace: true });
            }}
          >
            Logout
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="card">Loading reports…</div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Button className={range === 'daily' ? 'btn-primary' : 'btn-secondary'} onClick={() => setRange('daily')}>
              Daily
            </Button>
            <Button className={range === 'weekly' ? 'btn-primary' : 'btn-secondary'} onClick={() => setRange('weekly')}>
              Weekly
            </Button>
            <Button className={range === 'monthly' ? 'btn-primary' : 'btn-secondary'} onClick={() => setRange('monthly')}>
              Monthly
            </Button>
          </div>
          <SummaryCards summary={summary} />
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>Today's Sales Summary</div>
            <div style={{ opacity: 0.9, lineHeight: 1.6 }}>
              Today, the store has recorded <strong>{Number(summary?.total_orders || 0)}</strong>{' '}
              {Number(summary?.total_orders || 0) === 1 ? 'order' : 'orders'} with total sales of{' '}
              <strong>{formatPHP(summary?.total_sales || 0)}</strong>. The average order value is{' '}
              <strong>{formatPHP(summary?.avg_order || 0)}</strong>.
            </div>
          </div>
          <div className="two-col-grid">
            <TopProducts items={topProducts} />
            <PaymentBreakdown breakdown={paymentBreakdown} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button className="btn-secondary" onClick={exportCsv}>
              Export CSV (Today)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

