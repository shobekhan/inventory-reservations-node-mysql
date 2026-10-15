import mysql, { PoolConnection } from 'mysql2/promise'

export const pool = mysql.createPool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'inventory',
  password: process.env.DB_PASSWORD ?? 'inventory',
  database: process.env.DB_NAME ?? 'inventory',
  connectionLimit: 20
})

export async function transaction<T>(
  callback: (connection: PoolConnection) => Promise<T>
): Promise<T> {
  const connection = await pool.getConnection()

  try {
    await connection.query(
      'SET TRANSACTION ISOLATION LEVEL READ COMMITTED'
    )

    await connection.beginTransaction()

    const result = await callback(connection)

    await connection.commit()

    return result
  } catch (error) {
    await connection.rollback()

    throw error
  } finally {
    connection.release()
  }
}
