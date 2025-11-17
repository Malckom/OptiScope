import { Router } from 'express'
import type { Response } from 'express'
import { z } from 'zod'
import {
  createTrade,
  findTrade,
  listTrades,
  removeTrade,
  updateTrade,
} from '../models/trade.js'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

const tradeSchema = z.object({
  symbol: z.string().min(1),
  strategy: z.string().max(160).optional(),
  status: z.enum(['open', 'closed', 'rolled']).optional(),
  openedAt: z.coerce.date().optional(),
  closedAt: z.coerce.date().optional(),
  notes: z.string().max(1000).optional(),
  side: z.enum(['credit', 'debit']),
  entryPrice: z.number().nonnegative(),
  quantity: z.number().int().positive(),
  optionType: z.enum(['call', 'put']),
  strike: z.number(),
  expiry: z.coerce.date(),
})

const updateSchema = tradeSchema
  .partial()
  .refine((data: Partial<z.infer<typeof tradeSchema>>) => Object.keys(data).length > 0, {
    message: 'At least one field is required to update a trade.',
  })

type TradeParams = {
  id: string
}

router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const trades = await listTrades(req.user!.id)
  res.json({ trades })
})

router.get(
  '/:id',
  requireAuth,
  async (
    req: AuthenticatedRequest<TradeParams>,
    res: Response,
  ) => {
  const trade = await findTrade(req.user!.id, req.params.id)
  if (!trade) {
    res.status(404).json({ message: 'Trade not found.' })
    return
  }
    res.json({ trade })
  },
)

router.post('/', requireAuth, async (req: AuthenticatedRequest<any, any, z.infer<typeof tradeSchema>>, res: Response) => {
  const parsed = tradeSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
    return
  }

  const trade = await createTrade(req.user!.id, parsed.data)
  res.status(201).json({ trade })
})

router.put(
  '/:id',
  requireAuth,
  async (
    req: AuthenticatedRequest<TradeParams, any, Partial<z.infer<typeof tradeSchema>>>,
    res: Response,
  ) => {
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
    return
  }

  const trade = await updateTrade(req.user!.id, req.params.id, parsed.data)
  if (!trade) {
    res.status(404).json({ message: 'Trade not found.' })
    return
  }
    res.json({ trade })
  },
)

router.delete(
  '/:id',
  requireAuth,
  async (req: AuthenticatedRequest<TradeParams>, res: Response) => {
  const deleted = await removeTrade(req.user!.id, req.params.id)
  if (!deleted) {
    res.status(404).json({ message: 'Trade not found.' })
    return
  }
    res.status(204).send()
  },
)

export default router
