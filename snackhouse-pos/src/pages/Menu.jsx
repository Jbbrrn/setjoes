import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
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
    cost_price: '',
    product_type: 'made-to-order',
    image_url: ''
  });
  const [error, setError] = useState('');
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [recipeProduct, setRecipeProduct] = useState(null);
  const [ingredients, setIngredients] = useState([]);
  const [recipeItems, setRecipeItems] = useState([]);
  const [recipeVariantId, setRecipeVariantId] = useState('');
  const [categories, setCategories] = useState([]);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryFilterId, setCategoryFilterId] = useState(null);
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const [categoryRows, setCategoryRows] = useState([]);
  const categoryRowsRef = useRef([]);
  const manageCategoriesWasOpen = useRef(false);
  const [categoryManageError, setCategoryManageError] = useState('');
  const [categorySavingId, setCategorySavingId] = useState(null);
  const [variantsOpen, setVariantsOpen] = useState(false);
  const [variantsProduct, setVariantsProduct] = useState(null);
  const [variants, setVariants] = useState([]);
  const [newVariant, setNewVariant] = useState({ variant_name: '', price: '' });
  const [variantError, setVariantError] = useState('');

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

  const reloadCategories = useCallback(async () => {
    const res = await api.categories.list();
    setCategories(res.data || []);
  }, []);

  const catalogSections = useMemo(() => {
    if (categoryFilterId != null) {
      const cat = categories.find((c) => Number(c.id) === Number(categoryFilterId));
      const prods = visible.filter((p) => Number(p.category_id) === Number(categoryFilterId));
      if (!prods.length) return [];
      if (!cat) return [{ category: { id: categoryFilterId, name: `Category #${categoryFilterId}` }, products: prods }];
      return [{ category: cat, products: prods }];
    }
    const byCat = new Map();
    for (const p of visible) {
      const cid = Number(p.category_id);
      if (!byCat.has(cid)) byCat.set(cid, []);
      byCat.get(cid).push(p);
    }
    const ordered = [];
    for (const c of categories) {
      const prods = byCat.get(Number(c.id));
      if (prods?.length) ordered.push({ category: c, products: prods });
    }
    for (const [cid, prods] of byCat) {
      if (!categories.some((c) => Number(c.id) === cid)) {
        ordered.push({ category: { id: cid, name: `Category #${cid}` }, products: prods });
      }
    }
    return ordered;
  }, [visible, categories, categoryFilterId]);

  useEffect(() => {
    categoryRowsRef.current = categoryRows;
  }, [categoryRows]);

  useEffect(() => {
    if (!manageCategoriesOpen) {
      manageCategoriesWasOpen.current = false;
      return;
    }
    const seed = () =>
      categories.map((c) => ({ id: c.id, name: c.name, display_order: c.display_order ?? 0 }));
    if (!manageCategoriesWasOpen.current) {
      manageCategoriesWasOpen.current = true;
      setCategoryManageError('');
      setCategoryRows(seed());
      return;
    }
    setCategoryRows((prev) =>
      prev.length === 0 && categories.length > 0 ? seed() : prev
    );
  }, [manageCategoriesOpen, categories]);

  const recipePreviewCost = useMemo(() => {
    if (!recipeOpen || !recipeProduct || recipeProduct.product_type !== 'made-to-order') return null;
    let sum = 0;
    let any = false;
    for (const it of recipeItems) {
      const ing = ingredients.find((i) => i.id === Number(it.ingredient_id));
      const qty = Number(it.quantity);
      if (ing && qty > 0 && Number.isFinite(Number(ing.cost_per_unit))) {
        sum += qty * Number(ing.cost_per_unit);
        any = true;
      }
    }
    return any ? Math.round(sum * 100) / 100 : null;
  }, [recipeOpen, recipeProduct, recipeItems, ingredients]);

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
      cost_price: '',
      product_type: 'made-to-order',
      image_url: ''
    });
    setError('');
    setVariantsProduct(null);
    setVariants([]);
    setNewVariant({ variant_name: '', price: '' });
    setOpen(true);
  };

  const openEdit = async (p) => {
    setEditing(p);
    setForm({
      name: p.name || '',
      category_id: p.category_id,
      base_price: String(p.base_price ?? ''),
      cost_price:
        p.product_type === 'finished-goods' && p.cost_price != null && p.cost_price !== ''
          ? String(p.cost_price)
          : '',
      product_type: p.product_type || 'made-to-order',
      image_url: p.image_url || ''
    });
    setError('');
    setVariantsProduct(p);
    try {
      const res = await api.products.listVariants(p.id);
      setVariants(res.data || []);
    } catch (e) {
      setVariants([]);
      setError(e?.response?.data?.error || 'Failed to load variants');
    }
    setNewVariant({ variant_name: '', price: '' });
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
      if (form.product_type === 'finished-goods') {
        const cp = String(form.cost_price ?? '').trim();
        if (cp !== '') {
          if (!Number.isFinite(Number(form.cost_price)) || Number(form.cost_price) < 0) {
            setError('Cost price must be ≥ 0, or leave blank.');
            return;
          }
          payload.cost_price = Number(form.cost_price);
        } else if (editing) {
          payload.cost_price = null;
        }
      }
      if (editing) await api.products.update(editing.id, payload);
      else await api.products.create(payload);
      setOpen(false);
      await refresh();
    } catch (e) {
      const msg = e?.response?.data?.error;
      setError(msg || (editing ? 'Failed to update product' : 'Failed to create product'));
    }
  };

  const saveCategory = async () => {
    try {
      setError('');
      await api.categories.create({ name: newCategoryName.trim() });
      await reloadCategories();
      setCategoryOpen(false);
      setNewCategoryName('');
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to create category');
    }
  };

  const saveCategoryRow = async (rowId) => {
    const id = Number(rowId);
    setCategoryManageError('');
    setError('');
    if (!Number.isFinite(id) || id <= 0) {
      setCategoryManageError('Invalid category id.');
      return;
    }
    const row = categoryRowsRef.current.find((r) => Number(r.id) === id);
    if (!row) {
      setCategoryManageError('Could not read this row. Close and reopen Edit categories, then try again.');
      return;
    }
    const name = String(row.name || '').trim();
    if (!name) {
      setCategoryManageError('Category name cannot be empty.');
      return;
    }
    const rawOrder = row.display_order;
    const parsedOrder =
      rawOrder === '' || rawOrder == null ? 0 : Number(rawOrder);
    const display_order = Number.isFinite(parsedOrder) ? parsedOrder : 0;
    try {
      setCategorySavingId(id);
      await api.categories.update(id, { name, display_order });
      await reloadCategories();
    } catch (e) {
      const msg =
        e?.response?.data?.error ||
        (e?.response?.status === 403 ? 'Manager access required to change categories.' : null) ||
        e?.message ||
        'Failed to update category';
      setCategoryManageError(msg);
    } finally {
      setCategorySavingId(null);
    }
  };

  const deleteCategoryRow = async (id) => {
    const ok = window.confirm('Delete this category? Products must be moved or removed first.');
    if (!ok) return;
    try {
      setCategoryManageError('');
      setError('');
      setCategorySavingId(Number(id));
      await api.categories.remove(id);
      await reloadCategories();
      if (categoryFilterId != null && Number(categoryFilterId) === Number(id)) setCategoryFilterId(null);
      setCategoryRows((prev) => prev.filter((r) => Number(r.id) !== Number(id)));
    } catch (e) {
      const msg =
        e?.response?.data?.error ||
        (e?.response?.status === 403 ? 'Manager access required to delete categories.' : null) ||
        e?.message ||
        'Failed to delete category';
      setCategoryManageError(msg);
    } finally {
      setCategorySavingId(null);
    }
  };

  const removeProduct = async (p) => {
    const ok = window.confirm(
      `Are you sure you want to delete "${p.name}"?\n\nThis will permanently delete the product if allowed.`
    );
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
    setRecipeVariantId('');
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

  const copyDefaultRecipeIntoForm = async () => {
    if (!recipeProduct) return;
    try {
      setError('');
      const res = await api.products.getRecipe(recipeProduct.id);
      const items = (res.data?.items || []).map((it) => ({
        ingredient_id: Number(it.ingredient_id),
        quantity: String(it.quantity)
      }));
      setRecipeItems(items.length ? items : [{ ingredient_id: ingredients[0]?.id || '', quantity: '' }]);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to load default recipe');
    }
  };

  const saveRecipe = async () => {
    if (!recipeProduct) return;
    try {
      setError('');
      await api.products.saveRecipe(
        recipeProduct.id,
        {
          items: recipeItems
            .filter((it) => Number(it.ingredient_id) && Number(it.quantity) > 0)
            .map((it) => ({ ingredient_id: Number(it.ingredient_id), quantity: Number(it.quantity) }))
        },
        { variant_id: recipeVariantId || undefined }
      );
      setRecipeOpen(false);
      await refresh();
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to save recipe');
    }
  };

  const onRecipeVariantChange = async (value) => {
    if (!recipeProduct) return;
    setRecipeVariantId(value);
    try {
      const res = await api.products.getRecipe(recipeProduct.id, { variant_id: value || undefined });
      const items = (res.data?.items || []).map((it) => ({
        ingredient_id: Number(it.ingredient_id),
        quantity: String(it.quantity)
      }));
      setRecipeItems(items.length ? items : [{ ingredient_id: ingredients[0]?.id || '', quantity: '' }]);
    } catch (e) {
      setRecipeItems([{ ingredient_id: ingredients[0]?.id || '', quantity: '' }]);
    }
  };

  const openVariants = async (p) => {
    try {
      setError('');
      setVariantError('');
      setVariantsProduct(p);
      const res = await api.products.listVariants(p.id);
      setVariants(res.data || []);
      setNewVariant({ variant_name: '', price: '' });
      setVariantsOpen(true);
    } catch (e) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.error || e?.message || 'Failed to load variants';
      setVariantError(status ? `(${status}) ${msg}` : msg);
      setError(status ? `(${status}) ${msg}` : msg);
    }
  };

  const addVariant = async () => {
    if (!variantsProduct) return;
    try {
      setError('');
      setVariantError('');
      await api.products.createVariant(variantsProduct.id, {
        variant_name: newVariant.variant_name.trim(),
        price: Number(newVariant.price)
      });
      const res = await api.products.listVariants(variantsProduct.id);
      setVariants(res.data || []);
      setNewVariant({ variant_name: '', price: '' });
      await refresh();
    } catch (e) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.error || e?.message || 'Failed to add variant';
      setVariantError(status ? `(${status}) ${msg}` : msg);
      setError(status ? `(${status}) ${msg}` : msg);
    }
  };

  const updateVariant = async (variantId, patch) => {
    if (!variantsProduct) return;
    try {
      setError('');
      setVariantError('');
      await api.products.updateVariant(variantsProduct.id, variantId, patch);
      const res = await api.products.listVariants(variantsProduct.id);
      setVariants(res.data || []);
      await refresh();
    } catch (e) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.error || e?.message || 'Failed to update variant';
      setVariantError(status ? `(${status}) ${msg}` : msg);
      setError(status ? `(${status}) ${msg}` : msg);
    }
  };

  const deleteVariant = async (variantId) => {
    if (!variantsProduct) return;
    const ok = window.confirm('Delete this variant permanently?');
    if (!ok) return;
    try {
      setError('');
      setVariantError('');
      await api.products.removeVariant(variantsProduct.id, variantId);
      const res = await api.products.listVariants(variantsProduct.id);
      setVariants(res.data || []);
      await refresh();
    } catch (e) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.error || e?.message || 'Failed to delete variant';
      setVariantError(status ? `(${status}) ${msg}` : msg);
      setError(status ? `(${status}) ${msg}` : msg);
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
          <Button
            className="btn-secondary"
            onClick={() => {
              setNewCategoryName('');
              setCategoryOpen(true);
            }}
          >
            + Add Category
          </Button>
          <Button className="btn-secondary" onClick={() => navigate('/dashboard')}>
            Dashboard
          </Button>
          <Button className="btn-secondary" onClick={() => navigate('/pos')}>
            POS
          </Button>
          <Button className="btn-secondary" onClick={() => navigate('/orders')}>
            Orders
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

      <div
        className="card"
        style={{
          padding: 16,
          marginBottom: 14,
          border: '2px solid rgba(255, 182, 193, 0.55)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontWeight: 800, fontSize: 17 }} className="pink-text">
            Categories
          </span>
          <Button className="btn-secondary" onClick={() => setManageCategoriesOpen(true)}>
            Edit categories
          </Button>
        </div>
        <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 10 }}>
          Add a category from <strong>+ Add Category</strong> in the header. Tap a category to filter products, or <strong>All</strong> for
          every group. The list below is organized by category.
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className={`btn ${categoryFilterId == null ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: 999, padding: '8px 16px', fontWeight: 700 }}
            onClick={() => setCategoryFilterId(null)}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`btn ${Number(categoryFilterId) === Number(c.id) ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: 999, padding: '8px 16px', fontWeight: 700 }}
              onClick={() => setCategoryFilterId(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {error ? <div className="card error-text" style={{ marginBottom: 12 }}>{error}</div> : null}

      {loading ? (
        <div className="card">Loading products…</div>
      ) : catalogSections.length === 0 ? (
        <div className="card">{visible.length === 0 ? 'No products match your search.' : 'No products in this category.'}</div>
      ) : (
        catalogSections.map(({ category, products: prods }) => (
          <div key={category.id} style={{ marginBottom: 28 }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                marginBottom: 12,
                paddingBottom: 8,
                borderBottom: '2px solid #f1d6de',
                display: 'flex',
                alignItems: 'baseline',
                gap: 10,
                flexWrap: 'wrap'
              }}
            >
              <span className="pink-text">{category.name}</span>
              <span style={{ fontWeight: 600, opacity: 0.65, fontSize: 15 }}>{prods.length} product{prods.length === 1 ? '' : 's'}</span>
            </div>
            <ProductList
              products={prods}
              onEdit={openEdit}
              onDeactivate={toggleActive}
              onDelete={removeProduct}
              onRecipe={openRecipe}
              onVariants={openVariants}
            />
          </div>
        ))
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
          <select
            className="input"
            value={form.product_type}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                product_type: e.target.value,
                cost_price: e.target.value === 'finished-goods' ? p.cost_price || '' : ''
              }))
            }
          >
            <option value="made-to-order">made-to-order</option>
            <option value="finished-goods">finished-goods</option>
          </select>
          <Input type="number" placeholder="Base price (what customers pay)" value={form.base_price} onChange={(e) => setForm((p) => ({ ...p, base_price: e.target.value }))} />
          {form.product_type === 'finished-goods' ? (
            <Input
              type="number"
              placeholder="Cost price (optional — for your margin vs base price)"
              value={form.cost_price}
              onChange={(e) => setForm((p) => ({ ...p, cost_price: e.target.value }))}
            />
          ) : editing ? (
            <div className="card" style={{ padding: 10, fontSize: 13, opacity: 0.9 }}>
              <strong>Cost price</strong> is calculated from the default recipe (ingredient qty × cost per unit). Edit the recipe to change it.
              {editing.cost_price != null ? (
                <div style={{ marginTop: 6 }}>Current (default recipe): ₱{Number(editing.cost_price).toFixed(2)}</div>
              ) : (
                <div style={{ marginTop: 6 }}>No default recipe yet — add ingredients in Recipe (base product, not a variant-only recipe).</div>
              )}
            </div>
          ) : (
            <div className="card" style={{ padding: 10, fontSize: 13, opacity: 0.9 }}>
              After you create this product, open <strong>Recipe</strong> to add ingredients. Cost price will be calculated automatically.
            </div>
          )}
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

          {form.product_type === 'finished-goods' ? (
            <div className="card" style={{ padding: 12, opacity: 0.9, fontSize: 13 }}>
              <strong>Finished goods</strong> use <strong>base price</strong> only (no variants). Use a separate product per SKU so
              cost and inventory stay accurate.
            </div>
          ) : editing ? (
            <div className="card" style={{ padding: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Product Variants</div>
              {(variants || []).length === 0 ? (
                <div style={{ opacity: 0.8, marginBottom: 8 }}>No variants yet. Add one below.</div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {variants.map((v) => (
                    <div
                      key={v.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.3fr 1fr auto auto',
                        gap: 8,
                        alignItems: 'center'
                      }}
                    >
                      <Input
                        value={v.variant_name || ''}
                        onChange={(e) =>
                          setVariants((prev) => prev.map((x) => (x.id === v.id ? { ...x, variant_name: e.target.value } : x)))
                        }
                      />
                      <Input
                        type="number"
                        value={String(v.price ?? '')}
                        onChange={(e) =>
                          setVariants((prev) => prev.map((x) => (x.id === v.id ? { ...x, price: e.target.value } : x)))
                        }
                      />
                      <Button
                        className="btn-secondary"
                        onClick={() =>
                          updateVariant(v.id, {
                            variant_name: v.variant_name,
                            price: Number(v.price)
                          })
                        }
                      >
                        Save
                      </Button>
                      <Button className="btn-danger" onClick={() => deleteVariant(v.id)}>
                        Delete
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1.3fr 1fr auto', gap: 8 }}>
                <Input
                  placeholder="Variant name (e.g. B1T1 + Cheese)"
                  value={newVariant.variant_name}
                  onChange={(e) => setNewVariant((p) => ({ ...p, variant_name: e.target.value }))}
                />
                <Input
                  type="number"
                  placeholder="Price"
                  value={newVariant.price}
                  onChange={(e) => setNewVariant((p) => ({ ...p, price: e.target.value }))}
                />
                <Button
                  className="btn-primary"
                  onClick={addVariant}
                  disabled={!newVariant.variant_name.trim() || !Number.isFinite(Number(newVariant.price))}
                >
                  Add
                </Button>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 12, opacity: 0.9 }}>
              Save the product first, then edit it to add variants (example: B1T1 + Cheese).
            </div>
          )}
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
            <div className="card" style={{ padding: 10, fontSize: 13 }}>
              <strong>Estimated cost (this recipe)</strong>:{' '}
              {recipePreviewCost != null ? `₱${recipePreviewCost.toFixed(2)}` : '—'}
              <div style={{ marginTop: 6, opacity: 0.85 }}>
                Uses each ingredient’s cost per unit × quantity. The product list uses the <em>default</em> recipe (no variant) for made-to-order cost when stock is computed.
              </div>
            </div>
            {recipeProduct?.has_variants ? (
              <>
                <label style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>Recipe for</label>
                <select
                  className="input"
                  value={recipeVariantId}
                  onChange={(e) => onRecipeVariantChange(e.target.value)}
                >
                  <option value="">
                    Default / Base (₱{Number(recipeProduct.base_price || 0).toFixed(2)}) — POS & stock fallback
                  </option>
                  {(recipeProduct.variants || []).map((v) => (
                    <option key={v.id} value={String(v.id)}>
                      {v.variant_name} (₱{Number(v.price).toFixed(2)})
                    </option>
                  ))}
                </select>
                {recipeVariantId ? (
                  <Button className="btn-secondary" type="button" onClick={() => copyDefaultRecipeIntoForm()}>
                    Copy ingredients from default recipe
                  </Button>
                ) : null}
              </>
            ) : null}
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

      <Modal
        open={variantsOpen}
        title={
          variantsProduct?.product_type === 'finished-goods'
            ? `Remove variants: ${variantsProduct?.name || ''}`
            : variantsProduct
              ? `Variants: ${variantsProduct.name}`
              : 'Variants'
        }
        onClose={() => setVariantsOpen(false)}
      >
        <div style={{ display: 'grid', gap: 12 }}>
          {variantError ? <div className="card error-text">{variantError}</div> : null}
          {variantsProduct?.product_type === 'finished-goods' ? (
            <>
              <div style={{ fontSize: 13, opacity: 0.9 }}>
                Finished goods should use <strong>base price</strong> only. Delete each row below so POS uses one price and one
                COGS. You cannot add new variants for finished goods.
              </div>
              {(variants || []).length === 0 ? (
                <div style={{ opacity: 0.8 }}>No variants left.</div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {variants.map((v) => (
                    <div
                      key={v.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 10,
                        padding: 10,
                        border: '1px solid #E2E8F0',
                        borderRadius: 12
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800 }}>{v.variant_name}</div>
                        <div style={{ opacity: 0.85, fontSize: 13 }}>₱{Number(v.price).toFixed(2)}</div>
                      </div>
                      <Button className="btn-danger" onClick={() => deleteVariant(v.id)}>
                        Delete
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Button className="btn-secondary" style={{ width: '100%' }} onClick={() => setVariantsOpen(false)}>
                Close
              </Button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, opacity: 0.85 }}>
                Add pricing variants like “B1T1 + Cheese” so POS can prompt for a selection.
              </div>

              {(variants || []).length === 0 ? (
                <div style={{ opacity: 0.8 }}>No variants yet.</div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {variants.map((v) => (
                    <div
                      key={v.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.5fr 1fr auto auto',
                        gap: 8,
                        alignItems: 'center'
                      }}
                    >
                      <Input
                        value={v.variant_name || ''}
                        onChange={(e) =>
                          setVariants((prev) => prev.map((x) => (x.id === v.id ? { ...x, variant_name: e.target.value } : x)))
                        }
                      />
                      <Input
                        type="number"
                        value={String(v.price ?? '')}
                        onChange={(e) =>
                          setVariants((prev) => prev.map((x) => (x.id === v.id ? { ...x, price: e.target.value } : x)))
                        }
                      />
                      <Button
                        className={v.is_active ? 'btn-secondary' : 'btn-primary'}
                        onClick={() => updateVariant(v.id, { is_active: !v.is_active })}
                      >
                        {v.is_active ? 'Active' : 'Inactive'}
                      </Button>
                      <Button className="btn-danger" onClick={() => deleteVariant(v.id)}>
                        Delete
                      </Button>
                      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                          className="btn-secondary"
                          onClick={() =>
                            updateVariant(v.id, {
                              variant_name: v.variant_name,
                              price: Number(v.price)
                            })
                          }
                        >
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="card" style={{ padding: 12 }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>Add new variant</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 8 }}>
                  <Input
                    placeholder="Variant name (e.g. B1T1 + Cheese)"
                    value={newVariant.variant_name}
                    onChange={(e) => setNewVariant((p) => ({ ...p, variant_name: e.target.value }))}
                  />
                  <Input
                    type="number"
                    placeholder="Price (e.g. 120)"
                    value={newVariant.price}
                    onChange={(e) => setNewVariant((p) => ({ ...p, price: e.target.value }))}
                  />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                  <Button className="btn-secondary" style={{ flex: 1 }} onClick={() => setVariantsOpen(false)}>
                    Close
                  </Button>
                  <Button
                    className="btn-primary"
                    style={{ flex: 1 }}
                    onClick={addVariant}
                    disabled={!newVariant.variant_name.trim() || !Number.isFinite(Number(newVariant.price))}
                  >
                    Add Variant
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
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

      <Modal
        open={manageCategoriesOpen}
        title="Edit categories"
        onClose={() => {
          setCategoryManageError('');
          setManageCategoriesOpen(false);
        }}
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 13, opacity: 0.88 }}>
            Rename categories or change <strong>order</strong> (lower numbers appear first in POS filters and below). Empty categories
            can be deleted; if products still use a category, deletion is blocked. You must be logged in as a <strong>manager</strong> to save
            changes.
          </div>
          {categoryManageError ? (
            <div className="card error-text" style={{ fontSize: 14 }}>
              {categoryManageError}
            </div>
          ) : null}
          {categoryRows.length === 0 ? (
            <div style={{ opacity: 0.8 }}>No categories yet. Use <strong>+ Add Category</strong> in the header.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {categoryRows.map((row, idx) => (
                <div
                  key={row.id}
                  className="card"
                  style={{ padding: 12, display: 'grid', gridTemplateColumns: '1.4fr 100px auto auto', gap: 10, alignItems: 'center' }}
                >
                  <Input
                    placeholder="Name"
                    value={row.name}
                    onChange={(e) =>
                      setCategoryRows((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r))
                      )
                    }
                  />
                  <Input
                    type="number"
                    placeholder="Order"
                    value={String(row.display_order ?? 0)}
                    onChange={(e) =>
                      setCategoryRows((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, display_order: e.target.value } : r))
                      )
                    }
                  />
                  <Button
                    className="btn-primary"
                    onClick={() => saveCategoryRow(row.id)}
                    disabled={categorySavingId != null}
                  >
                    {categorySavingId === Number(row.id) ? 'Saving…' : 'Save'}
                  </Button>
                  <Button className="btn-danger" onClick={() => deleteCategoryRow(row.id)} disabled={categorySavingId != null}>
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Button
            className="btn-secondary"
            style={{ width: '100%' }}
            onClick={() => {
              setCategoryManageError('');
              setManageCategoriesOpen(false);
            }}
          >
            Close
          </Button>
        </div>
      </Modal>
    </div>
  );
}

