import { pool } from '../db/pool.js'
import type { AnalyticsSnapshot } from '../services/analytics.js'

const DEFAULT_LABEL = 'portfolio'

export interface StoredAnalyticsSnapshot {
  userId: string
  label: string
  reportDate: string
  calculatedAt: string
  snapshot: AnalyticsSnapshot
}

export async function upsertAnalyticsSnapshot(
  userId: string,
  snapshot: AnalyticsSnapshot,
  label: string = DEFAULT_LABEL,
  reportDate: Date = new Date(),
): Promise<StoredAnalyticsSnapshot> {
  const now = new Date()
  const result = await pool.query(
    `INSERT INTO analytics_summaries (user_id, label, report_date, snapshot, calculated_at)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     ON CONFLICT (user_id, label, report_date)
     DO UPDATE SET snapshot = EXCLUDED.snapshot, calculated_at = EXCLUDED.calculated_at
     RETURNING user_id AS "userId", label, report_date AS "reportDate", calculated_at AS "calculatedAt", snapshot`,
    [userId, label, reportDate, JSON.stringify(snapshot), now],
  )

  return {
    userId: result.rows[0].userId,
    label: result.rows[0].label,
    reportDate: result.rows[0].reportDate,
    calculatedAt: result.rows[0].calculatedAt,
    snapshot: result.rows[0].snapshot as AnalyticsSnapshot,
  }
}

export async function getLatestAnalyticsSnapshot(
  userId: string,
  label: string = DEFAULT_LABEL,
): Promise<StoredAnalyticsSnapshot | null> {
  const result = await pool.query(
    `SELECT user_id AS "userId", label, report_date AS "reportDate", calculated_at AS "calculatedAt", snapshot
     FROM analytics_summaries
     WHERE user_id = $1 AND label = $2
     ORDER BY report_date DESC, calculated_at DESC
     LIMIT 1`,
    [userId, label],
  )

  if (!result.rowCount) {
    return null
  }

  const row = result.rows[0]
  return {
    userId: row.userId,
    label: row.label,
    reportDate: row.reportDate,
    calculatedAt: row.calculatedAt,
    snapshot: row.snapshot as AnalyticsSnapshot,
  }
}
