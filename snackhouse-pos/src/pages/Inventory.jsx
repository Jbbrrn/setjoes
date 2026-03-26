import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/common/Button';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import InventoryCard from '../components/inventory/InventoryCard';
import StockAdjustModal from '../components/inventory/StockAdjustModal';

export default function Inventory() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState('ingredients');
  const [query, setQuery] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [ingredients, setIngredients] = useState([]);
  const [finishedGoods, setFinishedGoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState(null);
  const [adjustKind, setAdjustKind] = useState('ingredient');

  const refresh = async () => {
    setLoading(true);
    try {
      const [ing, fg] = await Promise.all([api.inventory.getIngredients(), api.inventory.getFinishedGoods()]);
      setIngredients(ing.data || []);
      setFinishedGoods(fg.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = tab === 'ingredients' ? ingredients : finishedGoods;
    return base.filter((x) => {
      const name = String(x.name || '').toLowerCase();
      if (q && !name.includes(q)) return false;
      if (lowOnly) {
        const level = Number(x.reorder_level || 0);
        const qty = Number(x.quantity || 0);
        return qty <= level;
      }
      return true;
    });
  }, [tab, ingredients, finishedGoods, query, lowOnly]);

  const openAdjust = (item) => {
    setAdjustItem(item);
    setAdjustKind(tab === 'ingredients' ? 'ingredient' : 'product');
    setAdjustOpen(true);
  };

  const saveAdjust = async (body) => {
    await api.inventory.adjustStock(body);
    setAdjustOpen(false);
    setAdjustItem(null);
    await refresh();
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ fontSize: 26, fontWeight: 800 }} className="pink-text">
          Inventory Management
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button className="btn-secondary" onClick={() => navigate('/dashboard')}>
            Dashboard
          </Button>
          <Button className="btn-secondary" onClick={() => navigate('/pos')}>
            POS
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

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <Button className={tab === 'ingredients' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab('ingredients')}>
          Ingredients
        </Button>
        <Button className={tab === 'finished' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab('finished')}>
          Finished Goods
        </Button>
        <Button className={lowOnly ? 'btn-primary' : 'btn-secondary'} onClick={() => setLowOnly((v) => !v)}>
          Low Stock Only
        </Button>
        <input
          className="input"
          style={{ maxWidth: 340 }}
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button className="btn-secondary" onClick={refresh}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="card">Loading inventory…</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {list.map((it) => {
            const qty = Number(it.quantity || 0);
            const cap = Number(it.max_capacity || 0);
            const progress = cap ? Math.round((qty / cap) * 100) : null;
            const level = Number(it.reorder_level || 0);
            const badge =
              level && qty <= level
                ? { text: 'LOW STOCK', color: qty <= 0 ? '#FC8181' : '#ED8936' }
                : null;
            const subtitle =
              tab === 'ingredients'
                ? `Stock: ${qty}${it.unit || ''} / ${cap || '—'}${it.unit || ''}  •  Cost: ₱${Number(it.cost_per_unit || 0).toFixed(4)}/${it.unit || ''}`
                : `Stock: ${qty} pcs  •  Reorder level: ${level}`;
            return (
              <InventoryCard
                key={it.id}
                title={it.name}
                subtitle={subtitle}
                progress={tab === 'ingredients' ? progress : null}
                badge={badge}
                onAdjust={() => openAdjust(it)}
              />
            );
          })}
        </div>
      )}

      <StockAdjustModal
        open={adjustOpen}
        item={adjustItem}
        kind={adjustKind}
        onClose={() => setAdjustOpen(false)}
        onSave={saveAdjust}
      />
    </div>
  );
}

