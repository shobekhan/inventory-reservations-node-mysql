import { createInventory, getAvailableInventory } from './inventory'

import { pool } from './db'

async function main() {
  // Create an inventory of 5 items
  await createInventory('shop-1', 'sku-100', 5)

  console.log(
    'Available:',
    await getAvailableInventory('shop-1', 'sku-100')
  )

  await pool.end()
}

main().catch(async (error) => {
  console.error(error)

  await pool.end()

  process.exit(1)
})