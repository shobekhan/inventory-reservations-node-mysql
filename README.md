# Article

https://shopify.engineering/scaling-inventory-reservations

# Node + MySQL Inventory Reservations

TypeScript + Node.js + MySQL 8 implementation of an inventory reservation pool using `FOR UPDATE SKIP LOCKED`.

## Run

```bash
docker compose up --build
```

Seed 5 units:

```bash
docker compose exec app npm run seed
```

Check inventory:

```bash
curl http://localhost:3000/inventory/shop-1/sku-100
```

Reserve 2 units:

```bash
curl -X POST http://localhost:3000/reservations -H 'Content-Type: application/json' -d '{"shopId":"shop-1","inventoryItemId":"sku-100","quantity":2}'
```

Run the concurrency test:

```bash
docker compose exec app npm run concurrency-test
```

The test starts 20 concurrent one-unit reservations against 5 units. Expected: 5 successful and 15 failed.

## Core query

```sql
SELECT inventory_group_id, unit_id
FROM reservation_units
WHERE shop_id = ?
  AND inventory_item_id = ?
  AND reservation_id IS NULL
ORDER BY inventory_group_id, unit_id
LIMIT ?
FOR UPDATE SKIP LOCKED;
```

Each unit is a row. `FOR UPDATE` locks selected units while the transaction is running; `SKIP LOCKED` lets competing transactions skip units already locked by another checkout rather than waiting for them.
