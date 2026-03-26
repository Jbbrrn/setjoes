export const sumOrderSubtotal = (lines) =>
  (lines || []).reduce((acc, l) => acc + Number(l.subtotal || 0), 0);

export const calcLineSubtotal = (unitPrice, qty) => Number(unitPrice || 0) * Number(qty || 0);

