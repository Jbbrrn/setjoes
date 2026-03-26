export const formatPHP = (amount) => {
  const n = Number(amount || 0);
  return `₱${n.toFixed(2)}`;
};

