import type { TradeRecord } from '../models/trade.js'
import { listTrades } from '../models/trade.js'

export type StrategyKey =
  | 'single'
  | 'verticalSpread'
  | 'ironCondor'
  | 'other'

export interface StrategyMetric {
  strategy: StrategyKey
  total: number
  wins: number
  losses: number
  averagePnl: number
}

export interface EquityPoint {
  date: string
  cumulativePnl: number
}

export interface HoldingBucket {
  bucket: string
  count: number
}

export interface AnalyticsSnapshot {
  generatedAt: string
  totals: {
    winRate: number
    averagePnl: number
    averagePnlPct: number
    expectancy: number
    averageHoldDays: number
    closedTrades: number
  }
  strategyBreakdown: StrategyMetric[]
  equityCurve: EquityPoint[]
  holdingPeriods: HoldingBucket[]
}

function classifyStrategy(trade: TradeRecord): StrategyKey {
  const legs = trade.legs
  if (!legs.length) {
    return 'other'
  }

  if (legs.length === 1) {
    return 'single'
  }

  if (legs.length === 2) {
    const [first, second] = legs
    if (first.expiry === second.expiry && first.legType === second.legType) {
      return 'verticalSpread'
    }
    return 'other'
  }

  if (legs.length === 4) {
    const expiries = new Set(legs.map((leg) => leg.expiry))
    const positions = legs.map((leg) => leg.position)
    const hasLongAndShort = positions.includes('long') && positions.includes('short')
    const hasBothTypes = legs.some((leg) => leg.legType === 'call') && legs.some((leg) => leg.legType === 'put')
    if (expiries.size === 1 && hasLongAndShort && hasBothTypes) {
      return 'ironCondor'
    }
  }

  return 'other'
}

function daysBetween(start: string, end: string): number {
  const startMs = new Date(start).getTime()
  const endMs = new Date(end).getTime()
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return 0
  }
  const diff = Math.max(0, endMs - startMs)
  return Math.round(diff / (1000 * 60 * 60 * 24))
}

function bucketHoldingPeriod(days: number): string {
  if (days <= 3) {
    return '0-3d'
  }
  if (days <= 7) {
    return '4-7d'
  }
  if (days <= 30) {
    return '8-30d'
  }
  return '31d+'
}

function tradePnl(trade: TradeRecord): number {
  const credit = Number(trade.netCredit ?? 0)
  const debit = Number(trade.netDebit ?? 0)
  return credit - debit
}

function tradeBasis(trade: TradeRecord): number {
  const credit = Math.abs(Number(trade.netCredit ?? 0))
  const debit = Math.abs(Number(trade.netDebit ?? 0))
  const basis = debit > 0 ? debit : credit
  return basis || 1
}

export async function calculateAnalyticsSnapshot(userId: string): Promise<AnalyticsSnapshot> {
  const trades = await listTrades(userId)
  const closedTrades = trades.filter((trade) => Boolean(trade.closedAt))

  const totals = {
    wins: 0,
    losses: 0,
    pnlSum: 0,
    pnlPctSum: 0,
    holdSum: 0,
    winPnlSum: 0,
    lossPnlSum: 0,
  }

  const strategyMap = new Map<StrategyKey, { total: number; wins: number; losses: number; pnlSum: number }>()
  const holdingBuckets = new Map<string, number>()

  const equityBase: EquityPoint[] = []
  let cumulative = 0

  const sortedClosed = [...closedTrades].sort((a, b) => {
    const aDate = a.closedAt ?? a.openedAt
    const bDate = b.closedAt ?? b.openedAt
    return new Date(aDate).getTime() - new Date(bDate).getTime()
  })

  for (const trade of sortedClosed) {
    const pnl = tradePnl(trade)
    cumulative += pnl
    const date = trade.closedAt ?? trade.openedAt
    equityBase.push({ date, cumulativePnl: Number(cumulative.toFixed(2)) })
  }

  for (const trade of closedTrades) {
    const pnl = tradePnl(trade)
    const basis = tradeBasis(trade)
    const pnlPct = (pnl / basis) * 100
    const holdDays = daysBetween(trade.openedAt, trade.closedAt ?? trade.openedAt)
    const bucket = bucketHoldingPeriod(holdDays)
    holdingBuckets.set(bucket, (holdingBuckets.get(bucket) ?? 0) + 1)

    totals.pnlSum += pnl
    totals.pnlPctSum += pnlPct
    totals.holdSum += holdDays

    const strategy = classifyStrategy(trade)
    const currentStrategy = strategyMap.get(strategy) ?? { total: 0, wins: 0, losses: 0, pnlSum: 0 }
    currentStrategy.total += 1
    currentStrategy.pnlSum += pnl

    if (pnl > 0) {
      totals.wins += 1
      totals.winPnlSum += pnl
      currentStrategy.wins += 1
    } else if (pnl < 0) {
      totals.losses += 1
      totals.lossPnlSum += Math.abs(pnl)
      currentStrategy.losses += 1
    } else {
      currentStrategy.total += 0
    }

    strategyMap.set(strategy, currentStrategy)
  }

  const closedCount = closedTrades.length
  const winRate = closedCount ? totals.wins / closedCount : 0
  const averagePnl = closedCount ? totals.pnlSum / closedCount : 0
  const averagePnlPct = closedCount ? totals.pnlPctSum / closedCount : 0
  const averageHoldDays = closedCount ? totals.holdSum / closedCount : 0
  const avgWin = totals.wins ? totals.winPnlSum / totals.wins : 0
  const avgLoss = totals.losses ? totals.lossPnlSum / totals.losses : 0
  const expectancy = avgWin * winRate - avgLoss * (1 - winRate)

  const strategyBreakdown: StrategyMetric[] = Array.from(strategyMap.entries()).map(
    ([strategy, stats]) => ({
      strategy,
      total: stats.total,
      wins: stats.wins,
      losses: stats.losses,
      averagePnl: stats.total ? Number((stats.pnlSum / stats.total).toFixed(2)) : 0,
    }),
  )

  strategyBreakdown.sort((a, b) => b.total - a.total)

  const holdingPeriods: HoldingBucket[] = ['0-3d', '4-7d', '8-30d', '31d+'].map((bucket) => ({
    bucket,
    count: holdingBuckets.get(bucket) ?? 0,
  }))

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      winRate: Number((winRate * 100).toFixed(2)),
      averagePnl: Number(averagePnl.toFixed(2)),
      averagePnlPct: Number(averagePnlPct.toFixed(2)),
      expectancy: Number(expectancy.toFixed(2)),
      averageHoldDays: Number(averageHoldDays.toFixed(2)),
      closedTrades: closedCount,
    },
    strategyBreakdown,
    equityCurve: equityBase,
    holdingPeriods,
  }
}
