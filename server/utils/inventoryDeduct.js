/**
 * deductInventoryForOrder(conn, orderId, createdBy)
 *
 * Recipe-based deduction only:
 *   menu_items.recipe_id → recipe_items → deduct each ingredient
 *   proportional to quantity sold.
 *
 * If a menu item has no linked recipe, it is silently skipped.
 * Payment is never blocked by inventory errors.
 */
async function deductInventoryForOrder(conn, orderId, createdBy) {
  const [orderItems] = await conn.query(`
    SELECT oi.id, oi.menu_item_id, oi.item_name, oi.quantity,
           mi.recipe_id
    FROM order_items oi
    LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
    WHERE oi.order_id = ?
  `, [orderId]);

  for (const item of orderItems) {
    if (!item.recipe_id) continue; // no recipe linked — skip

    const soldQty = parseFloat(item.quantity);

    const [ingredients] = await conn.query(`
      SELECT ri.inventory_item_id, ri.quantity AS recipe_qty,
             i.name AS ing_name
      FROM recipe_items ri
      JOIN inventory_items i ON ri.inventory_item_id = i.id
      WHERE ri.recipe_id = ?
    `, [item.recipe_id]);

    for (const ing of ingredients) {
      const deductQty = parseFloat(ing.recipe_qty) * soldQty;
      await deductSingle(conn, ing.inventory_item_id, deductQty, orderId, item.item_name, soldQty, createdBy);
    }
  }
}

async function deductSingle(conn, invItemId, deductQty, orderId, menuItemName, soldQty, createdBy) {
  const [[inv]] = await conn.query(
    'SELECT current_quantity FROM inventory_items WHERE id=? FOR UPDATE',
    [invItemId]
  );
  if (!inv) return;

  const before = parseFloat(inv.current_quantity);
  const after  = Math.max(0, before - deductQty);

  await conn.query('UPDATE inventory_items SET current_quantity=? WHERE id=?', [after, invItemId]);

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
