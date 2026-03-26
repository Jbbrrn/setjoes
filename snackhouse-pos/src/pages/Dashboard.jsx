import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/common/Button';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import SummaryCards from '../components/dashboard/SummaryCards';
import SalesChart from '../components/dashboard/SalesChart';
import TopProducts from '../components/dashboard/TopProducts';
import PaymentBreakdown from '../components/dashboard/PaymentBreakdown';

export default function Dashboard() {
  const { employee, logout } = useAuth();
  const navigate = useNavigate();

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [summary, setSummary] = useState(null);
  const [chartPoints, setChartPoints] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const [s, c, t, p] = await Promise.all([
          api.reports.getSummary(today),
          api.reports.getSalesChart(
            new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            today
          ),
          api.reports.getTopProducts(today, 10),
          api.reports.getPaymentBreakdown(today)
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
  }, [today]);

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ fontSize: 26, fontWeight: 800 }} className="pink-text">
          Sales Dashboard
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
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
          <SummaryCards summary={summary} />
          <SalesChart points={chartPoints} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
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

