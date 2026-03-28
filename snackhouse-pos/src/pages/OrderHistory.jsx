import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { formatPHP } from '../utils/formatters';

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

export default function OrderHistory() {
  const { employee, logout } = useAuth();
  const navigate = useNavigate();
  const isManager = employee?.role === 'manager';

  const [startDate, setStartDate] = useState(todayYmd);
  const [endDate, setEndDate] = useState(todayYmd);
  const [paymentMethod, setPaymentMethod] = useState('all');
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { payment_method: paymentMethod };
      if (isManager) {
        params.start_date = startDate;
        params.end_date = endDate;
      }
      const res = await api.orders.listHistory(params);
      setOrders(res.data?.orders || []);
      setSummary(res.data?.summary || null);
      setMeta(res.data?.meta || null);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to load orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [isManager, startDate, endDate, paymentMethod]);

  useEffect(() => {
    load();
  }, [load]);

  const periodLabel = useMemo(() => {
    if (!meta) return '';
    if (meta.view === 'today') return `Today (${meta.start_date})`;
    return `${meta.start_date} → ${meta.end_date}`;
  }, [meta]);

  const voidOrder = async (o) => {
    if (o.status !== 'completed') return;
    const ok = window.confirm(
      `Cancel sale ${o.order_number}? Inventory from this sale will be restocked. Manager action only.`
    );
    if (!ok) return;
    try {
      setError('');
      await api.orders.voidOrder(o.id);
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to cancel order');
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontSize: 26, fontWeight: 800 }} className="pink-text">
          Order History
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontWeight: 700 }}>{employee?.full_name}</span>
          <Button className="btn-secondary" onClick={() => navigate('/pos')}>
            POS
          </Button>
          {isManager ? (
            <>
              <Button className="btn-secondary" onClick={() => navigate('/dashboard')}>
                Dashboard
              </Button>
              <Button className="btn-secondary" onClick={() => navigate('/menu')}>
                Menu
              </Button>
            </>
          ) : null}
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

      <div className="card" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          {isManager ? (
            <>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>From</div>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>To</div>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </>
          ) : (
            <div style={{ fontWeight: 700, opacity: 0.9 }}>Showing today&apos;s sales only</div>
          )}
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 4 }}>Payment</div>
            <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="all">All</option>
              <option value="cash">Cash</option>
              <option value="gcash">GCash</option>
            </select>
          </div>
          <Button className="btn-primary" onClick={load} disabled={loading}>
            Apply
          </Button>
        </div>
      </div>

      {error ? <div className="card error-text" style={{ marginBottom: 12 }}>{error}</div> : null}

      {summary ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 12,
            marginBottom: 14
          }}
        >
          <div className="card" style={{ padding: 12 }}>
            <div style={{ opacity: 0.8, fontWeight: 800, fontSize: 12 }}>Period</div>
            <div style={{ fontWeight: 900, marginTop: 4 }}>{periodLabel}</div>
          </div>
          <div className="card" style={{ padding: 12 }}>
            <div style={{ opacity: 0.8, fontWeight: 800, fontSize: 12 }}>Completed sales total</div>
            <div className="pink-text" style={{ fontWeight: 900, marginTop: 4 }}>
              {formatPHP(summary.total_sales)}
            </div>
          </div>
          <div className="card" style={{ padding: 12 }}>
            <div style={{ opacity: 0.8, fontWeight: 800, fontSize: 12 }}>Cash (completed)</div>
            <div style={{ fontWeight: 900, marginTop: 4 }}>{formatPHP(summary.cash_total)}</div>
          </div>
          <div className="card" style={{ padding: 12 }}>
            <div style={{ opacity: 0.8, fontWeight: 800, fontSize: 12 }}>GCash (completed)</div>
            <div style={{ fontWeight: 900, marginTop: 4 }}>{formatPHP(summary.gcash_total)}</div>
          </div>
          <div className="card" style={{ padding: 12 }}>
            <div style={{ opacity: 0.8, fontWeight: 800, fontSize: 12 }}>Rows</div>
            <div style={{ fontWeight: 900, marginTop: 4 }}>{summary.order_count}</div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="card">Loading…</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {(orders || []).length === 0 ? (
            <div className="card">No orders in this view.</div>
          ) : (
            orders.map((o) => (
              <div
                key={o.id}
                className="card"
                style={{
                  padding: 14,
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 12,
                  alignItems: 'center',
                  opacity: o.status === 'voided' ? 0.75 : 1
                }}
              >
                <div>
                  <div style={{ fontWeight: 900 }}>
                    {o.order_number}{' '}
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: o.status === 'completed' ? '#48BB78' : '#A0AEC0',
                        color: 'white'
                      }}
                    >
                      {o.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
                    {new Date(o.created_at).toLocaleString()} · {o.cashier_name} ·{' '}
                    {(o.payment_method || '—').toUpperCase()}
                  </div>
                  <div className="pink-text" style={{ fontWeight: 900, marginTop: 6 }}>
                    {formatPHP(o.total_amount)}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch' }}>
                  {isManager && o.status === 'completed' ? (
                    <Button className="btn-danger" onClick={() => voidOrder(o)}>
                      Cancel sale &amp; restock
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
