import type { PoolClient } from 'pg'
import { pool } from '../db/pool.ts'

type TradeStatus = 'open' | 'closed' | 'rolled'

type TradeSide = 'credit' | 'debit'

type OptionType = 'call' | 'put'

type Position = 'long' | 'short'

export interface OptionLegRecord {
  id: string
  legType: OptionType
  position: Position
  strike: number
  expiry: string
  quantity: number
  price: number | null
}

export interface TradeRecord {
  id: string
  userId: string
  symbol: string
  strategy: string | null
  status: TradeStatus
  openedAt: string
  closedAt: string | null
  netCredit: number | null
  netDebit: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
  legs: OptionLegRecord[]
}

export interface TradeInput {
  symbol: string
  strategy?: string | null
  status?: TradeStatus
  openedAt?: Date
  closedAt?: Date | null
  notes?: string | null
  side: TradeSide
  entryPrice: number
  quantity: number
  optionType: OptionType
  strike: number
  expiry: Date
}

const baseSelect = `
  SELECT
    t.id,
    t.user_id AS "userId",
    t.symbol,
    t.strategy,
    t.status,
    to_char(t.opened_at, 'YYYY-MM-DD') AS "openedAt",
    CASE WHEN t.closed_at IS NULL THEN NULL ELSE to_char(t.closed_at, 'YYYY-MM-DD') END AS "closedAt",
    t.net_credit AS "netCredit",
    t.net_debit AS "netDebit",
    t.notes,
    t.created_at AS "createdAt",
    t.updated_at AS "updatedAt",
    COALESCE(
      json_agg(
        jsonb_build_object(
          'id', l.id,
          'legType', l.leg_type,
          'position', l.position,
          'strike', l.strike,
          'expiry', to_char(l.expiry, 'YYYY-MM-DD'),
          'quantity', l.quantity,
          'price', l.price
        )
        ORDER BY l.created_at ASC
      ) FILTER (WHERE l.id IS NOT NULL),
      '[]'
    ) AS legs
  FROM trades t
  LEFT JOIN option_legs l ON l.trade_id = t.id
`

const orderClause = ' ORDER BY t.opened_at DESC, t.created_at DESC'

export async function listTrades(userId: string): Promise<TradeRecord[]> {
  const query = `${baseSelect} WHERE t.user_id = $1 GROUP BY t.id${orderClause}`
  const { rows } = await pool.query(query, [userId])
  return rows.map(normalizeTradeRow)
}

export async function findTrade(
  userId: string,
  tradeId: string,
): Promise<TradeRecord | null> {
  const query = `${baseSelect} WHERE t.user_id = $1 AND t.id = $2 GROUP BY t.id`
  const { rows } = await pool.query(query, [userId, tradeId])
  return rows.length ? normalizeTradeRow(rows[0]) : null
}

