import { pool } from '../db/pool.ts'

async function seed() {
  console.log('🌱 Seeding database...')

  try {
    // 1. Create a user
    const userResult = await pool.query(`
      INSERT INTO users (email, password_hash)
      VALUES ('niiteuncle@gmail.com', '$2a$12$voDUjbRYkkxB4ytar/azr.OxYJyF8nc8iZv.Wsk2088DAEUeuHcmS')
      RETURNING id;
    `)
    const userId = userResult.rows[0].id

    // 2. Create a trade for that user
    const tradeResult = await pool.query(`
      INSERT INTO trades (
        user_id,
        symbol,
        strategy,
        status,
        net_credit,
        notes
      )
      VALUES (
        $1,
        'AAPL',
        'Bull Put Spread',
        'open',
        250.00,
        'Example trade for seeding'
      )
      RETURNING id;
    `, [userId])

    const tradeId = tradeResult.rows[0].id

    // 3. Add option legs for that trade
    await pool.query(`
      INSERT INTO option_legs (
        trade_id,
        leg_type,
        position,
        strike,
        expiry,
        quantity,
        price
      )
      VALUES
        ($1, 'put', 'short', 180.00, '2025-12-20', 1, 2.50),
        ($1, 'put', 'long', 175.00, '2025-12-20', 1, 1.20);
    `, [tradeId])

    console.log('✅ Seeding complete.')
  } catch (err) {
    console.error('❌ Error seeding data:', err)
  } finally {
    await pool.end()
  }
}

seed()
