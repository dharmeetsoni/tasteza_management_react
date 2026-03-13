/**
 * inventoryDeduct.js — Cascade-aware, unit-converting inventory deduction
 *
 * Flow:
 *   order → order_items → menu_items.recipe_id
 *     → flattenRecipe() recursively resolves all raw inventory items
 *     → unit-converts every quantity to the inventory item's base unit
 *     → merges duplicates, then deducts
 *
 * Master recipe handling:
 *   A master recipe is synced as an inventory_item in category "Recipe Master".
 *   When used as an ingredient, recipe_items stores its inventory_item_id.
 *   We detect this, compute the fraction of the master batch consumed, and
 *   recurse into the master recipe's own ingredients.
 *
 * Unit conversion:
 *   recipe_items.unit_id  may differ from inventory_items.unit_id (base unit).
 *   We convert all quantities to the inventory item's base unit before deducting.
 *   For master fraction: recipe_qty_unit → master yield_unit before dividing.
 */

const MAX_DEPTH = 10;

// ── Same unit table as recipes.js ────────────────────────────────────────────
const UNIT_TABLE = [
  { m: 1000000, k: ['tonne', 'ton', 't'] },
  { m: 1000,    k: ['kg', 'kgs', 'kilogram', 'kilograms', 'kilo'] },
  { m: 1,       k: ['g', 'gm', 'gr', 'gram', 'grams', 'grm'] },
  { m: 0.001,   k: ['mg', 'milligram', 'milligrams'] },
  { m: 1000,    k: ['l', 'lt', 'ltr', 'litre', 'liter', 'liters', 'litres', 'lts'] },
  { m: 1,       k: ['ml', 'millilitre', 'milliliter', 'mls'] },
  { m: 240,     k: ['cup', 'cups'] },
  { m: 15,      k: ['tbsp', 'tablespoon', 'tablespoons'] },
  { m: 5,       k: ['tsp', 'teaspoon', 'teaspoons'] },
  { m: 1,       k: ['pcs', 'pc', 'piece', 'pieces', 'nos', 'no', 'number',
                     'portion', 'portions', 'plate', 'plates',
                     'unit', 'units', 'serve', 'serves', 'each'] },
];

function getUnitMult(abbr, name, convFactor) {
  const a = (abbr  || '').trim().toLowerCase();
  const n = (name  || '').trim().toLowerCase();
  for (const e of UNIT_TABLE) {
    if (e.k.includes(a) || e.k.includes(n)) return e.m;
  }
  const cf = parseFloat(convFactor);
  return cf > 0 ? cf : 1;
}

/**
 * Convert a quantity from one unit to another.
 * Returns qty in toUnit.
 */
function convertQty(qty, fromAbbr, fromName, fromCF, toAbbr, toName, toCF) {
  const fromM = getUnitMult(fromAbbr, fromName, fromCF);
  const toM   = getUnitMult(toAbbr,   toName,   toCF);
  if (fromM === toM) return qty;           // same unit family
  if (toM   === 0)   return qty;           // guard
  return qty * (fromM / toM);             // convert to base, then to target
}

/**
 * Fetch unit info for a unit_id. Returns { abbr, name, cf } or nulls.
 */
async function getUnitInfo(conn, unitId) {
  if (!unitId) return { abbr: null, name: null, cf: null };
  const [[u]] = await conn.query(
    'SELECT abbreviation AS abbr, name, conversion_factor AS cf FROM units WHERE id=?',
    [unitId]
  );
  return u || { abbr: null, name: null, cf: null };
}

/**
 * Check if an inventory_item is a "Recipe Master" proxy.
 * Returns { recipeId, yieldQty, yieldUnitId, yieldAbbr, yieldName, yieldCf } or null.
 */
async function getMasterRecipeInfo(conn, inventoryItemId) {
  const [[row]] = await conn.query(`
    SELECT r.id AS recipeId,
           r.yield_qty,
           r.yield_unit_id,
           yu.abbreviation AS yield_abbr,
           yu.name         AS yield_name,
           yu.conversion_factor AS yield_cf
    FROM inventory_items ii
    JOIN categories c  ON ii.category_id = c.id AND c.name = 'Recipe Master'
    JOIN recipes    r  ON r.name = ii.name AND r.is_master = 1
    LEFT JOIN units yu ON yu.id = r.yield_unit_id
    WHERE ii.id = ?
    LIMIT 1
  `, [inventoryItemId]);
  return row || null;
}

/**
 * Recursively flatten a recipe into raw { inventory_item_id, qty_in_base_unit } entries.
 *
 * @param conn           DB connection (inside transaction)
 * @param recipeId       Recipe to flatten
 * @param multiplier     How many serves/units of this recipe are needed
 * @param visited        Set of already-visited recipeIds (loop guard)
 */
