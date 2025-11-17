import { config } from '../config.js'

export interface MarketSnapshot {
  symbol: string
  price: number | null
  changePercent: number | null
  previousClose: number | null
  currency?: string
  lastUpdated: string | null
  source?: 'alphavantage' | 'yahoo' | 'fallback'
}

export interface MarketInsight extends MarketSnapshot {
  headline: string
  bias: 'bullish' | 'bearish' | 'neutral'
  summary: string
  support: string
  resistance: string
  catalyst: string
}

export interface MarketNewsArticle {
  id: string
  title: string
  url: string
  source: string
  summary: string
  publishedAt: string
  sentiment: 'Positive' | 'Negative' | 'Neutral'
}

const fallbackSnapshots: Record<string, MarketSnapshot> = {
  NVDA: {
    symbol: 'NVDA',
    price: 497.62,
    changePercent: 1.84,
    previousClose: 488.63,
    lastUpdated: new Date().toISOString(),
    source: 'fallback',
  },
  TSLA: {
    symbol: 'TSLA',
    price: 224.15,
    changePercent: -0.63,
    previousClose: 225.57,
    lastUpdated: new Date().toISOString(),
    source: 'fallback',
  },
  MSFT: {
    symbol: 'MSFT',
    price: 412.02,
    changePercent: 0.42,
    previousClose: 410.3,
    lastUpdated: new Date().toISOString(),
    source: 'fallback',
  },
}

const fallbackNews: MarketNewsArticle[] = [
  {
    id: 'fallback-nvda',
    title: 'AI demand keeps semiconductors in focus as earnings loom',
    url: 'https://example.com/news/nvda-ai-focus',
    source: 'OptiScope Desk',
    summary:
      'Momentum desks continue to accumulate NVDA ahead of guidance updates, citing resilient data center demand and favorable GPU pricing trends.',
    publishedAt: new Date().toISOString(),
    sentiment: 'Positive',
  },
  {
    id: 'fallback-tsla',
    title: 'EV pricing strategies shift as competition intensifies',
    url: 'https://example.com/news/tsla-pricing',
    source: 'OptiScope Desk',
    summary:
      'Auto analysts point to improving margins in Chinese EV peers, prompting expectations that TSLA will adjust incentives to defend share.',
    publishedAt: new Date().toISOString(),
    sentiment: 'Neutral',
  },
  {
    id: 'fallback-msft',
    title: 'Cloud demand remains robust despite macro headwinds',
    url: 'https://example.com/news/msft-cloud',
    source: 'OptiScope Desk',
    summary:
      'Enterprise checks show sustained Azure momentum with security workloads leading incremental demand heading into year-end budgets.',
    publishedAt: new Date().toISOString(),
    sentiment: 'Positive',
  },
]

const SNAPSHOT_TTL_MS = 60 * 1000
const snapshotCache = new Map<string, { snapshot: MarketSnapshot; fetchedAt: number }>()
const snapshotInFlight = new Map<string, Promise<MarketSnapshot>>()

function hasMarketCredentials(): boolean {
  return Boolean(config.marketData.apiKey)
}

function createHeaders(): Record<string, string> {
  return {
    'User-Agent': 'OptiScope/1.0 (+https://optiscope.app)',
    Accept: 'application/json',
  }
}

