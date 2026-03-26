import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import ProductList from '../components/menu/ProductList';

export default function Menu() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '',
    category_id: 1,
    base_price: '',
    product_type: 'made-to-order',
    image_url: ''
  });
  const [error, setError] = useState('');
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [recipeProduct, setRecipeProduct] = useState(null);
  const [ingredients, setIngredients] = useState([]);
  const [recipeItems, setRecipeItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const toIsActive = (value) => {
    if (value === true || value === 1 || value === '1' || value === 'true') return true;
    if (value === false || value === 0 || value === '0' || value === 'false' || value === null) return false;
    return true;
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await api.products.getAll({ include_inactive: true });
      setProducts(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    (async () => {
      try {
        const [ingRes, catRes] = await Promise.all([api.inventory.getIngredients(), api.categories.list()]);
        setIngredients(ingRes.data || []);
        setCategories(catRes.data || []);
      } catch (e) {
        // ignore and show empty recipe options
      }
    })();
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (products || []).filter((p) => {
      if (!q) return true;
      return String(p.name || '').toLowerCase().includes(q);
    });
  }, [products, query]);

  const toggleActive = async (p) => {
    try {
      setError('');
      await api.products.toggleActive(p.id);
      // Immediate UI update so badge/button reflect change even before refresh.
      setProducts((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, is_active: toIsActive(x.is_active) ? 0 : 1 } : x))
      );
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to change product status');
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      category_id: categories[0]?.id || 1,
      base_price: '',
      product_type: 'made-to-order',
      image_url: ''
    });
    setError('');
    setOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name || '',
      category_id: p.category_id,
      base_price: String(p.base_price ?? ''),
      product_type: p.product_type || 'made-to-order',
      image_url: p.image_url || ''
    });
    setError('');
    setOpen(true);
  };

  const onUpload = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      setForm((prev) => ({ ...prev, image_url: result }));
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    try {
      setError('');
      const payload = {
        name: form.name,
        category_id: Number(form.category_id),
        base_price: Number(form.base_price),
        product_type: form.product_type,
        image_url: form.image_url || null
      };
      if (editing) await api.products.update(editing.id, payload);
      else await api.products.create(payload);
      setOpen(false);
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to save product');
    }
  };

  const saveCategory = async () => {
    try {
      setError('');
      await api.categories.create({ name: newCategoryName.trim() });
      const res = await api.categories.list();
      setCategories(res.data || []);
      setCategoryOpen(false);
      setNewCategoryName('');
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to create category');
    }
  };

  const removeProduct = async (p) => {
    const ok = window.confirm(`Delete product "${p.name}" permanently?`);
    if (!ok) return;
    try {
      await api.products.remove(p.id);
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to delete product');
    }
  };

  const openRecipe = async (p) => {
    setRecipeProduct(p);
    try {
      const res = await api.products.getRecipe(p.id);
      const items = (res.data?.items || []).map((it) => ({
        ingredient_id: Number(it.ingredient_id),
        quantity: String(it.quantity)
      }));
      setRecipeItems(items.length ? items : [{ ingredient_id: ingredients[0]?.id || '', quantity: '' }]);
    } catch (e) {
      setRecipeItems([{ ingredient_id: ingredients[0]?.id || '', quantity: '' }]);
    }
    setRecipeOpen(true);
  };

  const saveRecipe = async () => {
    if (!recipeProduct) return;
    try {
      setError('');
      await api.products.saveRecipe(recipeProduct.id, {
        items: recipeItems
          .filter((it) => Number(it.ingredient_id) && Number(it.quantity) > 0)
          .map((it) => ({ ingredient_id: Number(it.ingredient_id), quantity: Number(it.quantity) }))
      });
      setRecipeOpen(false);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to save recipe');
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ fontSize: 26, fontWeight: 800 }} className="pink-text">
          Menu Management
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button className="btn-secondary" onClick={openCreate}>
            + Add Product
          </Button>
          <Button className="btn-secondary" onClick={() => setCategoryOpen(true)}>
            + Add Category
          </Button>
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
        <input className="input" style={{ maxWidth: 360 }} placeholder="Search products…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Button className="btn-secondary" onClick={refresh}>
          Refresh
        </Button>
      </div>
      {error ? <div className="card error-text" style={{ marginBottom: 12 }}>{error}</div> : null}

      {loading ? (
        <div className="card">Loading products…</div>
      ) : (
        <ProductList
          products={visible}
          onEdit={openEdit}
          onDeactivate={toggleActive}
          onDelete={removeProduct}
          onRecipe={openRecipe}
        />
      )}

      <Modal open={open} title={editing ? `Edit Product: ${editing.name}` : 'Add Product'} onClose={() => setOpen(false)}>
        <div style={{ display: 'grid', gap: 10 }}>
          <Input placeholder="Product name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <select className="input" value={form.category_id} onChange={(e) => setForm((p) => ({ ...p, category_id: Number(e.target.value) }))}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select className="input" value={form.product_type} onChange={(e) => setForm((p) => ({ ...p, product_type: e.target.value }))}>
            <option value="made-to-order">made-to-order</option>
            <option value="finished-goods">finished-goods</option>
          </select>
          <Input type="number" placeholder="Base price" value={form.base_price} onChange={(e) => setForm((p) => ({ ...p, base_price: e.target.value }))} />
          <Input
            placeholder="Image URL (optional)"
            value={form.image_url.startsWith('data:') ? '' : form.image_url}
            onChange={(e) => setForm((p) => ({ ...p, image_url: e.target.value }))}
          />
          <input className="input" type="file" accept="image/*" onChange={(e) => onUpload(e.target.files?.[0])} />
          {form.image_url ? (
            <img src={form.image_url} alt="preview" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 12, border: '1px solid #f1d6de' }} />
          ) : null}
          <div style={{ display: 'flex', gap: 10 }}>
            <Button className="btn-secondary" style={{ flex: 1 }} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="btn-primary" style={{ flex: 1 }} onClick={save}>
              Save Product
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={recipeOpen}
        title={recipeProduct ? `Recipe: ${recipeProduct.name}` : 'Recipe'}
        onClose={() => setRecipeOpen(false)}
      >
        {recipeProduct?.product_type !== 'made-to-order' ? (
          <div className="error-text">Only made-to-order products use ingredient recipes.</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {recipeItems.map((it, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr auto', gap: 8 }}>
                <select
                  className="input"
                  value={it.ingredient_id}
                  onChange={(e) =>
                    setRecipeItems((prev) =>
                      prev.map((row, i) => (i === idx ? { ...row, ingredient_id: Number(e.target.value) } : row))
                    )
                  }
                >
                  <option value="">Select ingredient</option>
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.unit})
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  placeholder="Qty"
                  value={it.quantity}
                  onChange={(e) =>
                    setRecipeItems((prev) =>
                      prev.map((row, i) => (i === idx ? { ...row, quantity: e.target.value } : row))
                    )
                  }
                />
                <Button
                  className="btn-danger"
                  onClick={() => setRecipeItems((prev) => prev.filter((_, i) => i !== idx))}
                  style={{ minWidth: 56 }}
                >
                  X
                </Button>
              </div>
            ))}
            <Button
              className="btn-secondary"
              onClick={() => setRecipeItems((prev) => [...prev, { ingredient_id: ingredients[0]?.id || '', quantity: '' }])}
            >
              + Add Ingredient
            </Button>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button className="btn-secondary" style={{ flex: 1 }} onClick={() => setRecipeOpen(false)}>
                Cancel
              </Button>
              <Button className="btn-primary" style={{ flex: 1 }} onClick={saveRecipe}>
                Save Recipe
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={categoryOpen} title="Add Category" onClose={() => setCategoryOpen(false)}>
        <div style={{ display: 'grid', gap: 10 }}>
          <Input placeholder="Category name" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
          <div style={{ display: 'flex', gap: 10 }}>
            <Button className="btn-secondary" style={{ flex: 1 }} onClick={() => setCategoryOpen(false)}>
              Cancel
            </Button>
            <Button className="btn-primary" style={{ flex: 1 }} onClick={saveCategory} disabled={!newCategoryName.trim()}>
              Save Category
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

