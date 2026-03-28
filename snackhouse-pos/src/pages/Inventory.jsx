import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import Input from '../components/common/Input';
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
  const [error, setError] = useState('');
  const [ingredientModalOpen, setIngredientModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState(null);
  const [ingredientForm, setIngredientForm] = useState({
    name: '',
    unit: 'grams',
    cost_per_unit: '',
    servings_per_unit: '1',
    supplier_name: '',
    reorder_level: '0',
    quantity: '0',
    max_capacity: '10000'
  });

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
    try {
      setError('');
      await api.inventory.adjustStock(body);
      setAdjustOpen(false);
      setAdjustItem(null);
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to adjust stock');
    }
  };

  const openAddIngredient = () => {
    setEditingIngredient(null);
    setIngredientForm({
      name: '',
      unit: 'grams',
      cost_per_unit: '',
      servings_per_unit: '1',
      supplier_name: '',
      reorder_level: '0',
      quantity: '0',
      max_capacity: '10000'
    });
    setIngredientModalOpen(true);
  };

  const openEditIngredient = (item) => {
    setEditingIngredient(item);
    setIngredientForm({
      name: item.name || '',
      unit: item.unit || 'grams',
      cost_per_unit: String(item.cost_per_unit ?? ''),
      servings_per_unit: String(item.servings_per_unit ?? 1),
      supplier_name: item.supplier_name || '',
      reorder_level: String(item.reorder_level ?? 0),
      quantity: String(item.quantity ?? 0),
      max_capacity: String(item.max_capacity ?? 10000)
    });
    setIngredientModalOpen(true);
  };

  const saveIngredient = async () => {
    try {
      setError('');
      const payload = {
        name: ingredientForm.name,
        unit: ingredientForm.unit,
        cost_per_unit: Number(ingredientForm.cost_per_unit),
        servings_per_unit: Number(ingredientForm.servings_per_unit),
        supplier_name: ingredientForm.supplier_name || null,
        reorder_level: Number(ingredientForm.reorder_level),
        quantity: Number(ingredientForm.quantity),
        max_capacity: Number(ingredientForm.max_capacity)
      };
      if (editingIngredient) await api.inventory.updateIngredient(editingIngredient.id, payload);
      else await api.inventory.createIngredient(payload);
      setIngredientModalOpen(false);
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to save ingredient');
    }
  };

  const deleteIngredient = async (item) => {
    const ok = window.confirm(`Delete ingredient "${item.name}" permanently?`);
    if (!ok) return;
    try {
      setError('');
      await api.inventory.removeIngredient(item.id);
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to delete ingredient');
    }
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
        {tab === 'ingredients' ? (
          <Button className="btn-secondary" onClick={openAddIngredient}>
            + Add Ingredient
          </Button>
        ) : null}
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
      {error ? <div className="card error-text" style={{ marginBottom: 12 }}>{error}</div> : null}

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
                : `Stock: ${qty} pcs  •  Reorder level: ${level}${
                    it.cost_price != null && it.cost_price !== ''
                      ? `  •  Cost: ₱${Number(it.cost_price).toFixed(2)}`
                      : ''
                  }  •  Price: ₱${Number(it.base_price || 0).toFixed(2)}${it.variants ? `  •  Variants: ${it.variants}` : ''}`;
            return (
              <InventoryCard
                key={it.id}
                title={it.name}
                subtitle={subtitle}
                progress={tab === 'ingredients' ? progress : null}
                badge={badge}
                onAdjust={() => openAdjust(it)}
                onEdit={tab === 'ingredients' ? () => openEditIngredient(it) : null}
                onDelete={tab === 'ingredients' ? () => deleteIngredient(it) : null}
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

      <Modal
        open={ingredientModalOpen}
        title={editingIngredient ? `Edit Ingredient: ${editingIngredient.name}` : 'Add Ingredient'}
        onClose={() => setIngredientModalOpen(false)}
      >
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Ingredient name (example: Kikiam)</div>
          <Input placeholder="e.g. Kikiam" value={ingredientForm.name} onChange={(e) => setIngredientForm((p) => ({ ...p, name: e.target.value }))} />
          <div style={{ fontSize: 12, opacity: 0.75 }}>Unit of measurement</div>
          <Input placeholder="e.g. pack, grams, ml, pcs" value={ingredientForm.unit} onChange={(e) => setIngredientForm((p) => ({ ...p, unit: e.target.value }))} />
          <div style={{ fontSize: 12, opacity: 0.75 }}>Cost per unit</div>
          <Input type="number" placeholder="e.g. 10.50" value={ingredientForm.cost_per_unit} onChange={(e) => setIngredientForm((p) => ({ ...p, cost_per_unit: e.target.value }))} />
          <div style={{ fontSize: 12, opacity: 0.75 }}>Servings per unit (how many pieces one unit makes)</div>
          <Input type="number" placeholder="e.g. 6 (if 1 pack = 6 buns)" value={ingredientForm.servings_per_unit} onChange={(e) => setIngredientForm((p) => ({ ...p, servings_per_unit: e.target.value }))} />
          <div style={{ fontSize: 12, opacity: 0.75 }}>Supplier name (optional)</div>
          <Input placeholder="e.g. Local Market Supplier" value={ingredientForm.supplier_name} onChange={(e) => setIngredientForm((p) => ({ ...p, supplier_name: e.target.value }))} />
          <div style={{ fontSize: 12, opacity: 0.75 }}>Reorder level (low stock threshold)</div>
          <Input type="number" placeholder="e.g. 100" value={ingredientForm.reorder_level} onChange={(e) => setIngredientForm((p) => ({ ...p, reorder_level: e.target.value }))} />
          <div style={{ fontSize: 12, opacity: 0.75 }}>Current quantity</div>
          <Input type="number" placeholder="e.g. 0" value={ingredientForm.quantity} onChange={(e) => setIngredientForm((p) => ({ ...p, quantity: e.target.value }))} />
          <div style={{ fontSize: 12, opacity: 0.75 }}>Maximum storage capacity</div>
          <Input type="number" placeholder="e.g. 10000" value={ingredientForm.max_capacity} onChange={(e) => setIngredientForm((p) => ({ ...p, max_capacity: e.target.value }))} />
          <div style={{ display: 'flex', gap: 10 }}>
            <Button className="btn-secondary" style={{ flex: 1 }} onClick={() => setIngredientModalOpen(false)}>
              Cancel
            </Button>
            <Button
              className="btn-primary"
              style={{ flex: 1 }}
              onClick={saveIngredient}
              disabled={!ingredientForm.name.trim() || !ingredientForm.unit.trim()}
            >
              Save Ingredient
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

