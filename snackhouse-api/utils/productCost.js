/**
 * Product / recipe cost helpers. Recipe resolution matches ordersController (variant-specific first, else base).
 */

const roundMoney = (n) => Math.round(Number(n) * 100) / 100;

const sumRecipeCost = async (connection, recipeId) => {
  const [rows] = await connection.query(
    `SELECT COALESCE(SUM(ri.quantity * i.cost_per_unit), 0) AS total
     FROM recipe_items ri
     JOIN ingredients i ON i.id = ri.ingredient_id
     WHERE ri.recipe_id = ?`,
    [recipeId]
  );
  const n = Number(rows[0]?.total);
  return Number.isFinite(n) ? roundMoney(n) : null;
};

/** Recipe used when selling this product + variant (same logic as ordersController). */
const getRecipeIdForSaleLine = async (connection, productId, variantId) => {
  const [recipeRows] = await connection.query(
    `SELECT r.id
     FROM recipes r
     WHERE r.product_id = ?
       AND (r.variant_id <=> ? OR r.variant_id IS NULL)
     ORDER BY (r.variant_id IS NULL) ASC
     LIMIT 1`,
    [productId, variantId]
  );
  return recipeRows.length ? recipeRows[0].id : null;
};

/** Cost for one sold unit at current ingredient/product costs; null if unknown. */
const getUnitCostForSaleLine = async (connection, { product_id, product_type, variant_id, cost_price }) => {
  if (product_type === 'finished-goods') {
    if (cost_price == null || cost_price === '') return null;
    const n = Number(cost_price);
    if (!Number.isFinite(n) || n < 0) return null;
    return roundMoney(n);
  }
  const vid = variant_id != null ? Number(variant_id) : null;
  const recipeId = await getRecipeIdForSaleLine(connection, product_id, vid);
  if (!recipeId) return null;
  const [itemCount] = await connection.query('SELECT COUNT(*) AS cnt FROM recipe_items WHERE recipe_id = ?', [recipeId]);
  if (!Number(itemCount[0]?.cnt)) return null;
  return sumRecipeCost(connection, recipeId);
};

/** Default (base) recipe only — product listing / stock-style cost. */
const getMadeToOrderCostDefaultRecipe = async (connection, productId) => {
  const [recipeRows] = await connection.query(
    `SELECT r.id
     FROM recipes r
     WHERE r.product_id = ? AND r.variant_id IS NULL
     ORDER BY r.id ASC
     LIMIT 1`,
    [productId]
  );
  if (!recipeRows.length) return null;
  const [itemCount] = await connection.query(
    'SELECT COUNT(*) AS cnt FROM recipe_items WHERE recipe_id = ?',
    [recipeRows[0].id]
  );
  if (!Number(itemCount[0]?.cnt)) return null;
  return sumRecipeCost(connection, recipeRows[0].id);
};

/** Denormalize made-to-order default recipe cost into products.cost_price (for SQL/reporting). */
const syncMadeToOrderCostPriceCache = async (connection, productId) => {
  const [rows] = await connection.query(
    'SELECT product_type FROM products WHERE id = ? LIMIT 1',
    [productId]
  );
  if (!rows.length || rows[0].product_type !== 'made-to-order') return;
  const computed = await getMadeToOrderCostDefaultRecipe(connection, productId);
  await connection.query('UPDATE products SET cost_price = ? WHERE id = ?', [computed, productId]);
};

/** After ingredient cost changes: refresh cached cost for all made-to-order products using it in the base recipe. */
const syncMadeToOrderCachesForIngredient = async (connection, ingredientId) => {
  const [products] = await connection.query(
    `SELECT DISTINCT r.product_id AS id
     FROM recipe_items ri
     JOIN recipes r ON r.id = ri.recipe_id AND r.variant_id IS NULL
     JOIN products p ON p.id = r.product_id AND p.product_type = 'made-to-order'
     WHERE ri.ingredient_id = ?`,
    [ingredientId]
  );
  for (const row of products) {
    await syncMadeToOrderCostPriceCache(connection, row.id);
  }
};

module.exports = {
  roundMoney,
  sumRecipeCost,
  getRecipeIdForSaleLine,
  getUnitCostForSaleLine,
  getMadeToOrderCostDefaultRecipe,
  syncMadeToOrderCostPriceCache,
  syncMadeToOrderCachesForIngredient
};
