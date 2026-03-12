const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// ── Live price helper: always compute from current inventory price ─
// All unit multipliers → base (grams for weight, ml for volume), case-insensitive
const UNIT_TABLE = [
  { m:1000000, k:['tonne','ton','t'] },
  { m:1000,    k:['kg','kgs','kilogram','kilograms','kilo'] },
  { m:1,       k:['g','gm','gr','gram','grams','grm'] },
  { m:0.001,   k:['mg','milligram','milligrams'] },
  { m:1000,    k:['l','lt','ltr','litre','liter','liters','litres','lts'] },
  { m:1,       k:['ml','millilitre','milliliter','mls'] },
  { m:240,     k:['cup','cups'] },
  { m:15,      k:['tbsp','tablespoon','tablespoons'] },
  { m:5,       k:['tsp','teaspoon','teaspoons'] },
  { m:1,       k:['pcs','pc','piece','pieces','nos','no','number','portion','portions','plate','plates','unit','units','serve','serves','each'] },
];
function getUnitMult(abbr, name, convFactor) {
  const a = (abbr||'').trim().toLowerCase();
  const n = (name||'').trim().toLowerCase();
  for (const e of UNIT_TABLE) {
    if (e.k.includes(a) || e.k.includes(n)) return e.m;
  }
  const cf = parseFloat(convFactor);
  return cf > 0 ? cf : 1;
}
function convertUnitPrice(price, fromAbbr, fromName, fromCF, toAbbr, toName, toCF) {
  const fromM = getUnitMult(fromAbbr, fromName, fromCF);
  const toM   = getUnitMult(toAbbr,   toName,   toCF);
  return price * (toM / fromM);
}

async function getLivePriceForIng(db, ing) {
  if (!ing.inventory_item_id) return { price: parseFloat(ing.price_per_unit)||0 };
  const [[item]] = await db.query(
    'SELECT i.purchase_price, i.unit_id, u.abbreviation AS abbr, u.name AS uname, u.conversion_factor AS cf FROM inventory_items i LEFT JOIN units u ON i.unit_id=u.id WHERE i.id=?',
    [ing.inventory_item_id]
  );
  if (!item) return { price: parseFloat(ing.price_per_unit)||0 };
  const basePrice = parseFloat(item.purchase_price||0);
  if (!ing.unit_id || parseInt(ing.unit_id) === parseInt(item.unit_id)) return { price: basePrice };
  const [[ru]] = await db.query('SELECT abbreviation, name, conversion_factor FROM units WHERE id=?', [ing.unit_id]);
  if (!ru) return { price: basePrice };
  const livePrice = convertUnitPrice(basePrice, item.abbr, item.uname, item.cf, ru.abbreviation, ru.name, ru.conversion_factor);
  return { price: livePrice };
}


// ── Helper ────────────────────────────────────────────────
async function getOrCreateRecipeMasterCategoryId(conn) {
  const pool = conn || db;
  const [rows] = await pool.query("SELECT id FROM categories WHERE name='Recipe Master' LIMIT 1");
  if (rows.length) return rows[0].id;
  const [r] = await pool.query(
    "INSERT INTO categories (name,description,image_url,is_active) VALUES ('Recipe Master','Auto-generated base recipes','icon:📦|color:#b07a00',1)"
  );
  return r.insertId;
}