export async function createTrade(
  userId: string,
  payload: TradeInput,
): Promise<TradeRecord> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const netCredit = payload.side === 'credit' ? payload.entryPrice * payload.quantity : null
    const netDebit = payload.side === 'debit' ? payload.entryPrice * payload.quantity : null

    const tradeResult = await client.query(
      `INSERT INTO trades (user_id, symbol, strategy, status, opened_at, closed_at, net_credit, net_debit, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        userId,
        payload.symbol,
        payload.strategy ?? null,
        payload.status ?? 'open',
        payload.openedAt ?? new Date(),
        payload.closedAt ?? null,
        netCredit,
        netDebit,
        payload.notes ?? null,
      ],
    )

    const tradeId = tradeResult.rows[0].id as string
    const position: Position = payload.side === 'credit' ? 'short' : 'long'

    await insertLeg(client, {
      tradeId,
      legType: payload.optionType,
      position,
      strike: payload.strike,
      expiry: payload.expiry,
      quantity: payload.quantity,
      price: payload.entryPrice,
    })

    await client.query('COMMIT')
    const trade = await findTradeWithClient(client, userId, tradeId)
    if (!trade) {
      throw new Error('Failed to load trade after creation')
    }
    return trade
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function updateTrade(
  userId: string,
  tradeId: string,
  payload: Partial<TradeInput>,
): Promise<TradeRecord | null> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const current = await findTradeWithClient(client, userId, tradeId)
    if (!current) {
      await client.query('ROLLBACK')
      return null
    }

    const side = payload.side ?? (current.netCredit !== null ? 'credit' : 'debit')
    const entryPrice = payload.entryPrice ?? current.legs[0]?.price ?? 0
    const quantity = payload.quantity ?? current.legs[0]?.quantity ?? 1

    const netCredit = side === 'credit' ? entryPrice * quantity : null
    const netDebit = side === 'debit' ? entryPrice * quantity : null

    await client.query(
      `UPDATE trades
       SET symbol = $1,
           strategy = $2,
           status = $3,
           opened_at = $4,
           closed_at = $5,
           net_credit = $6,
           net_debit = $7,
           notes = $8,
           updated_at = now()
       WHERE id = $9 AND user_id = $10`,
      [
        payload.symbol ?? current.symbol,
        payload.strategy ?? current.strategy,
        payload.status ?? current.status,
        payload.openedAt ?? new Date(current.openedAt),
        payload.closedAt ?? (current.closedAt ? new Date(current.closedAt) : null),
        netCredit,
        netDebit,
        payload.notes ?? current.notes,
        tradeId,
        userId,
      ],
    )

    await client.query('DELETE FROM option_legs WHERE trade_id = $1', [tradeId])

    const newSide = side === 'credit' ? 'short' : 'long'

    await insertLeg(client, {
      tradeId,
      legType: payload.optionType ?? current.legs[0]?.legType ?? 'call',
      position: newSide,
      strike: payload.strike ?? current.legs[0]?.strike ?? 0,
      expiry:
        payload.expiry ??
        (current.legs[0]?.expiry ? new Date(current.legs[0].expiry) : new Date()),
      quantity,
      price: entryPrice,
    })

    await client.query('COMMIT')
    return await findTradeWithClient(client, userId, tradeId)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function removeTrade(
  userId: string,
  tradeId: string,
): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM trades WHERE id = $1 AND user_id = $2',
    [tradeId, userId],
  )
  return (rowCount ?? 0) > 0
}

async function findTradeWithClient(
  client: PoolClient,
  userId: string,
  tradeId: string,
): Promise<TradeRecord | null> {
  const query = `${baseSelect} WHERE t.user_id = $1 AND t.id = $2 GROUP BY t.id`
  const { rows } = await client.query(query, [userId, tradeId])
  return rows.length ? normalizeTradeRow(rows[0]) : null
}

interface InsertLegInput {
  tradeId: string
  legType: OptionType
  position: Position
  strike: number
  expiry: Date
  quantity: number
  price: number
}

async function insertLeg(client: PoolClient, leg: InsertLegInput): Promise<void> {
  await client.query(
    `INSERT INTO option_legs (trade_id, leg_type, position, strike, expiry, quantity, price)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      leg.tradeId,
      leg.legType,
      leg.position,
      leg.strike,
      leg.expiry,
      leg.quantity,
      leg.price,
    ],
  )
}

function normalizeTradeRow(row: any): TradeRecord {
  const legs = Array.isArray(row.legs)
    ? row.legs.map((leg: any) => ({
        id: leg.id,
        legType: leg.legType,
        position: leg.position,
        strike: Number(leg.strike),
        expiry: leg.expiry,
        quantity: Number(leg.quantity),
        price: typeof leg.price === 'number' ? leg.price : leg.price ? Number(leg.price) : null,
      }))
    : []

  return {
    id: row.id,
    userId: row.userId,
    symbol: row.symbol,
    strategy: row.strategy,
    status: row.status,
    openedAt: row.openedAt,
    closedAt: row.closedAt,
    netCredit: row.netCredit === null ? null : Number(row.netCredit),
    netDebit: row.netDebit === null ? null : Number(row.netDebit),
    notes: row.notes,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
    legs,
  }
}
