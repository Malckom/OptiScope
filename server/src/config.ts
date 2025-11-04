import dotenv from 'dotenv';
dotenv.config();


const { PORT, DATABASE_URL, JWT_SECRET, NODE_ENV, ALLOWED_ORIGINS } =
  process.env

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required but was not provided.')
}

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required but was not provided.')
}

const port = Number(PORT ?? 4000)

export const config = {
  port,
  databaseUrl: DATABASE_URL,
  jwtSecret: JWT_SECRET,
  nodeEnv: NODE_ENV ?? 'development',
  allowedOrigins: ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()) ?? [
    'http://localhost:5173',
  ],
}
