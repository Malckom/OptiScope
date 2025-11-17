import type { NextFunction, Request, Response } from 'express'
import { pool } from '../db/pool.js'
import { verifyToken } from '../lib/token.js'

export type AuthenticatedRequest<
  Params = Record<string, string>,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = Record<string, string | string[]>,
> = Request<Params, ResBody, ReqBody, ReqQuery>

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization

  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Authorization header missing' })
    return
  }

  const token = header.slice('Bearer '.length)

  let payload: { sub: string; email: string }

  try {
    payload = verifyToken(token)
  } catch (error) {
    console.error('Token verification failed:', error)
    res.status(401).json({ message: 'Invalid or expired token' })
    return
  }

  try {
    const { rows } = await pool.query<{ id: string; email: string }>(
      'SELECT id, email FROM users WHERE id = $1',
      [payload.sub],
    )

    if (!rows.length) {
      res.status(401).json({ message: 'Account no longer exists' })
      return
    }

    const user = rows[0]
    req.user = { id: user.id, email: user.email }
    next()
  } catch (error) {
    console.error('Authentication lookup failed:', error)
    res.status(500).json({ message: 'Unable to verify account' })
  }
}
