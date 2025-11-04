import jwt from 'jsonwebtoken'
import { config } from '../config.ts'

interface TokenPayload {
  sub: string
  email: string
}

export function createToken(user: { id: string; email: string }): string {
  const payload: TokenPayload = { sub: user.id, email: user.email }
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' })
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwtSecret) as TokenPayload
}
