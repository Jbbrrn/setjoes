import React from 'react';

export default function Button({ className = '', children, ...props }) {
  return (
    <button className={`btn ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}