async function fetchAlphaVantageQuote(symbol: string): Promise<MarketSnapshot | null> {
  const url = new URL('/query', config.marketData.baseUrl)
  url.searchParams.set('function', 'GLOBAL_QUOTE')
  url.searchParams.set('symbol', symbol)
  url.searchParams.set('apikey', config.marketData.apiKey ?? '')

  const response = await fetch(url, {
    headers: createHeaders(),
  })

  if (!response.ok) {
    throw new Error(`AlphaVantage request failed with ${response.status}`)
  }

  const raw = await response.text()

  let payload: Record<string, any>
  try {
    payload = JSON.parse(raw)
  } catch (error) {
    console.warn('AlphaVantage returned non-JSON payload:', raw.slice(0, 160))
    throw new Error('AlphaVantage request returned non-JSON payload')
  }

  if (payload?.Note || payload?.Information) {
    const message = payload.Note ?? payload.Information ?? 'AlphaVantage rate limit reached'
    throw new Error(message)
  }

  const quote = payload['Global Quote'] as Record<string, string> | undefined

  if (!quote) {
    return null
  }

  const parseNumeric = (value: string | undefined): number | null => {
    if (!value) {
      return null
    }
    const normalized = value.replace(/,/g, '').replace(/%/g, '').trim()
    const parsed = Number.parseFloat(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }

  const price = parseNumeric(quote['05. price'])
  const changePercent = parseNumeric(quote['10. change percent'])
  const previousClose = parseNumeric(quote['08. previous close'])

  return {
    symbol,
    price,
    changePercent,
    previousClose,
    lastUpdated: new Date().toISOString(),
    source: 'alphavantage',
  }
}

async function fetchYahooQuote(symbol: string): Promise<MarketSnapshot | null> {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`)
  url.searchParams.set('interval', '1m')
  url.searchParams.set('range', '1d')

  const response = await fetch(url.toString(), {
    headers: createHeaders(),
  })

  if (!response.ok) {
    throw new Error(`Yahoo Finance request failed with ${response.status}`)
  }

  const payload = await response.json() as {
    chart?: {
      result?: Array<{ meta?: Record<string, any> }>
      error?: any
    }
  }

  const meta = payload.chart?.result?.[0]?.meta
  if (!meta) {
    return null
  }

  const toNumber = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value)
      return Number.isFinite(parsed) ? parsed : null
    }
    return null
  }

  const price = toNumber(meta.regularMarketPrice)
  const previousClose = toNumber(meta.previousClose ?? meta.chartPreviousClose)
  const resolvedChangePercent = price !== null && previousClose
    ? Number(((price - previousClose) / previousClose) * 100)
    : null

  const marketTime = typeof meta.regularMarketTime === 'number' && meta.regularMarketTime > 0
    ? new Date(meta.regularMarketTime * 1000).toISOString()
    : new Date().toISOString()

  return {
    symbol: typeof meta.symbol === 'string' ? meta.symbol.toUpperCase() : symbol.toUpperCase(),
    price,
    changePercent: resolvedChangePercent,
    previousClose,
    currency: typeof meta.currency === 'string' ? meta.currency : undefined,
    lastUpdated: marketTime,
    source: 'yahoo',
  }
}

async function fetchAlphaVantageNews(symbols: string[]): Promise<MarketNewsArticle[] | null> {
  if (!config.marketData.apiKey) {
    return null
  }

  const tickersParam = symbols.filter(Boolean).slice(0, 3).join(',') || 'SPX'
  const url = new URL('/query', config.marketData.baseUrl)
  url.searchParams.set('function', 'NEWS_SENTIMENT')
  url.searchParams.set('tickers', tickersParam)
  url.searchParams.set('sort', 'LATEST')
  url.searchParams.set('apikey', config.marketData.apiKey)

  const response = await fetch(url.toString(), {
    headers: createHeaders(),
  })

  if (!response.ok) {
    throw new Error(`AlphaVantage news request failed with ${response.status}`)
  }

  const payload = (await response.json()) as { feed?: any[] }
  const feed = payload.feed

  if (!Array.isArray(feed)) {
    return null
  }

  return feed.slice(0, 6).map((item, index) => ({
    id: item.url ?? `${item.title ?? 'article'}-${index}`,
    title: item.title ?? 'Market update',
    url: item.url ?? '#',
    source: item.source ?? 'Newswire',
    summary: item.summary ?? item.overall_sentiment_label ?? 'Market perspective update.',
    publishedAt: item.time_published
      ? new Date(item.time_published.slice(0, 4) + '-' + item.time_published.slice(4, 6) + '-' + item.time_published.slice(6, 8) + 'T' + item.time_published.slice(9, 11) + ':' + item.time_published.slice(11, 13) + ':' + item.time_published.slice(13, 15) + 'Z').toISOString()
      : new Date().toISOString(),
    sentiment:
      item.overall_sentiment_label === 'Positive'
        ? 'Positive'
        : item.overall_sentiment_label === 'Negative'
          ? 'Negative'
          : 'Neutral',
  }))
}

async function resolveSnapshot(symbol: string): Promise<MarketSnapshot> {
  const upper = symbol.toUpperCase()

  const cached = snapshotCache.get(upper)
  if (cached && Date.now() - cached.fetchedAt < SNAPSHOT_TTL_MS) {
    return { ...cached.snapshot }
  }

  if (snapshotInFlight.has(upper)) {
    return snapshotInFlight.get(upper)!
  }

  const providerOrder: Array<() => Promise<MarketSnapshot | null>> = []

  const preferred = config.marketData.provider

  if (preferred === 'yahoo') {
    providerOrder.push(() => fetchYahooQuote(upper))
    if (hasMarketCredentials()) {
      providerOrder.push(() => fetchAlphaVantageQuote(upper))
    }
  } else if (preferred === 'alphavantage') {
    if (hasMarketCredentials()) {
      providerOrder.push(() => fetchAlphaVantageQuote(upper))
    }
    providerOrder.push(() => fetchYahooQuote(upper))
  } else {
    providerOrder.push(() => fetchYahooQuote(upper))
    if (hasMarketCredentials()) {
      providerOrder.push(() => fetchAlphaVantageQuote(upper))
    }
  }

  const request = (async (): Promise<MarketSnapshot> => {
    const resolvedSnapshots: MarketSnapshot[] = []

    for (const provider of providerOrder) {
      try {
        const snapshot = await provider()
        if (snapshot && snapshot.price !== null) {
          resolvedSnapshots.push(snapshot)
        }
      } catch (error) {
        console.warn(`Market data provider failed for ${upper}:`, error)
      }
    }

    if (resolvedSnapshots.length > 0) {
      const preferredSources = preferred === 'alphavantage'
        ? ['alphavantage', 'yahoo', 'fallback']
        : ['yahoo', 'alphavantage', 'fallback']

      const sourceRank = (snapshot: MarketSnapshot): number => {
        const idx = preferredSources.indexOf(snapshot.source ?? 'fallback')
        return idx === -1 ? preferredSources.length : idx
      }

      resolvedSnapshots.sort((a, b) => {
        const sourceScore = sourceRank(a) - sourceRank(b)
        if (sourceScore !== 0) {
          return sourceScore
        }

        const currencyScore = (b.currency ? 1 : 0) - (a.currency ? 1 : 0)
        if (currencyScore !== 0) {
          return currencyScore
        }

        const aTime = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0
        const bTime = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0
        return bTime - aTime
      })

      const primary = { ...resolvedSnapshots[0] }

      for (const candidate of resolvedSnapshots.slice(1)) {
        if (primary.price === null && candidate.price !== null) {
          primary.price = candidate.price
        }
        if (primary.changePercent === null && candidate.changePercent !== null) {
          primary.changePercent = candidate.changePercent
        }
        if (primary.previousClose === null && candidate.previousClose !== null) {
          primary.previousClose = candidate.previousClose
        }
        if (!primary.currency && candidate.currency) {
          primary.currency = candidate.currency
        }
        if (!primary.lastUpdated && candidate.lastUpdated) {
          primary.lastUpdated = candidate.lastUpdated
        }
      }

      snapshotCache.set(upper, { snapshot: primary, fetchedAt: Date.now() })
      return primary
    }

    if (cached) {
      console.warn(`Falling back to cached snapshot for ${upper} after provider failures.`)
      return { ...cached.snapshot }
    }

    const fallback = fallbackSnapshots[upper]
    if (fallback) {
      const result = { ...fallback, lastUpdated: new Date().toISOString(), source: 'fallback' as const }
      snapshotCache.set(upper, { snapshot: result, fetchedAt: Date.now() })
      return result
    }

    const empty: MarketSnapshot = {
      symbol: upper,
      price: null,
      changePercent: null,
      previousClose: null,
      lastUpdated: new Date().toISOString(),
      source: 'fallback',
    }
    snapshotCache.set(upper, { snapshot: empty, fetchedAt: Date.now() })
    return empty
  })()

  snapshotInFlight.set(upper, request)

  try {
    const result = await request
    return result
  } finally {
    snapshotInFlight.delete(upper)
  }
}

function classifyBias(changePercent: number | null): 'bullish' | 'bearish' | 'neutral' {
  if (changePercent === null) {
    return 'neutral'
  }
  if (changePercent > 0.75) {
    return 'bullish'
  }
  if (changePercent < -0.75) {
    return 'bearish'
  }
  return 'neutral'
}

function formatLevel(value: number | null, fallback: string): string {
  if (value === null || Number.isNaN(value)) {
    return fallback
  }
  return `$${value.toFixed(2)}`
}

function deriveSupport(snapshot: MarketSnapshot): string {
  if (snapshot.previousClose && snapshot.price) {
    const cushion = snapshot.previousClose - Math.abs(snapshot.previousClose * 0.02)
    return formatLevel(Number(cushion.toFixed(2)), '—')
  }
  return '—'
}

function deriveResistance(snapshot: MarketSnapshot): string {
  if (snapshot.previousClose && snapshot.price) {
    const cap = snapshot.previousClose + Math.abs(snapshot.previousClose * 0.025)
    return formatLevel(Number(cap.toFixed(2)), '—')
  }
  return '—'
}

function buildSummary(symbol: string, snapshot: MarketSnapshot): string {
  if (snapshot.price === null || snapshot.changePercent === null) {
    return `${symbol} data is syncing. Real-time pricing will appear once market data access is configured.`
  }

  const direction = snapshot.changePercent >= 0 ? 'higher' : 'lower'
  const magnitude = Math.abs(snapshot.changePercent).toFixed(2)
  return `${symbol} is trading ${direction} by ${magnitude}% versus the prior close. Monitor option flow and sector breadth to validate continuation or mean reversion.`
}

function buildCatalyst(snapshot: MarketSnapshot): string {
  if (!snapshot.lastUpdated) {
    return 'Next catalyst: configure real-time provider.'
  }
  const date = new Date(snapshot.lastUpdated)
  return `Next check-in at ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
}

export async function fetchMarketSnapshots(symbols: string[]): Promise<MarketSnapshot[]> {
  const unique = Array.from(new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean)))
  const results: MarketSnapshot[] = await Promise.all(unique.map((symbol) => resolveSnapshot(symbol)))
  return results
}

