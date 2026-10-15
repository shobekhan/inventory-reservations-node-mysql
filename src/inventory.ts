import { randomUUID } from 'node:crypto'
import type { PoolConnection } from 'mysql2/promise'

import { pool, transaction } from './db'

export async function createInventory(
  shopId: string,
  itemId: string,
  quantity: number
): Promise<void> {
  await transaction(async (connection) => {
    await connection.query(
      `
        INSERT INTO inventory_items (
          shop_id,
          inventory_item_id,
          total_quantity
        )
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
          total_quantity = VALUES(total_quantity)
      `,
      [shopId, itemId, quantity]
    )

    await connection.query(
      `
        DELETE FROM reservation_units
        WHERE shop_id = ?
          AND inventory_item_id = ?
      `,
      [shopId, itemId]
    )

    if (quantity > 0) {
      const values: Array<string | number> = []

      for (let unitId = 1; unitId <= quantity; unitId++) {
        values.push(shopId, itemId, 1, unitId)
      }

      const placeholders = Array.from(
        { length: quantity },
        () => '(?, ?, ?, ?)'
      ).join(', ')

      await connection.query(
        `
          INSERT INTO reservation_units (
            shop_id,
            inventory_item_id,
            inventory_group_id,
            unit_id
          )
          VALUES ${placeholders}
        `,
        values
      )
    }
  })
}

export async function getAvailableInventory(
  shopId: string,
  itemId: string
): Promise<number> {
  const [rows] = await pool.query(
    `
      SELECT COUNT(*) AS available
      FROM reservation_units
      WHERE shop_id = ?
        AND inventory_item_id = ?
        AND reservation_id IS NULL
    `,
    [shopId, itemId]
  )

  return Number(
    (rows as Array<{ available: number }>)[0]?.available ?? 0
  )
}

export async function reserveInventory(
  shopId: string,
  itemId: string,
  quantity: number,
  ttlSeconds = 300
): Promise<string> {
  if (quantity <= 0) {
    throw new Error('Quantity must be greater than zero')
  }

  return transaction(async (connection) => {
    const [rows] = await connection.query(
      `
        SELECT
          inventory_group_id,
          unit_id
        FROM reservation_units
        WHERE shop_id = ?
          AND inventory_item_id = ?
          AND reservation_id IS NULL
        ORDER BY inventory_group_id, unit_id
        LIMIT ?
        FOR UPDATE SKIP LOCKED
      `,
      [shopId, itemId, quantity]
    )

    const units = rows as Array<{
      inventory_group_id: number
      unit_id: number
    }>

    if (units.length !== quantity) {
      throw new Error('INSUFFICIENT_INVENTORY')
    }

    const reservationId = randomUUID()
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000)

    await connection.query(
      `
        INSERT INTO reservations (
          id,
          shop_id,
          inventory_item_id,
          quantity,
          status,
          expires_at
        )
        VALUES (?, ?, ?, ?, 'reserved', ?)
      `,
      [
        reservationId,
        shopId,
        itemId,
        quantity,
        expiresAt
      ]
    )

    for (const unit of units) {
      await connection.query(
        `
          UPDATE reservation_units
          SET
            reservation_id = ?,
            reserved_until = ?
          WHERE shop_id = ?
            AND inventory_item_id = ?
            AND inventory_group_id = ?
            AND unit_id = ?
        `,
        [
          reservationId,
          expiresAt,
          shopId,
          itemId,
          unit.inventory_group_id,
          unit.unit_id
        ]
      )
    }

    return reservationId
  })
}

export async function claimReservation(
  id: string
): Promise<void> {
  await transaction(async (connection) => {
    const [rows] = await connection.query(
      `
        SELECT
          id,
          status,
          expires_at
        FROM reservations
        WHERE id = ?
        FOR UPDATE
      `,
      [id]
    )

    const reservation = (
      rows as Array<{
        id: string
        status: string
        expires_at: Date
      }>
    )[0]

    if (!reservation) {
      throw new Error('RESERVATION_NOT_FOUND')
    }

    if (reservation.status !== 'reserved') {
      throw new Error(`INVALID_STATUS_${reservation.status}`)
    }

    if (
      new Date(reservation.expires_at).getTime() <=
      Date.now()
    ) {
      await releaseReservation(
        connection,
        id,
        'expired'
      )

      throw new Error('RESERVATION_EXPIRED')
    }

    await connection.query(
      `
        UPDATE reservations
        SET status = 'claimed'
        WHERE id = ?
      `,
      [id]
    )
  })
}

async function releaseReservation(
  connection: PoolConnection,
  id: string,
  status: 'released' | 'expired' = 'released'
): Promise<void> {
  await connection.query(
    `
      UPDATE reservation_units
      SET
        reservation_id = NULL,
        reserved_until = NULL
      WHERE reservation_id = ?
    `,
    [id]
  )

  await connection.query(
    `
      UPDATE reservations
      SET status = ?
      WHERE id = ?
    `,
    [status, id]
  )
}

export async function release(
  id: string
): Promise<void> {
  await transaction(async (connection) => {
    const [rows] = await connection.query(
      `
        SELECT
          id,
          status
        FROM reservations
        WHERE id = ?
        FOR UPDATE
      `,
      [id]
    )

    const reservation = (
      rows as Array<{
        id: string
        status: string
      }>
    )[0]

    if (!reservation) {
      throw new Error('RESERVATION_NOT_FOUND')
    }

    if (reservation.status !== 'reserved') {
      throw new Error(
        `INVALID_STATUS_${reservation.status}`
      )
    }

    await releaseReservation(connection, id)
  })
}