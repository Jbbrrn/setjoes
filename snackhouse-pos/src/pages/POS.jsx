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
  const [selectedVariantId, setSelectedVariantId] = useState(null);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await api.products.getAll();
        if (!alive) return;
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
    if (product.has_variants && (product.variants || []).length > 0) {
      setVariantProduct(product);
      setSelectedVariantId(product.variants[0]?.id || null);
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
          <Button
            className="btn-secondary"
            onClick={() => {
              if (employee?.role === 'manager') navigate('/dashboard');
            }}
          >
            Dashboard
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {(variantProduct?.variants || []).map((v) => (
            <Button
              key={v.id}
              className={selectedVariantId === v.id ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setSelectedVariantId(v.id)}
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
              const v = (variantProduct.variants || []).find((x) => x.id === selectedVariantId) || null;
              addLine({ product: variantProduct, variant: v });
              setVariantProduct(null);
            }}
            style={{ flex: 1 }}
          >
            Add to Order
          </Button>
        </div>
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