// ── Cascade cost update: recipe → parent recipes → menu items ────────────────
// Flow: Recipe1 saved → inventory_item updated (done in PUT before this call)
//       → cascade finds all parent recipes using Recipe1 as ingredient
//       → recalculates each parent's total cost using getLivePriceForIng (unit-aware)
//       → updates parent recipe + recipe_items rows
//       → syncs menu items linked to each recipe
//       → recurses up the chain
async function cascadeRecipeCost(conn, changedRecipeId, newCostPerUnit, visited = new Set()) {
  if (visited.has(changedRecipeId)) return;
  visited.add(changedRecipeId);

  // Step 1: sync menu items directly linked to this recipe
  await conn.query(
    `UPDATE menu_items SET cost_price = ? WHERE recipe_id = ?`,
    [parseFloat(newCostPerUnit) || 0, changedRecipeId]
  );

  // Step 2: ensure this recipe's inventory_item has the correct price AND unit
  // so that getLivePriceForIng in parent recipes gets the right value without extra conversion
  await conn.query(
    `UPDATE inventory_items ii
     JOIN categories c ON ii.category_id = c.id AND c.name = 'Recipe Master'
     JOIN recipes r ON ii.name = r.name AND r.id = ?
     SET ii.purchase_price = ?,
         ii.selling_price  = ?,
         ii.unit_id        = r.yield_unit_id,
         ii.updated_at     = NOW()`,
    [changedRecipeId, parseFloat(newCostPerUnit), parseFloat(newCostPerUnit)]
  );

  // Step 3: find all parent recipes that use this recipe as an ingredient
  const [[recipeRow]] = await conn.query('SELECT name FROM recipes WHERE id=?', [changedRecipeId]);
  if (!recipeRow) return;

  const [parents] = await conn.query(
    `SELECT DISTINCT r.id, r.cook_minutes, r.yield_qty, r.serves, r.is_master,
            r.wastage_percent, r.fuel_profile_id
     FROM recipes r
     JOIN recipe_items ri ON ri.recipe_id = r.id
     JOIN inventory_items ii ON ri.inventory_item_id = ii.id
     JOIN categories c ON ii.category_id = c.id AND c.name = 'Recipe Master'
     WHERE ii.name = ? AND r.id != ?`,
    [recipeRow.name, changedRecipeId]
  );

  for (const parent of parents) {
    // Get all ingredients for this parent recipe
    const [ings] = await conn.query(
      `SELECT ri.id AS ri_id, ri.quantity, ri.unit_id, ri.inventory_item_id
       FROM recipe_items ri WHERE ri.recipe_id = ?`,
      [parent.id]
    );

    // Recalculate each ingredient's price using getLivePriceForIng (handles unit conversion)
    let ingCost = 0;
    for (const i of ings) {
      const { price } = await getLivePriceForIng(conn, {
        inventory_item_id: i.inventory_item_id,
        unit_id: i.unit_id,
      });
      const lineCost = (parseFloat(i.quantity) || 0) * price;
      ingCost += lineCost;

      // Update stored price_per_unit and line_cost on the ingredient row
      await conn.query(
        `UPDATE recipe_items SET price_per_unit = ?, line_cost = ? WHERE id = ?`,
        [price, lineCost, i.ri_id]
      );
    }

    // Fuel cost
    let fuelCost = 0;
    if (parent.fuel_profile_id && parent.cook_minutes) {
      const [[fp]] = await conn.query('SELECT per_minute FROM fuel_profiles WHERE id=?', [parent.fuel_profile_id]);
      if (fp) fuelCost = parseFloat(fp.per_minute) * parseFloat(parent.cook_minutes);
    }

    // Staff cost
    const [staff] = await conn.query(
      `SELECT staff_count, per_minute FROM recipe_salary_staff WHERE recipe_id = ?`,
      [parent.id]
    );
    const staffCost = staff.reduce((s, st) =>
      s + (parseFloat(st.per_minute) || 0) * (parseFloat(parent.cook_minutes) || 0) * (parseFloat(st.staff_count) || 1), 0
    );

    const wastage     = parseFloat(parent.wastage_percent) || 0;
    const wastageCost = ingCost * (wastage / 100);
    const totalCost   = ingCost + wastageCost + staffCost + fuelCost;

    const divisor = parent.is_master
      ? (parseFloat(parent.yield_qty) || 1)
      : (parseFloat(parent.serves)    || 1);
    const newCpp = divisor > 0 ? totalCost / divisor : totalCost;

    // Save recalculated totals on parent recipe
    await conn.query(
      `UPDATE recipes SET ingredient_cost=?, wastage_cost=?, fuel_cost=?, salary_total_cost=?,
              total_cost=?, cost_per_unit=? WHERE id=?`,
      [ingCost, wastageCost, fuelCost, staffCost, totalCost, newCpp, parent.id]
    );

    // Recurse: this parent's cost changed, propagate upward
    await cascadeRecipeCost(conn, parent.id, newCpp, visited);
  }
}

// Keep old name as alias
async function syncMenuItemsCost(conn, recipeId, newCostPerUnit) {
  await cascadeRecipeCost(conn, recipeId, newCostPerUnit);
}

