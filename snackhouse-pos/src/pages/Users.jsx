import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const emptyForm = {
  full_name: '',
  username: '',
  role: 'cashier',
  password: '',
  is_active: true
};

export default function Users() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.users.list();
      setItems(res.data?.items || []);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setOpen(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({
      full_name: u.full_name || '',
      username: u.username || '',
      role: u.role || 'cashier',
      password: '',
      is_active: !!u.is_active
    });
    setError('');
    setOpen(true);
  };

  const submit = async () => {
    try {
      setError('');
      if (editing) {
        const payload = {
          full_name: form.full_name,
          username: form.username,
          role: form.role,
          is_active: !!form.is_active
        };
        if (form.password.trim()) payload.password = form.password.trim();
        await api.users.update(editing.id, payload);
      } else {
        await api.users.create({
          full_name: form.full_name,
          username: form.username,
          role: form.role,
          password: form.password.trim()
        });
      }
      setOpen(false);
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to save user');
    }
  };

  const deleteUser = async (u) => {
    const ok = window.confirm(`Delete ${u.full_name} permanently?`);
    if (!ok) return;
    try {
      await api.users.remove(u.id);
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to delete user');
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ fontSize: 26, fontWeight: 800 }} className="pink-text">
          User Management
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button className="btn-secondary" onClick={() => navigate('/dashboard')}>
            Dashboard
          </Button>
          <Button className="btn-secondary" onClick={openCreate}>
            + Add User
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

      {error ? (
        <div className="card error-text" style={{ marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="card">Loading users…</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map((u) => (
            <div key={u.id} className="card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 900 }}>
                    {u.full_name}{' '}
                    <span
                      style={{
                        fontSize: 12,
                        padding: '3px 8px',
                        borderRadius: 999,
                        color: 'white',
                        background: u.is_active ? '#48BB78' : '#A0AEC0'
                      }}
                    >
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div style={{ opacity: 0.75, marginTop: 2 }}>
                    @{u.username} • {u.role}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button className="btn-secondary" onClick={() => openEdit(u)}>
                    Edit
                  </Button>
                  <Button className="btn-danger" onClick={() => deleteUser(u)}>
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        title={editing ? `Edit User: ${editing.full_name}` : 'Add User'}
        onClose={() => setOpen(false)}
      >
        <div style={{ display: 'grid', gap: 10 }}>
          <Input
            placeholder="Full name"
            value={form.full_name}
            onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
          />
          <Input
            placeholder="Username"
            value={form.username}
            onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
          />
          <select
            className="input"
            value={form.role}
            onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
          >
            <option value="cashier">cashier</option>
            <option value="manager">manager</option>
          </select>
          <Input
            type="password"
            placeholder={editing ? 'New password (optional, min 6 chars)' : 'Password (min 6 chars)'}
            value={form.password}
            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
          />
          {editing ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={!!form.is_active}
                onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
              />
              Active
            </label>
          ) : null}
          <div style={{ display: 'flex', gap: 10 }}>
            <Button className="btn-secondary" style={{ flex: 1 }} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="btn-primary" style={{ flex: 1 }} onClick={submit}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

