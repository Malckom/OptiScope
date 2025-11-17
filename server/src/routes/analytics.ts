import { Router } from 'express'
import type { Response } from 'express'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js'
import { calculateAnalyticsSnapshot } from '../services/analytics.js'
import {
  getLatestAnalyticsSnapshot,
  upsertAnalyticsSnapshot,
} from '../models/analytics.js'

const router = Router()
const ONE_DAY_MS = 24 * 60 * 60 * 1000

router.get(
  '/summary',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id
    const existing = await getLatestAnalyticsSnapshot(userId)
    const now = Date.now()

    const shouldRecompute = !existing || now - new Date(existing.calculatedAt).getTime() > ONE_DAY_MS

    if (!shouldRecompute && existing) {
      res.json({
        data: existing.snapshot,
        reportDate: existing.reportDate,
        calculatedAt: existing.calculatedAt,
        refreshed: false,
      })
      return
    }

    const snapshot = await calculateAnalyticsSnapshot(userId)
    const stored = await upsertAnalyticsSnapshot(userId, snapshot)

    res.json({
      data: stored.snapshot,
      reportDate: stored.reportDate,
      calculatedAt: stored.calculatedAt,
      refreshed: true,
    })
  },
)

router.post(
  '/recalculate',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id
    const snapshot = await calculateAnalyticsSnapshot(userId)
    const stored = await upsertAnalyticsSnapshot(userId, snapshot)
    res.status(201).json({
      data: stored.snapshot,
      reportDate: stored.reportDate,
      calculatedAt: stored.calculatedAt,
      refreshed: true,
    })
  },
)

export default router