// ── GET all ───────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT r.*, u.abbreviation AS yield_unit_abbr,
             mc.name AS course_name, mc.icon AS course_icon,
             fp.fuel_name AS fuel_profile_name, fp.icon AS fuel_icon,
             COUNT(DISTINCT ri.id) AS ingredient_count
      FROM   recipes r
      LEFT JOIN units           u  ON r.yield_unit_id  = u.id
      LEFT JOIN menu_courses    mc ON r.course_id       = mc.id
      LEFT JOIN fuel_profiles   fp ON r.fuel_profile_id = fp.id
      LEFT JOIN recipe_items    ri ON ri.recipe_id      = r.id
      GROUP BY r.id
      ORDER BY r.is_master DESC, r.name ASC
    `);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── GET ingredients ───────────────────────────────────────
router.get('/:id/ingredients', async (req, res) => {
  try {
    const [ings] = await db.query(`
      SELECT ri.*,
        i.name            AS item_name,
        i.unit_id         AS base_unit_id,
        i.purchase_price  AS base_purchase_price,
        i.category_id,
        bu.abbreviation   AS base_unit_abbr,
        bu.conversion_factor AS base_conv_factor,
        COALESCE(cu.abbreviation, bu.abbreviation) AS chosen_unit_abbr,
        cu.conversion_factor AS chosen_conv_factor,
        COALESCE(ri.unit_id, i.unit_id) AS unit_id
      FROM recipe_items ri
      LEFT JOIN inventory_items i  ON ri.inventory_item_id = i.id
      LEFT JOIN units           bu ON i.unit_id             = bu.id
      LEFT JOIN units           cu ON ri.unit_id            = cu.id
      WHERE ri.recipe_id = ?
      ORDER BY ri.id
    `, [req.params.id]);

    // Recalculate price_per_unit and line_cost using CURRENT inventory purchase_price + unit conversion
    ings.forEach(ing => {
      const basePrice = parseFloat(ing.base_purchase_price || 0);
      const livePrice = convertUnitPrice(
        basePrice,
        ing.base_unit_abbr,    null, ing.base_conv_factor,
        ing.chosen_unit_abbr,  null, ing.chosen_conv_factor
      );
      ing.price_per_unit = livePrice;
      ing.line_cost      = (parseFloat(ing.quantity) || 0) * livePrice;
    });

    const [staff] = await db.query(`
      SELECT rss.*,
        u.id AS user_id, u.name AS user_name, u.designation, u.role AS user_role,
        u.monthly_salary, u.work_days_month,
        -- Live per_minute = monthly_salary / (work_days * 8h * 60min)
        ROUND(u.monthly_salary / (COALESCE(u.work_days_month,26) * 8 * 60), 8) AS per_minute_live,
        -- Legacy salary_profile fields (kept for backward compat)
        sp.role_name, sp.per_minute AS per_minute_profile
      FROM recipe_salary_staff rss
      LEFT JOIN users u ON rss.user_id = u.id
      LEFT JOIN salary_profiles sp ON rss.salary_id = sp.id
      WHERE rss.recipe_id = ?
      ORDER BY rss.id
    `, [req.params.id]);

    res.json({ success: true, data: ings, staff });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── POST create ───────────────────────────────────────────
router.post('/', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const {
      name, description, is_master, yield_qty, yield_unit_id, serves, course_id,
      cook_minutes, wastage_percent, fuel_profile_id,
      ingredient_cost, wastage_cost, salary_total_cost, fuel_cost,
      total_cost, cost_per_unit,
      ingredients, staff_list   // staff_list = [{salary_id, staff_count, line_cost}]
    } = req.body;

    if (!name || !Array.isArray(ingredients) || !ingredients.length) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ success: false, message: 'Name and at least one ingredient required.' });
    }
    const isMaster = is_master ? 1 : 0;
    if (isMaster && !yield_unit_id) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ success: false, message: 'Yield unit required for Recipe Master.' });
    }
    if (!isMaster && !course_id) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ success: false, message: 'Course required for Menu Recipe.' });
    }

    const [rr] = await conn.query(
      `INSERT INTO recipes (name, description, is_master, yield_qty, yield_unit_id, serves, course_id,
         cook_minutes, wastage_percent, fuel_profile_id,
         ingredient_cost, wastage_cost, salary_total_cost, fuel_cost,
         total_cost, cost_per_unit, is_active)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
      [name.trim(), description||null, isMaster,
       parseFloat(yield_qty)||1,
       isMaster ? (parseInt(yield_unit_id)||null) : null,
       isMaster ? null : (parseFloat(serves)||parseFloat(yield_qty)||1),
       isMaster ? null : (parseInt(course_id)||null),
       parseInt(cook_minutes)||0, parseFloat(wastage_percent)||0,
       fuel_profile_id ? parseInt(fuel_profile_id) : null,
       parseFloat(ingredient_cost)||0, parseFloat(wastage_cost)||0,
       parseFloat(salary_total_cost)||0, parseFloat(fuel_cost)||0,
       parseFloat(total_cost)||0, parseFloat(cost_per_unit)||0]
    );
    const recipeId = rr.insertId;

    // Insert ingredients
    for (const ing of ingredients) {
      await conn.query(
        `INSERT INTO recipe_items (recipe_id, inventory_item_id, unit_id, quantity, price_per_unit, line_cost)
         VALUES (?,?,?,?,?,?)`,
        [recipeId, ing.inventory_item_id, ing.unit_id||null,
         parseFloat(ing.quantity), parseFloat(ing.price_per_unit)||0, parseFloat(ing.line_cost)||0]
      );
    }

    // Insert staff list
    if (Array.isArray(staff_list)) {
      for (const s of staff_list) {
        if (!s.user_id) continue; // must have a user selected
        // Compute live per_minute from user's actual salary
        let perMin = parseFloat(s.per_minute) || 0;
        const [[u]] = await conn.query('SELECT monthly_salary, work_days_month, hours_per_day FROM users WHERE id=?', [s.user_id]);
        if (u) perMin = parseFloat(u.monthly_salary) / ((parseFloat(u.work_days_month)||26) * (parseFloat(u.hours_per_day)||8) * 60);
        const count    = parseFloat(s.staff_count) || 1;
        const mins     = parseInt(cook_minutes) || 0;
        const lineCost = perMin * mins * count;
        await conn.query(
          `INSERT INTO recipe_salary_staff (recipe_id, user_id, staff_count, per_minute, line_cost) VALUES (?,?,?,?,?)`,
          [recipeId, parseInt(s.user_id), count, perMin, lineCost]
        );
      }
    }

    // Sync to inventory only if Recipe Master
    if (isMaster) {
      const catId = await getOrCreateRecipeMasterCategoryId(conn);
      const cpp = parseFloat(cost_per_unit)||0;
      const [ex] = await conn.query('SELECT id FROM inventory_items WHERE name=? AND category_id=?', [name.trim(), catId]);
      if (ex.length) {
        await conn.query(
          'UPDATE inventory_items SET purchase_price=?,selling_price=?,unit_id=?,notes=?,updated_at=NOW() WHERE id=?',
          [cpp, cpp, parseInt(yield_unit_id)||null, 'Recipe Master id='+recipeId, ex[0].id]
        );
      } else {
        await conn.query(
          'INSERT INTO inventory_items (name,category_id,unit_id,current_quantity,purchase_price,selling_price,notes) VALUES (?,?,?,0,?,?,?)',
          [name.trim(), catId, parseInt(yield_unit_id)||null, cpp, cpp, 'Recipe Master id='+recipeId]
        );
      }
    }

    await conn.commit();
    res.status(201).json({ success: true, data: { id: recipeId } });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Recipe name already exists.' });
    res.status(500).json({ success: false, message: err.message });
  } finally { conn.release(); }
});

