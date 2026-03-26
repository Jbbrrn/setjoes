import React, { useEffect, useMemo, useState } from 'react';
import Button from './Button';

const padDigits = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '0',
  'back'
];

export default function PinPad({ onSubmit, disabled, autoFocus, resetKey }) {
  const [pin, setPin] = useState('');

  const display = useMemo(() => pin.padEnd(4, '').slice(0, 4).split(''), [pin]);

  useEffect(() => {
    if (autoFocus) {
      // Best-effort: tap input focus for mobile.
      // eslint-disable-next-line no-unused-expressions
      document?.activeElement;
    }
  }, [autoFocus]);

  const handleDigit = (d) => {
    if (disabled) return;

    setPin((prev) => {
      if (d === 'back') return prev.slice(0, -1);
      if (prev.length >= 4) return prev;
      return prev + d;
    });
  };

  useEffect(() => {
    if (pin.length === 4) onSubmit?.(pin);
  }, [pin, onSubmit]);

  useEffect(() => {
    setPin('');
  }, [resetKey]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 14 }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              border: '2px solid #FFB6C1',
              background: pin.length > i ? '#FF69B4' : '#F8F9FA'
            }}
          />
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12
        }}
      >
        {['1','2','3','4','5','6','7','8','9','back','0',''].map((key, idx) => {
          if (key === '') return <div key={idx} />;
          const label = key === 'back' ? '⌫' : key;
          return (
            <Button
              key={idx}
              className={key === 'back' ? 'btn-secondary' : 'btn-secondary'}
              onClick={() => handleDigit(key)}
              style={{ fontSize: 22 }}
            >
              {label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

