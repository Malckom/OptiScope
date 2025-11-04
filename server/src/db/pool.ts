import { Pool } from 'pg'
import { config } from '../config.ts'

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl:
    config.nodeEnv === 'production'
      ? { rejectUnauthorized: false }
      : undefined,
})

pool.on('error', (err: Error) => {
  console.error('Unexpected PostgreSQL client error', err)
})
