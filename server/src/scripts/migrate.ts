import { readFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { pool } from '../db/pool.ts'

async function main(): Promise<void> {
  const currentFile = fileURLToPath(import.meta.url)
  const currentDir = path.dirname(currentFile)
  const schemaPath = path.resolve(currentDir, '../../db/schema.sql')

  const sql = await readFile(schemaPath, 'utf-8')

  console.log('Applying schema from', schemaPath)
  await pool.query(sql)
  console.log('Schema applied successfully')
}

main()
  .catch((error) => {
    console.error('Failed to apply schema')
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
