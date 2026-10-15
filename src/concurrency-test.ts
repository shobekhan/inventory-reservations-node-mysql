import {
  createInventory,
  getAvailableInventory,
  reserveInventory
} from './inventory'

import { pool } from './db'

async function main() {
  const shop = 'concurrency-shop'
  const item = 'sku-1'

  // Create an inventory of 5 items
  await createInventory(shop, item, 5)

  // Attempt to reserve 1 item 20 times concurrently
  const results = await Promise.all(
    Array.from(
      { length: 20 },
      () =>
        reserveInventory(shop, item, 1)
          .then((id) => ({
            ok: true,
            id
          }))
          .catch((error) => ({
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : 'UNKNOWN_ERROR'
          }))
    )
  )

  console.log(
    'Successful reservations:',
    results.filter((result) => result.ok).length
  )

  console.log(
    'Failed reservations:',
    results.filter((result) => !result.ok).length
  )

  console.log(
    'Available inventory:',
    await getAvailableInventory(shop, item)
  )

  await pool.end()
}

main().catch(async (error) => {
  console.error(error)

  await pool.end()

  process.exit(1)
})
