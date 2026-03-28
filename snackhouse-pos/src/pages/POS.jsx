import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import ProductGrid from '../components/pos/ProductGrid';
import OrderSummary from '../components/pos/OrderSummary';
import PaymentModal from '../components/pos/PaymentModal';
import ReceiptPreview from '../components/pos/ReceiptPreview';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { calcLineSubtotal, sumOrderSubtotal } from '../utils/calculations';

export default function POS() {
  const { employee, logout } = useAuth();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);

  const [orderLines, setOrderLines] = useState([]);
  const subtotal = useMemo(() => sumOrderSubtotal(orderLines), [orderLines]);

  const [variantProduct, setVariantProduct] = useState(null);
  /** 'base' = sell at product.base_price with variant_id null; otherwise product_variants.id */
  const [selectedVariantKey, setSelectedVariantKey] = useState('base');

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await api.products.getAll();
        if (!alive) return;
        // Backend already returns only active products for POS.
        setProducts(res.data || []);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const categories = useMemo(() => {
    const set = new Set();
    for (const p of products) set.add(p.category_name || 'Other');
    return ['All', ...Array.from(set)];
  }, [products]);

  const visibleProducts = useMemo(() => {
    if (activeCategory === 'All') return products;
    return products.filter((p) => (p.category_name || 'Other') === activeCategory);
  }, [products, activeCategory]);

  const addLine = ({ product, variant }) => {
    const key = `${product.id}:${variant?.id || ''}`;
    const unitPrice = Number(variant?.price ?? product.base_price);

    setOrderLines((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (!existing) {
        const qty = 1;
        return [
          ...prev,
          {
            key,
            product_id: product.id,
            product_name: product.name,
            variant_id: variant?.id || null,
            variant_name: variant?.variant_name || null,
            unit_price: unitPrice,
            quantity: qty,
            subtotal: calcLineSubtotal(unitPrice, qty)
          }
        ];
      }
      return prev.map((l) => {
        if (l.key !== key) return l;
        const qty = l.quantity + 1;
        return { ...l, quantity: qty, subtotal: calcLineSubtotal(l.unit_price, qty) };
      });
    });
  };

  const handleProductClick = (product) => {
    const useVariants =
      product.product_type !== 'finished-goods' && product.has_variants && (product.variants || []).length > 0;
    if (useVariants) {
      setVariantProduct(product);
      setSelectedVariantKey('base');
      return;
    }
    addLine({ product, variant: null });
  };

  const inc = (line) => addLine({ product: { id: line.product_id, name: line.product_name, base_price: line.unit_price }, variant: line.variant_id ? { id: line.variant_id, variant_name: line.variant_name, price: line.unit_price } : null });
  const dec = (line) => {
    setOrderLines((prev) =>
      prev
        .map((l) => {
          if (l.key !== line.key) return l;
          const qty = Math.max(1, l.quantity - 1);
          return { ...l, quantity: qty, subtotal: calcLineSubtotal(l.unit_price, qty) };
        })
    );
  };
  const remove = (line) => setOrderLines((prev) => prev.filter((l) => l.key !== line.key));

  const submitSale = async ({ payment_method, amount_paid }) => {
    try {
      setError('');
      const payload = {
        items: orderLines.map((l) => ({
          product_id: l.product_id,
          variant_id: l.variant_id,
          quantity: l.quantity
        })),
        payment_method,
        amount_paid
      };

      const res = await api.orders.create(payload);
      setReceipt(res.data);
      setPaymentOpen(false);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to complete sale');
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ fontSize: 26, fontWeight: 800 }} className="pink-text">
          Snackhouse POS
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ fontWeight: 700 }}>
            Employee: <span className="pink-text">{employee?.full_name || '—'}</span>
          </div>
          <Button className="btn-secondary" onClick={() => navigate('/orders')}>
            Orders
          </Button>
          {employee?.role === 'manager' ? (
            <Button className="btn-secondary" onClick={() => navigate('/dashboard')}>
              Dashboard
            </Button>
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
      {error ? <div className="card error-text" style={{ marginBottom: 12 }}>{error}</div> : null}

      <div className="pos-layout">
        <div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            {categories.map((c) => (
              <Button
                key={c}
                className={c === activeCategory ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setActiveCategory(c)}
              >
                {c}
              </Button>
            ))}
          </div>

          {loading ? <div className="card">Loading products…</div> : <ProductGrid products={visibleProducts} onProductClick={handleProductClick} />}
        </div>

        <div className="card" style={{ height: 'calc(100vh - 110px)' }}>
          <OrderSummary
            lines={orderLines}
            onInc={inc}
            onDec={dec}
            onRemove={remove}
            subtotal={subtotal}
          />

          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <Button
              className="btn-secondary"
              onClick={() => setOrderLines([])}
              style={{ flex: 1, minHeight: 64 }}
              disabled={orderLines.length === 0}
            >
              Void Order
            </Button>
            <Button
              className="btn-primary"
              onClick={() => setPaymentOpen(true)}
              style={{ flex: 1, minHeight: 64 }}
              disabled={orderLines.length === 0}
            >
              COMPLETE SALE
            </Button>
          </div>
        </div>
      </div>

      <Modal
        open={!!variantProduct}
        title={variantProduct ? `Select Variant: ${variantProduct.name}` : ''}
        onClose={() => setVariantProduct(null)}
      >
        {/* Children are evaluated even when Modal returns null — guard so we never read variantProduct when null. */}
        {variantProduct ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Button
                key="base"
                className={selectedVariantKey === 'base' ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setSelectedVariantKey('base')}
              >
                Base (₱{Number(variantProduct.base_price).toFixed(2)})
              </Button>
              {(variantProduct.variants || []).map((v) => (
                <Button
                  key={v.id}
                  className={selectedVariantKey === v.id ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => setSelectedVariantKey(v.id)}
                >
                  {v.variant_name} (₱{Number(v.price).toFixed(2)})
                </Button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <Button className="btn-secondary" onClick={() => setVariantProduct(null)} style={{ flex: 1 }}>
                Cancel
              </Button>
              <Button
                className="btn-primary"
                onClick={() => {
                  if (selectedVariantKey === 'base') {
                    addLine({ product: variantProduct, variant: null });
                  } else {
                    const v =
                      (variantProduct.variants || []).find((x) => x.id === selectedVariantKey) || null;
                    addLine({ product: variantProduct, variant: v });
                  }
                  setVariantProduct(null);
                }}
                style={{ flex: 1 }}
              >
                Add to Order
              </Button>
            </div>
          </>
        ) : null}
      </Modal>

      <PaymentModal
        open={paymentOpen}
        total={subtotal}
        onCancel={() => setPaymentOpen(false)}
        onConfirm={submitSale}
      />

      <ReceiptPreview
        open={!!receipt}
        receipt={receipt}
        onClose={() => setReceipt(null)}
        onPrint={() => window.print()}
        onNewOrder={() => {
          setReceipt(null);
          setOrderLines([]);
        }}
      />
    </div>
  );
}