export async function fetchMarketInsight(symbol: string): Promise<MarketInsight> {
  const snapshot = await resolveSnapshot(symbol)
  const bias = classifyBias(snapshot.changePercent)

  const biasHeadline = {
    bullish: 'Momentum cooling within an uptrend channel',
    bearish: 'Momentum slipping; watch key demand zones',
    neutral: 'Range-bound action with balanced flows',
  }[bias]

  return {
    ...snapshot,
    headline: biasHeadline,
    bias,
    summary: buildSummary(snapshot.symbol, snapshot),
    support: deriveSupport(snapshot),
    resistance: deriveResistance(snapshot),
    catalyst: buildCatalyst(snapshot),
  }
}

export async function fetchMarketNews(symbols: string[] = []): Promise<MarketNewsArticle[]> {
  const upper = symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean)

  if (hasMarketCredentials() && config.marketData.provider === 'alphavantage') {
    try {
      const articles = await fetchAlphaVantageNews(upper)
      if (articles && articles.length) {
        return articles
      }
    } catch (error) {
      console.warn('Market news fetch failed:', error)
    }
  }

  return fallbackNews.map((article, index) => ({
    ...article,
    id: `${article.id}-${upper.join('-') || 'market'}-${index}`,
    publishedAt: new Date(Date.now() - index * 1000 * 60 * 15).toISOString(),
  }))
}