// ── PUT update ────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const {
      name, description, is_master, yield_qty, yield_unit_id, serves, course_id,
      cook_minutes, wastage_percent, fuel_profile_id,
      ingredient_cost, wastage_cost, salary_total_cost, fuel_cost,
      total_cost, cost_per_unit,
      ingredients, staff_list
    } = req.body;

    if (!name || !Array.isArray(ingredients) || !ingredients.length) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ success: false, message: 'Name and at least one ingredient required.' });
    }

    const [oldRows] = await conn.query('SELECT name, is_master FROM recipes WHERE id=?', [req.params.id]);
    if (!oldRows.length) { await conn.rollback(); conn.release(); return res.status(404).json({ success: false, message: 'Not found.' }); }
    const oldName   = oldRows[0].name;
    const wasMaster = !!oldRows[0].is_master;
    const isMaster  = !!is_master;

    await conn.query(
      `UPDATE recipes SET name=?,description=?,is_master=?,yield_qty=?,yield_unit_id=?,serves=?,course_id=?,
         cook_minutes=?,wastage_percent=?,fuel_profile_id=?,
         ingredient_cost=?,wastage_cost=?,salary_total_cost=?,fuel_cost=?,
         total_cost=?,cost_per_unit=? WHERE id=?`,
      [name.trim(), description||null, isMaster?1:0,
       parseFloat(yield_qty)||1,
       isMaster ? (parseInt(yield_unit_id)||null) : null,
       isMaster ? null : (parseFloat(serves)||parseFloat(yield_qty)||1),
       isMaster ? null : (parseInt(course_id)||null),
       parseInt(cook_minutes)||0, parseFloat(wastage_percent)||0,
       fuel_profile_id ? parseInt(fuel_profile_id) : null,
       parseFloat(ingredient_cost)||0, parseFloat(wastage_cost)||0,
       parseFloat(salary_total_cost)||0, parseFloat(fuel_cost)||0,
       parseFloat(total_cost)||0, parseFloat(cost_per_unit)||0, req.params.id]
    );

    // Replace ingredients — always use live inventory price
    await conn.query('DELETE FROM recipe_items WHERE recipe_id=?', [req.params.id]);
    for (const ing of ingredients) {
      const { price: livePrice } = await getLivePriceForIng(conn, ing);
      const qty      = parseFloat(ing.quantity) || 0;
      const lineCost = qty * livePrice;
      await conn.query(
        `INSERT INTO recipe_items (recipe_id,inventory_item_id,unit_id,quantity,price_per_unit,line_cost) VALUES (?,?,?,?,?,?)`,
        [req.params.id, ing.inventory_item_id, ing.unit_id||null, qty, livePrice, lineCost]
      );
    }

    // Replace staff list with live salary calculations
    await conn.query('DELETE FROM recipe_salary_staff WHERE recipe_id=?', [req.params.id]);
    if (Array.isArray(staff_list)) {
      for (const s of staff_list) {
        if (!s.user_id) continue; // must have a user selected
        let perMin = parseFloat(s.per_minute) || 0;
        const [[u]] = await conn.query('SELECT monthly_salary, work_days_month, hours_per_day FROM users WHERE id=?', [s.user_id]);
        if (u) perMin = parseFloat(u.monthly_salary) / ((parseFloat(u.work_days_month)||26) * (parseFloat(u.hours_per_day)||8) * 60);
        const count    = parseFloat(s.staff_count) || 1;
        const mins     = parseInt(cook_minutes) || 0;
        const lineCost = perMin * mins * count;
        await conn.query(
          `INSERT INTO recipe_salary_staff (recipe_id, user_id, staff_count, per_minute, line_cost) VALUES (?,?,?,?,?)`,
          [req.params.id, parseInt(s.user_id), count, perMin, lineCost]
        );
      }
    }

    // Inventory sync for Recipe Master — MUST happen BEFORE cascade
    // so that getLivePriceForIng picks up the NEW price when cascading to parent recipes
    const catId = await getOrCreateRecipeMasterCategoryId(conn);
    const cpp = parseFloat(cost_per_unit)||0;
    if (isMaster) {
      const [byOld] = await conn.query('SELECT id FROM inventory_items WHERE name=? AND category_id=?', [oldName, catId]);
      if (byOld.length) {
        await conn.query(
          'UPDATE inventory_items SET name=?,purchase_price=?,selling_price=?,unit_id=?,notes=?,updated_at=NOW() WHERE id=?',
          [name.trim(), cpp, cpp, parseInt(yield_unit_id)||null, 'Recipe Master id='+req.params.id, byOld[0].id]
        );
      } else {
        const [byNew] = await conn.query('SELECT id FROM inventory_items WHERE name=? AND category_id=?', [name.trim(), catId]);
        if (byNew.length) {
          await conn.query('UPDATE inventory_items SET purchase_price=?,selling_price=?,unit_id=?,notes=?,updated_at=NOW() WHERE id=?',
            [cpp, cpp, parseInt(yield_unit_id)||null, 'Recipe Master id='+req.params.id, byNew[0].id]);
        } else {
          await conn.query('INSERT INTO inventory_items (name,category_id,unit_id,current_quantity,purchase_price,selling_price,notes) VALUES (?,?,?,0,?,?,?)',
            [name.trim(), catId, parseInt(yield_unit_id)||null, cpp, cpp, 'Recipe Master id='+req.params.id]);
        }
      }
    } else if (wasMaster) {
      await conn.query('DELETE FROM inventory_items WHERE name=? AND category_id=?', [oldName, catId]);
    }

    // Auto-sync menu items and cascade to parent recipes — AFTER inventory item is updated
    await syncMenuItemsCost(conn, req.params.id, parseFloat(cost_per_unit)||0);

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally { conn.release(); }
});

