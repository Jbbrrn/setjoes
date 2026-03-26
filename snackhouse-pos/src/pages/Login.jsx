import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const bgStyle = useMemo(
    () => ({
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      background: 'linear-gradient(145deg, #f9dce6 0%, #fefaf7 55%, #fff5f8 100%)'
    }),
    []
  );

  const handleLogin = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await login({ username, password });
      const emp = JSON.parse(localStorage.getItem('employee') || 'null');
      if (emp?.role === 'manager') navigate('/dashboard', { replace: true });
      else navigate('/pos', { replace: true });
    } catch (e) {
      setError('Invalid username or password.');
      setShake(true);
      setTimeout(() => setShake(false), 350);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={bgStyle}>
      <div style={{ width: 420, maxWidth: '100%' }}>
        <Card
          className={shake ? 'shake' : ''}
          style={{ padding: 26 }}
        >
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div className="pink-text" style={{ fontWeight: 800, fontSize: 30 }}>
              Snackhouse POS
            </div>
            <div style={{ marginTop: 6, fontSize: 14, opacity: 0.8 }}>Username + Password Login</div>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'grid', gap: 10 }}>
            <Input
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              disabled={submitting}
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
            <Button className="btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          {error ? (
            <div className="error-text" style={{ marginTop: 14, textAlign: 'center', fontWeight: 600 }}>
              {error}
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}

