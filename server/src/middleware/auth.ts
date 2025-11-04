import type { NextFunction, Request, Response } from 'express'
import { verifyToken } from '../lib/token.ts'

export type AuthenticatedRequest<
  Params = Record<string, string>,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = Record<string, string | string[]>,
> = Request<Params, ResBody, ReqBody, ReqQuery>

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization

  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Authorization header missing' })
    return
  }

  try {
    const token = header.slice('Bearer '.length)
    const payload = verifyToken(token)
    req.user = { id: payload.sub, email: payload.email }
    next()
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token' })
  }
}
