import { Router } from 'express'
import type { Response, Request } from 'express'
import { fetchMarketInsight, fetchMarketNews, fetchMarketSnapshots } from '../services/marketData.js'

const router = Router()

router.get('/snapshots', async (req: Request, res: Response) => {
  const symbolsParam = req.query.symbols
  let symbolsString: string | null = null

  if (Array.isArray(symbolsParam)) {
    symbolsString = symbolsParam.join(',')
  } else if (typeof symbolsParam === 'string') {
    symbolsString = symbolsParam
  }

  if (!symbolsString) {
    res.status(400).json({ message: 'symbols query parameter is required' })
    return
  }

  const normalizedSymbols = symbolsString as string

  const symbols = normalizedSymbols
    .split(',')
    .map((symbol: string) => symbol.trim())
    .filter(Boolean)
    .slice(0, 10)

  if (!symbols.length) {
    res.status(400).json({ message: 'Provide at least one symbol' })
    return
  }

  const snapshots = await fetchMarketSnapshots(symbols)
  res.json({ data: snapshots })
})

router.get('/insight/:symbol', async (req: Request<{ symbol: string }>, res: Response) => {
  const symbol = req.params.symbol?.trim()

  if (!symbol) {
    res.status(400).json({ message: 'Symbol is required' })
    return
  }

  const insight = await fetchMarketInsight(symbol)
  res.json(insight)
})

router.get('/news', async (req: Request, res: Response) => {
  const symbolsParam = req.query.symbols
  const symbols = Array.isArray(symbolsParam)
    ? symbolsParam
        .map((value) => (typeof value === 'string' ? value : ''))
        .filter((value): value is string => Boolean(value))
    : typeof symbolsParam === 'string' && symbolsParam.length
      ? symbolsParam.split(',').map((value) => value.trim()).filter(Boolean)
      : []

  const articles = await fetchMarketNews(symbols)
  res.json({ data: articles })
})

export default router
