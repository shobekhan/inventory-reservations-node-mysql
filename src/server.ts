import express from 'express'

import {
  claimReservation,
  createInventory,
  getAvailableInventory,
  release,
  reserveInventory
} from './inventory'

const app = express()

app.use(express.json())

const message = (error: unknown) => {
  if (error instanceof Error) {
    return error.message
  }

  return 'UNKNOWN_ERROR'
}

app.post('/inventory', async (req, res) => {
  try {
    await createInventory(
      req.body.shopId,
      req.body.inventoryItemId,
      Number(req.body.quantity)
    )

    res.status(201).json({
      success: true
    })
  } catch (error) {
    res.status(500).json({
      error: message(error)
    })
  }
})

app.get('/inventory/:shopId/:itemId', async (req, res) => {
  try {
    const available = await getAvailableInventory(
      req.params.shopId,
      req.params.itemId
    )

    res.json({
      available
    })
  } catch (error) {
    res.status(500).json({
      error: message(error)
    })
  }
})

app.post('/reservations', async (req, res) => {
  try {
    const ttlSeconds =
      req.body.ttlSeconds === undefined
        ? 300
        : Number(req.body.ttlSeconds)

    const reservationId = await reserveInventory(
      req.body.shopId,
      req.body.inventoryItemId,
      Number(req.body.quantity),
      ttlSeconds
    )

    res.status(201).json({
      reservationId
    })
  } catch (error) {
    const errorMessage = message(error)

    res
      .status(errorMessage === 'INSUFFICIENT_INVENTORY' ? 409 : 500)
      .json({
        error: errorMessage
      })
  }
})

app.post('/reservations/:id/claim', async (req, res) => {
  try {
    await claimReservation(req.params.id)

    res.json({
      success: true
    })
  } catch (error) {
    res.status(409).json({
      error: message(error)
    })
  }
})

app.post('/reservations/:id/release', async (req, res) => {
  try {
    await release(req.params.id)

    res.json({
      success: true
    })
  } catch (error) {
    res.status(409).json({
      error: message(error)
    })
  }
})

app.listen(Number(process.env.PORT ?? 3000), () => {
  console.log('Inventory API listening on port 3000')
})