async function flattenRecipe(conn, recipeId, multiplier, visited) {
  if (visited.has(recipeId) || visited.size >= MAX_DEPTH) return [];
  visited = new Set([...visited, recipeId]); // immutable copy

  // Fetch all ingredients of this recipe WITH their unit info and inventory base unit
  const [ingredients] = await conn.query(`
    SELECT
      ri.inventory_item_id,
      ri.quantity                  AS recipe_qty,
      ri.unit_id                   AS recipe_unit_id,
      ru.abbreviation              AS recipe_unit_abbr,
      ru.name                      AS recipe_unit_name,
      ru.conversion_factor         AS recipe_unit_cf,
      ii.unit_id                   AS inv_unit_id,
      iu.abbreviation              AS inv_unit_abbr,
      iu.name                      AS inv_unit_name,
      iu.conversion_factor         AS inv_unit_cf
    FROM recipe_items ri
    LEFT JOIN inventory_items ii ON ri.inventory_item_id = ii.id
    LEFT JOIN units ru ON ru.id = COALESCE(ri.unit_id, ii.unit_id)
    LEFT JOIN units iu ON iu.id = ii.unit_id
    WHERE ri.recipe_id = ?
  `, [recipeId]);

  const result = [];

  for (const ing of ingredients) {
    const recipeQty = parseFloat(ing.recipe_qty) || 0;
    if (recipeQty === 0) continue;

    // Check if this inventory item is a master recipe proxy
    const master = await getMasterRecipeInfo(conn, ing.inventory_item_id);

    if (master) {
      // ── Master recipe path ──────────────────────────────────────────────
      // Convert recipe_qty to master's yield unit so we can divide correctly
      const qtyInYieldUnit = convertQty(
        recipeQty,
        ing.recipe_unit_abbr, ing.recipe_unit_name, ing.recipe_unit_cf,
        master.yield_abbr,    master.yield_name,    master.yield_cf
      );

      const yieldQty = parseFloat(master.yield_qty) || 1;
      // fraction = what fraction of one master batch is being consumed per serve
      const fractionPerServe = qtyInYieldUnit / yieldQty;
      // total fraction for all sold qty
      const totalFraction = fractionPerServe * multiplier;

      // Recurse with totalFraction as the multiplier — master's ingredients are per full batch
      const subItems = await flattenRecipe(conn, master.recipeId, totalFraction, visited);
      result.push(...subItems);

    } else {
      // ── Regular inventory item path ─────────────────────────────────────
      // Convert recipe_qty from recipe unit → inventory base unit
      const qtyInInvUnit = convertQty(
        recipeQty,
        ing.recipe_unit_abbr, ing.recipe_unit_name, ing.recipe_unit_cf,
        ing.inv_unit_abbr,    ing.inv_unit_name,    ing.inv_unit_cf
      );

      result.push({
        inventory_item_id: ing.inventory_item_id,
        qty: qtyInInvUnit * multiplier,
      });
    }
  }

  return result;
}

/**
 * Merge duplicate inventory_item_ids by summing qty.
 */
function mergeIngredients(items) {
  const map = {};
  for (const it of items) {
    const k = String(it.inventory_item_id);
    if (map[k]) map[k].qty += it.qty;
    else        map[k] = { ...it };
  }
  return Object.values(map);
}

/**
 * Main entry point — deducts inventory for all items in an order.
 */
async function deductInventoryForOrder(conn, orderId, createdBy) {
  const [orderItems] = await conn.query(`
    SELECT oi.item_name, oi.quantity,
           mi.recipe_id
    FROM order_items oi
    LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
    WHERE oi.order_id = ?
  `, [orderId]);

  for (const item of orderItems) {
    if (!item.recipe_id) continue;

    const soldQty = parseFloat(item.quantity) || 0;
    if (soldQty === 0) continue;

    const rawIngredients = await flattenRecipe(conn, item.recipe_id, soldQty, new Set());
    const merged         = mergeIngredients(rawIngredients);

    for (const ing of merged) {
      if (ing.qty <= 0) continue;
      await deductSingle(conn, ing.inventory_item_id, ing.qty, orderId, item.item_name, soldQty, createdBy);
    }
  }
}

/**
 * Deduct a single inventory item and record the movement.
 */
async function deductSingle(conn, invItemId, deductQty, orderId, menuItemName, soldQty, createdBy) {
  const [[inv]] = await conn.query(
    'SELECT current_quantity FROM inventory_items WHERE id=? FOR UPDATE',
    [invItemId]
  );
  if (!inv) return;

  const before = parseFloat(inv.current_quantity);
  const after  = Math.max(0, before - deductQty);

  await conn.query(
    'UPDATE inventory_items SET current_quantity=? WHERE id=?',
    [after, invItemId]
  );

  await conn.query(`
    INSERT INTO inventory_movements
      (inventory_item_id, movement_type, quantity_change,
       quantity_before, quantity_after, reference_type, reference_id, note, created_by)
    VALUES (?, 'sale_deduction', ?, ?, ?, 'order', ?, ?, ?)
  `, [
    invItemId,
    -deductQty,
    before,
    after,
    orderId,
    `Sold: ${menuItemName} × ${soldQty}`,
    createdBy || null,
  ]);
}

module.exports = { deductInventoryForOrder };