// ── PATCH toggle ──────────────────────────────────────────
router.patch('/:id/toggle', async (req, res) => {
  try {
    await db.query('UPDATE recipes SET is_active=? WHERE id=?', [req.body.is_active?1:0, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── DELETE ────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT name, is_master FROM recipes WHERE id=?', [req.params.id]);
    if (!rows.length) { await conn.rollback(); conn.release(); return res.status(404).json({ success: false, message: 'Not found.' }); }
    if (rows[0].is_master) {
      const [catRows] = await conn.query("SELECT id FROM categories WHERE name='Recipe Master' LIMIT 1");
      if (catRows.length) await conn.query('DELETE FROM inventory_items WHERE name=? AND category_id=?', [rows[0].name, catRows[0].id]);
    }
    await conn.query('DELETE FROM recipe_salary_staff WHERE recipe_id=?', [req.params.id]);
    await conn.query('DELETE FROM recipe_items WHERE recipe_id=?', [req.params.id]);
    await conn.query('DELETE FROM recipes WHERE id=?', [req.params.id]);
    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally { conn.release(); }
});

// ── Recalc all recipes using a given inventory item ─────────────────────────
// Called when inventory purchase_price changes.
// Finds every recipe that has this item as an ingredient,
// fully recalculates it (ingredients + wastage + staff + fuel),
// updates recipe + recipe_items, then cascades upward via cascadeRecipeCost.
async function recalcRecipesUsingItem(conn, inventoryItemId) {
  // Find all recipes that directly use this inventory item
  const [recipes] = await conn.query(
    `SELECT DISTINCT r.id, r.is_master, r.yield_qty, r.serves,
            r.wastage_percent, r.cook_minutes, r.fuel_profile_id
     FROM recipe_items ri
     JOIN recipes r ON ri.recipe_id = r.id
     WHERE ri.inventory_item_id = ?`,
    [inventoryItemId]
  );

  for (const recipe of recipes) {
    // Get all ingredients for this recipe
    const [ings] = await conn.query(
      `SELECT ri.id AS ri_id, ri.quantity, ri.unit_id, ri.inventory_item_id
       FROM recipe_items ri WHERE ri.recipe_id = ?`,
      [recipe.id]
    );

    // Recalculate each ingredient line cost using live price + unit conversion
    let ingCost = 0;
    for (const i of ings) {
      const { price } = await getLivePriceForIng(conn, {
        inventory_item_id: i.inventory_item_id,
        unit_id: i.unit_id,
      });
      const lineCost = (parseFloat(i.quantity) || 0) * price;
      ingCost += lineCost;
      // Update stored price_per_unit and line_cost in recipe_items
      await conn.query(
        `UPDATE recipe_items SET price_per_unit=?, line_cost=? WHERE id=?`,
        [price, lineCost, i.ri_id]
      );
    }

    // Fuel cost
    let fuelCost = 0;
    if (recipe.fuel_profile_id && recipe.cook_minutes) {
      const [[fp]] = await conn.query('SELECT per_minute FROM fuel_profiles WHERE id=?', [recipe.fuel_profile_id]);
      if (fp) fuelCost = parseFloat(fp.per_minute) * parseFloat(recipe.cook_minutes);
    }

    // Staff cost
    const [staff] = await conn.query(
      `SELECT staff_count, per_minute FROM recipe_salary_staff WHERE recipe_id=?`,
      [recipe.id]
    );
    const staffCost = staff.reduce((s, st) =>
      s + (parseFloat(st.per_minute) || 0) * (parseFloat(recipe.cook_minutes) || 0) * (parseFloat(st.staff_count) || 1), 0
    );

    const wastageCost = ingCost * ((parseFloat(recipe.wastage_percent) || 0) / 100);
    const totalCost   = ingCost + wastageCost + staffCost + fuelCost;
    const divisor     = recipe.is_master ? (parseFloat(recipe.yield_qty) || 1) : (parseFloat(recipe.serves) || 1);
    const newCpp      = divisor > 0 ? totalCost / divisor : totalCost;

    // Update recipe totals
    await conn.query(
      `UPDATE recipes SET ingredient_cost=?, wastage_cost=?, fuel_cost=?, salary_total_cost=?,
              total_cost=?, cost_per_unit=? WHERE id=?`,
      [ingCost, wastageCost, fuelCost, staffCost, totalCost, newCpp, recipe.id]
    );

    // Now cascade: update inventory item (if master) + propagate to parent recipes + menu items
    await cascadeRecipeCost(conn, recipe.id, newCpp, new Set());
  }
}

module.exports = router;
module.exports.recalcRecipesUsingItem = recalcRecipesUsingItem;
