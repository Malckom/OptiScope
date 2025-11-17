import { Router } from 'express'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { hashPassword, verifyPassword } from '../lib/password.js'
import { createToken } from '../lib/token.js'

const router = Router()

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
})

router.post('/register', async (req: Request, res: Response) => {
  const parsed = credentialsSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
    return
  }

  const { email, password } = parsed.data

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [
    email,
  ])
  if (existing.rowCount) {
    res.status(409).json({ message: 'An account with that email already exists.' })
    return
  }

  const passwordHash = await hashPassword(password)
  const result = await pool.query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
    [email, passwordHash],
  )

  const user = result.rows[0]
  const token = createToken(user)
  res.status(201).json({ token, user })
})

router.post('/login', async (req: Request, res: Response) => {
  const parsed = credentialsSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })
    return
  }

  const { email, password } = parsed.data

  const result = await pool.query(
    'SELECT id, email, password_hash FROM users WHERE email = $1',
    [email],
  )

  if (!result.rowCount) {
    res.status(401).json({ message: 'Invalid email or password.' })
    return
  }

  const user = result.rows[0]
  const isValid = await verifyPassword(password, user.password_hash)

  if (!isValid) {
    res.status(401).json({ message: 'Invalid email or password.' })
    return
  }

  const token = createToken(user)
  res.json({ token, user: { id: user.id, email: user.email } })
})

export default router
