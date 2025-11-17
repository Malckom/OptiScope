import { pool } from '../db/pool.js'
import { calculateAnalyticsSnapshot } from '../services/analytics.js'
import { upsertAnalyticsSnapshot } from '../models/analytics.js'

export async function recalculateAnalyticsForUser(userId: string): Promise<void> {
  const snapshot = await calculateAnalyticsSnapshot(userId)
  await upsertAnalyticsSnapshot(userId, snapshot)
}

export async function recalculateAnalyticsForAllUsers(): Promise<void> {
  const result = await pool.query('SELECT id FROM users')
  for (const row of result.rows) {
    await recalculateAnalyticsForUser(row.id as string)
  }
}
