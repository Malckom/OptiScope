import { useEffect, useMemo, useState, type FormEvent } from 'react'
import './App.css'

type StrategyFeature = {
  title: string
  description: string
}

type WorkflowStep = {
  step: string
  detail: string
}

type OptionLeg = {
  id: string
  legType: 'call' | 'put'
  position: 'long' | 'short'
  strike: number
  expiry: string
  quantity: number
  price: number | null
}

type Trade = {
  id: string
  symbol: string
  strategy: string | null
  status: 'open' | 'closed' | 'rolled'
  openedAt: string
  closedAt: string | null
  netCredit: number | null
  netDebit: number | null
  notes: string | null
  legs: OptionLeg[]
}

type User = {
  id: string
  email: string
}

type AuthPayload = {
  token: string
  user: User
}

type TradeFormState = {
  symbol: string
  strategy: string
  status: 'open' | 'closed' | 'rolled'
  side: 'credit' | 'debit'
  entryPrice: string
  quantity: string
  optionType: 'call' | 'put'
  strike: string
  expiry: string
  openedAt: string
  notes: string
}

type MarketSnapshotResponse = {
  symbol: string
  price: number | null
  changePercent: number | null
  lastUpdated: string | null
}

type MarketInsightResponse = MarketSnapshotResponse & {
  headline: string
  bias: 'bullish' | 'bearish' | 'neutral'
  summary: string
  support: string
  resistance: string
  catalyst: string
}

type MarketSnapshotUI = {
  symbol: string
  price: string
  change: string
  direction: 'positive' | 'negative' | 'neutral'
  lastUpdated: string | null
}

type MarketInsightUI = {
  symbol: string
  price: string
  change: string
  direction: 'positive' | 'negative' | 'neutral'
  headline: string
  bias: 'bullish' | 'bearish' | 'neutral'
  summary: string
  support: string
  resistance: string
  catalyst: string
  lastUpdated: string | null
}

type MarketNewsArticle = {
  id: string
  title: string
  url: string
  source: string
  summary: string
  publishedAt: string
  sentiment: 'Positive' | 'Negative' | 'Neutral'
}

type AnalyticsTotals = {
  winRate: number
  averagePnl: number
  averagePnlPct: number
  expectancy: number
  averageHoldDays: number
  closedTrades: number
}

type StrategyMetric = {
  strategy: string
  total: number
  wins: number
  losses: number
  averagePnl: number
}

type EquityPoint = {
  date: string
  cumulativePnl: number
}

type HoldingBucket = {
  bucket: string
  count: number
}

type AnalyticsSnapshot = {
  generatedAt: string
  totals: AnalyticsTotals
  strategyBreakdown: StrategyMetric[]
  equityCurve: EquityPoint[]
  holdingPeriods: HoldingBucket[]
}

type AnalyticsSummaryResponse = {
  data: AnalyticsSnapshot
  reportDate: string
  calculatedAt: string
  refreshed: boolean
}

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'
const AUTH_STORAGE_KEY = 'optiscope.auth'

const featuredSymbols = ['NVDA', 'TSLA', 'MSFT']

const features: StrategyFeature[] = [
  {
    title: 'Strategy Visualization',
    description:
      'Auto-detect spreads, straddles, condors, and display interactive profit/loss zones with breakeven markers.'
  },
  {
    title: 'Greeks Dashboard',
    description:
      'Track delta, theta, vega, and gamma across every position with live aggregation and risk bands.'
  },
  {
    title: 'AI Strategy Coach',
    description:
      'Receive contextual commentary that blends historical IV regimes, sentiment data, and playbook reminders.'
  },
  {
    title: 'Volatility Triggers',
    description:
      'Get alerted when IV rank, skew, or earnings catalysts shift the risk profile of your structures.'
  },
  {
    title: 'Scenario Studio',
    description:
      'Simulate volatility crush, underlying moves, and time decay to preview next-session risk and reward.'
  },
  {
    title: 'Portfolio Timeline',
    description:
      'Review realized vs. unrealized P/L and capital usage over time to refine sizing and exit discipline.'
  }
]

const workflow: WorkflowStep[] = [
  {
    step: 'Import',
    detail: 'Sync trades from your broker or upload a CSV. OptiScope maps each leg automatically.'
  },
  {
    step: 'Analyze',
    detail: 'Dive into live Greeks, risk overlays, and AI commentary tuned to the current market backdrop.'
  },
  {
    step: 'Act',
    detail: 'Set volatility triggers, run “what if” scenarios, and share recaps with your trading circle.'
  }
]

const scenarioLevers = [
  'Spot price shocks (+/- 2-10%)',
  'Volatility crush or expansion',
  'Time decay fast-forward',
  'Skew and surface shifts',
  'Custom hedge overlays'
]

const heroBullets = [
  'Intraday briefs distilled from 40+ market sources',
  'AI-generated trade setups and risk callouts',
  'Portfolio-grade analytics ready in under two minutes',
]

const trustSignals = ['Reuters', 'Dow Jones', 'FactSet', 'ArbSight', 'Marketscope']

const heroMetrics = [
  { value: '24/7', label: 'Market coverage' },
  { value: '90s', label: 'Refresh cadence' },
  { value: 'Global', label: 'Equities & options' },
]

function formatPrice(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return '—'
  }
  return `$${value.toFixed(2)}`
}

function formatChange(changePercent: number | null): { text: string; direction: 'positive' | 'negative' | 'neutral' } {
  if (changePercent === null || Number.isNaN(changePercent)) {
    return { text: '—', direction: 'neutral' }
  }

  const direction: 'positive' | 'negative' | 'neutral' = changePercent > 0.05
    ? 'positive'
    : changePercent < -0.05
      ? 'negative'
      : 'neutral'

  const sign = changePercent > 0 ? '+' : ''
  return { text: `${sign}${changePercent.toFixed(2)}%`, direction }
}

function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) {
    return '$0.00'
  }
  const absolute = Math.abs(value).toFixed(2)
  if (value > 0) {
    return `+$${absolute}`
  }
  if (value < 0) {
    return `-$${absolute}`
  }
  return '$0.00'
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return '0.00%'
  }
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  return `${sign}${Math.abs(value).toFixed(2)}%`
}

function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) {
    return '—'
  }
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateTime(timestamp: string | null): string {
  if (!timestamp) {
    return '—'
  }
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatNewsTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toSnapshotUI(data: MarketSnapshotResponse): MarketSnapshotUI {
  const { text, direction } = formatChange(data.changePercent)
  return {
    symbol: data.symbol.toUpperCase(),
    price: formatPrice(data.price),
    change: text,
    direction,
    lastUpdated: data.lastUpdated,
  }
}

function toInsightUI(data: MarketInsightResponse): MarketInsightUI {
  const { text, direction } = formatChange(data.changePercent)
  return {
    symbol: data.symbol.toUpperCase(),
    price: formatPrice(data.price),
    change: text,
    direction,
    headline: data.headline,
    bias: data.bias,
    summary: data.summary,
    support: data.support,
    resistance: data.resistance,
    catalyst: data.catalyst,
    lastUpdated: data.lastUpdated,
  }
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers = new Headers(options.headers ?? {})

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
  let payload: any = null

  try {
    payload = await response.json()
  } catch (error) {
    // ignore JSON parse errors for empty bodies
  }

  if (!response.ok) {
    const message = payload?.message ?? 'Request failed.'
    throw new Error(message)
  }

  return payload as T
}

function App() {
  const [isConsoleOpen, setIsConsoleOpen] = useState(false)
  const [auth, setAuth] = useState<AuthPayload | null>(null)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authForm, setAuthForm] = useState({ email: '', password: '' })
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)

  const [trades, setTrades] = useState<Trade[]>([])
  const [loadingTrades, setLoadingTrades] = useState(false)
  const [tradeError, setTradeError] = useState<string | null>(null)
  const [savingTrade, setSavingTrade] = useState(false)

  const [tradeForm, setTradeForm] = useState<TradeFormState>({
    symbol: '',
    strategy: '',
    status: 'open',
    side: 'credit',
    entryPrice: '',
    quantity: '1',
    optionType: 'call',
    strike: '',
    expiry: '',
    openedAt: new Date().toISOString().slice(0, 10),
    notes: '',
  })

  const [marketSnapshots, setMarketSnapshots] = useState<MarketSnapshotUI[]>(
    featuredSymbols.map((symbol) => ({
      symbol,
      price: '—',
      change: '—',
      direction: 'neutral',
      lastUpdated: null,
    })),
  )
  const [selectedSymbol, setSelectedSymbol] = useState<string>(featuredSymbols[0])
  const [marketInsight, setMarketInsight] = useState<MarketInsightUI | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [marketNews, setMarketNews] = useState<MarketNewsArticle[]>([])
  const [newsLoading, setNewsLoading] = useState(false)
  const [newsError, setNewsError] = useState<string | null>(null)
  const [analyticsSummary, setAnalyticsSummary] = useState<AnalyticsSnapshot | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
  const [analyticsRefreshing, setAnalyticsRefreshing] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem(AUTH_STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AuthPayload
        if (parsed?.token && parsed?.user) {
          setAuth(parsed)
          setIsConsoleOpen(true)
        }
      } catch (error) {
        window.localStorage.removeItem(AUTH_STORAGE_KEY)
      }
    }
  }, [])

  useEffect(() => {
    if (auth) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth))
    } else {
      window.localStorage.removeItem(AUTH_STORAGE_KEY)
    }
  }, [auth])

  useEffect(() => {
    if (!auth) {
      setTrades([])
      setAnalyticsSummary(null)
      return
    }

    let cancelled = false
    const load = async () => {
      setLoadingTrades(true)
      setTradeError(null)
      try {
        const data = await apiRequest<{ trades: Trade[] }>('/api/trades', {}, auth.token)
        if (!cancelled) {
          setTrades(data.trades)
        }
      } catch (error) {
        if (!cancelled) {
          setTradeError(error instanceof Error ? error.message : 'Failed to load trades.')
        }
      } finally {
        if (!cancelled) {
          setLoadingTrades(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [auth])

  useEffect(() => {
    if (!auth) {
      setAnalyticsSummary(null)
      return
    }

    let cancelled = false

    const loadAnalytics = async () => {
      setAnalyticsLoading(true)
      setAnalyticsError(null)
      try {
        const payload = await apiRequest<AnalyticsSummaryResponse>(
          '/api/analytics/summary',
          {},
          auth.token,
        )
        if (!cancelled) {
          setAnalyticsSummary(payload.data)
        }
      } catch (error) {
        if (!cancelled) {
          setAnalyticsError(error instanceof Error ? error.message : 'Unable to load analytics summary.')
          setAnalyticsSummary(null)
        }
      } finally {
        if (!cancelled) {
          setAnalyticsLoading(false)
        }
      }
    }

    void loadAnalytics()

    return () => {
      cancelled = true
    }
  }, [auth])

  useEffect(() => {
    let cancelled = false

    const loadSnapshots = async () => {
      try {
        const params = featuredSymbols.join(',')
        const payload = await apiRequest<{ data: MarketSnapshotResponse[] }>(
          `/api/market/snapshots?symbols=${params}`,
        )

        if (!cancelled) {
          setMarketSnapshots((prev) => {
            const merged = new Map<string, MarketSnapshotUI>()
            for (const item of prev) {
              merged.set(item.symbol, item)
            }
            for (const item of payload.data.map(toSnapshotUI)) {
              merged.set(item.symbol, item)
            }

            const ordered: MarketSnapshotUI[] = []
            for (const symbol of featuredSymbols) {
              if (merged.has(symbol)) {
                ordered.push(merged.get(symbol)!)
                merged.delete(symbol)
              }
            }

            for (const item of merged.values()) {
              ordered.push(item)
            }

            return ordered
          })
        }
      } catch (error) {
        console.warn('Failed to load market snapshots', error)
      }
    }

    void loadSnapshots()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const ensureSnapshot = async () => {
      try {
        const payload = await apiRequest<{ data: MarketSnapshotResponse[] }>(
          `/api/market/snapshots?symbols=${selectedSymbol}`,
        )
        if (!cancelled) {
          const [snapshot] = payload.data
          if (snapshot) {
            setMarketSnapshots((prev) => {
              const other = prev.filter((item) => item.symbol !== snapshot.symbol.toUpperCase())
              return [toSnapshotUI(snapshot), ...other]
            })
          }
        }
      } catch (error) {
        console.warn('Failed to refresh snapshot', error)
      }
    }

    void ensureSnapshot()

    return () => {
      cancelled = true
    }
  }, [selectedSymbol])

  useEffect(() => {
    let cancelled = false

    const loadInsight = async () => {
      setAnalysisLoading(true)
      setAnalysisError(null)
      try {
        const payload = await apiRequest<MarketInsightResponse>(
          `/api/market/insight/${selectedSymbol}`,
        )
        if (!cancelled) {
          setMarketInsight(toInsightUI(payload))
        }
      } catch (error) {
        if (!cancelled) {
          setAnalysisError(
            error instanceof Error ? error.message : 'Unable to load market insight.',
          )
          setMarketInsight(null)
        }
      } finally {
        if (!cancelled) {
          setAnalysisLoading(false)
        }
      }
    }

    void loadInsight()

    return () => {
      cancelled = true
    }
  }, [selectedSymbol])

  useEffect(() => {
    let cancelled = false

    const loadNews = async () => {
      setNewsLoading(true)
      setNewsError(null)
      try {
        const payload = await apiRequest<{ data: MarketNewsArticle[] }>(
          `/api/market/news?symbols=${selectedSymbol}`,
        )
        if (!cancelled) {
          setMarketNews(payload.data)
        }
      } catch (error) {
        if (!cancelled) {
          setNewsError(error instanceof Error ? error.message : 'Unable to load market news.')
          setMarketNews([])
        }
      } finally {
        if (!cancelled) {
          setNewsLoading(false)
        }
      }
    }

    void loadNews()

    return () => {
      cancelled = true
    }
  }, [selectedSymbol])

  const hasAuth = Boolean(auth)

  const primaryCTA = () => {
    setIsConsoleOpen(true)
  }

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthError(null)

    const email = authForm.email.trim()
    const password = authForm.password

    if (!email || !password) {
      setAuthError('Email and password are required.')
      return
    }

    setAuthLoading(true)
    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const payload = await apiRequest<AuthPayload>(
        endpoint,
        {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        },
      )
      setAuth(payload)
      setAuthForm({ email: '', password: '' })
      setAuthMode('login')
      setIsConsoleOpen(true)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Authentication failed.')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleTradeChange = (field: keyof TradeFormState, value: string) => {
    setTradeForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleTradeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!auth) {
      setTradeError('Please sign in before adding trades.')
      return
    }

    const entryPrice = Number(tradeForm.entryPrice)
    const quantity = Number(tradeForm.quantity)
    const strike = Number(tradeForm.strike)

    if (!tradeForm.symbol.trim() || !tradeForm.expiry) {
      setTradeError('Symbol and expiry are required.')
      return
    }

    if (!Number.isFinite(entryPrice) || entryPrice < 0) {
      setTradeError('Entry price must be zero or positive.')
      return
    }

    if (!Number.isFinite(strike)) {
      setTradeError('Strike must be a valid number.')
      return
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      setTradeError('Quantity must be a positive whole number.')
      return
    }

    setSavingTrade(true)
    setTradeError(null)

    try {
      const payload = {
        symbol: tradeForm.symbol.trim().toUpperCase(),
        strategy: tradeForm.strategy.trim() || undefined,
        status: tradeForm.status,
        notes: tradeForm.notes.trim() || undefined,
        side: tradeForm.side,
        entryPrice,
        quantity,
        optionType: tradeForm.optionType,
        strike,
        expiry: tradeForm.expiry,
        openedAt: tradeForm.openedAt || undefined,
      }

      const response = await apiRequest<{ trade: Trade }>(
        '/api/trades',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
        auth.token,
      )

      setTrades((prev) => [response.trade, ...prev])
      setTradeForm({
        symbol: '',
        strategy: '',
        status: 'open',
        side: tradeForm.side,
        entryPrice: '',
        quantity: String(quantity),
        optionType: tradeForm.optionType,
        strike: '',
        expiry: '',
        openedAt: new Date().toISOString().slice(0, 10),
        notes: '',
      })
    } catch (error) {
      setTradeError(error instanceof Error ? error.message : 'Unable to save trade.')
    } finally {
      setSavingTrade(false)
    }
  }

  const handleAnalyticsRefresh = async () => {
    if (!auth) {
      return
    }

    setAnalyticsRefreshing(true)
    setAnalyticsError(null)

    try {
      const payload = await apiRequest<AnalyticsSummaryResponse>(
        '/api/analytics/recalculate',
        { method: 'POST' },
        auth.token,
      )
      setAnalyticsSummary(payload.data)
    } catch (error) {
      setAnalyticsError(error instanceof Error ? error.message : 'Unable to refresh analytics.')
    } finally {
      setAnalyticsRefreshing(false)
    }
  }

  const handleLogout = () => {
    setAuth(null)
    setTrades([])
    setIsConsoleOpen(false)
  }

  const summarizedTrades = useMemo(() => trades.slice(0, 20), [trades])
  const primarySnapshot = marketSnapshots[0]
  const nextRefreshLabel = formatTimestamp(primarySnapshot?.lastUpdated ?? null)
  const analyticsGeneratedLabel = analyticsSummary ? formatDateTime(analyticsSummary.generatedAt) : null
  const equitySummary = useMemo(() => {
    if (!analyticsSummary || analyticsSummary.equityCurve.length === 0) {
      return null
    }

    const firstPoint = analyticsSummary.equityCurve[0]
    const lastPoint = analyticsSummary.equityCurve[analyticsSummary.equityCurve.length - 1]

    return {
      start: firstPoint.cumulativePnl,
      end: lastPoint.cumulativePnl,
      change: lastPoint.cumulativePnl - firstPoint.cumulativePnl,
      points: analyticsSummary.equityCurve.length,
    }
  }, [analyticsSummary])

  const handleSymbolPrompt = () => {
    const input = window.prompt('Enter a ticker symbol to analyze')
    if (!input) {
      return
    }
    const symbol = input.trim().toUpperCase()
    if (!symbol) {
      return
    }

    setMarketSnapshots((prev) => {
      if (prev.some((item) => item.symbol === symbol)) {
        return prev
      }
      return [
        { symbol, price: '—', change: '—', direction: 'neutral', lastUpdated: null },
        ...prev,
      ]
    })
    setSelectedSymbol(symbol)
  }

  return (
    <div className="page">
      <header className="hero" id="top">
        <nav className="navbar">
          <div className="nav-left">
            <div className="brand">OptiScope</div>
            <div className="nav-links">
              <a href="#features">Product</a>
              <a href="#workflow">How it works</a>
              <a href="#scenarios">Scenario studio</a>
              <a href="#cta">Get early access</a>
            </div>
          </div>
          <div className="nav-actions">
            <button className="nav-link-button" type="button" onClick={primaryCTA}>
              {hasAuth ? 'Dashboard' : 'Log in'}
            </button>
            <button className="nav-cta" type="button" onClick={primaryCTA}>
              Start for free
            </button>
          </div>
        </nav>
        <div className="hero-body">
          <div className="hero-copy">
            <span className="tagline">AI-powered market intelligence</span>
            <h1>Smart stock market analysis without the research slog.</h1>
            <p>
              OptiScope distills real-time data, technicals, and macro catalysts into crisp summaries so you can
              move from signal to execution faster than legacy terminals.
            </p>
            <ul className="hero-bullets">
              {heroBullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="hero-actions">
              <button className="primary-action" type="button" onClick={primaryCTA}>
                Start free analysis
              </button>
              <a className="secondary-action" href="#analysis">
                Watch product tour
              </a>
            </div>
            <div className="hero-stats">
              {heroMetrics.map((metric) => (
                <div key={metric.label} className="stat-card">
                  <span className="stat-value">{metric.value}</span>
                  <span className="stat-label">{metric.label}</span>
                </div>
              ))}
            </div>
            <div className="hero-trust">
              <span>Trusted research signals from</span>
              <div className="hero-trust-logos">
                {trustSignals.map((signal) => (
                  <span key={signal}>{signal}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="visual-card">
              <div className="visual-header">
                <span>Live Stock Pulse</span>
                <span className="visual-status">Auto</span>
              </div>
              <ul className="ticker-list">
                {marketSnapshots.slice(0, 3).map((ticker) => (
                  <li key={ticker.symbol} className="ticker-item">
                    <span className="ticker-symbol">{ticker.symbol}</span>
                    <span className="ticker-price">{ticker.price}</span>
                    <span className={`ticker-change ${ticker.direction}`}>{ticker.change}</span>
                  </li>
                ))}
              </ul>
              <div className="visual-analysis">
                <p>
                  AI summaries spotlight momentum, unusual flow, and macro catalysts so you can triage tickers before
                  the next bell.
                </p>
              </div>
              <div className="visual-footer">
                <div>
                  <strong>Signal focus</strong>
                  <span className="visual-metric">AI earnings drift</span>
                </div>
                <div>
                  <strong>Confidence</strong>
                  <span className="visual-metric positive">High</span>
                </div>
                <div>
                  <strong>Next refresh</strong>
                  <span className="visual-metric">{nextRefreshLabel}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section id="analysis" className="section analysis-preview">
          <div className="section-heading">
            <h2>Try our live stock analysis</h2>
            <p>
              Select a symbol to preview OptiScope&apos;s AI briefings, technical posture, and order flow signals in a
              single glance.
            </p>
          </div>
          <div className="analysis-grid">
            <div className="analysis-tickers">
              {marketSnapshots.map((ticker) => (
                <button
                  key={ticker.symbol}
                  className={`analysis-chip ${ticker.symbol === selectedSymbol ? 'active' : ''}`}
                  type="button"
                  onClick={() => setSelectedSymbol(ticker.symbol)}
                >
                  <span>{ticker.symbol}</span>
                  <span>{ticker.change}</span>
                </button>
              ))}
              <button className="analysis-chip ghost" type="button" onClick={handleSymbolPrompt}>
                <span>Add symbol</span>
                <span>⌕</span>
              </button>
            </div>
            <div className="analysis-summary">
              {analysisLoading ? (
                <div className="analysis-state">Loading insight…</div>
              ) : analysisError ? (
                <div className="analysis-state error">{analysisError}</div>
              ) : marketInsight ? (
                <>
                  <header>
                    <div>
                      <span className="summary-label">AI headline</span>
                      <h3>{marketInsight.headline}</h3>
                    </div>
                    <span className={`summary-signal ${marketInsight.bias}`}>
                      {{
                        bullish: 'Bullish bias',
                        bearish: 'Bearish bias',
                        neutral: 'Neutral bias',
                      }[marketInsight.bias]}
                    </span>
                  </header>
                  <p>{marketInsight.summary}</p>
                  <dl>
                    <div>
                      <dt>Support</dt>
                      <dd>{marketInsight.support}</dd>
                    </div>
                    <div>
                      <dt>Resistance</dt>
                      <dd>{marketInsight.resistance}</dd>
                    </div>
                    <div>
                      <dt>Next catalyst</dt>
                      <dd>{marketInsight.catalyst}</dd>
                    </div>
                  </dl>
                  <div className="analysis-meta">
                    <span>
                      <strong>{marketInsight.symbol}</strong> {marketInsight.price}
                    </span>
                    <span className={`analysis-change ${marketInsight.direction}`}>
                      {marketInsight.change}
                    </span>
                    <span>Updated {formatTimestamp(marketInsight.lastUpdated)}</span>
                  </div>
                </>
              ) : (
                <div className="analysis-state">Select a symbol to generate a briefing.</div>
              )}
            </div>
          </div>
        </section>

        <section className="section market-news">
          <div className="section-heading">
            <h2>Latest market news</h2>
            <p>
              AI-curated headlines tuned to your watchlist so you can gauge sentiment shifts and catalysts without
              leaving OptiScope.
            </p>
          </div>
          {newsLoading ? (
            <div className="news-state">Scanning news feeds…</div>
          ) : newsError ? (
            <div className="news-state error">{newsError}</div>
          ) : marketNews.length === 0 ? (
            <div className="news-state">No recent headlines. Check back shortly.</div>
          ) : (
            <div className="news-grid">
              {marketNews.map((article) => (
                <article key={article.id} className="news-card">
                  <header>
                    <span className={`news-sentiment ${article.sentiment.toLowerCase()}`}>
                      {article.sentiment}
                    </span>
                    <span className="news-source">{article.source}</span>
                  </header>
                  <h3>
                    <a href={article.url} target="_blank" rel="noreferrer">
                      {article.title}
                    </a>
                  </h3>
                  <p>{article.summary}</p>
                  <footer>
                    <span>{formatNewsTimestamp(article.publishedAt)}</span>
                    <a className="news-link" href={article.url} target="_blank" rel="noreferrer">
                      Read more ↗
                    </a>
                  </footer>
                </article>
              ))}
            </div>
          )}
        </section>

        <section id="features" className="section features">
          <div className="section-heading">
            <h2>Everything you need to quantify risk in seconds</h2>
            <p>
              Import your trades once and let OptiScope surface strategy insights, risk exposure, and
              volatility opportunities in a unified workspace.
            </p>
          </div>
          <div className="feature-grid">
            {features.map((feature) => (
              <article key={feature.title} className="feature-card">
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="workflow" className="section workflow">
          <div className="section-heading">
            <h2>How traders use OptiScope day to day</h2>
            <p>From morning prep to end-of-day reviews, each step keeps you aligned with your risk thesis.</p>
          </div>
          <div className="workflow-steps">
            {workflow.map((item) => (
              <div key={item.step} className="workflow-card">
                <div className="workflow-step">{item.step}</div>
                <p>{item.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="scenarios" className="section scenarios">
          <div className="section-heading">
            <h2>Scenario studio built for options nuance</h2>
            <p>
              Stress test complex structures without manual recalculations. Stack scenarios, compare side by side,
              and export ready-to-share recaps.
            </p>
          </div>
          <div className="scenarios-content">
            <div className="scenario-panel">
              <h3>Scenario Controls</h3>
              <ul>
                {scenarioLevers.map((lever) => (
                  <li key={lever}>{lever}</li>
                ))}
              </ul>
            </div>
            <div className="scenario-preview" aria-hidden="true">
              <div className="preview-header">
                <span>What-if Playback</span>
                <span className="preview-tag">Coming soon</span>
              </div>
              <div className="preview-body">
                <div className="preview-chart">
                  <div className="preview-line" />
                  <div className="preview-line alt" />
                  <div className="preview-points">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
                <div className="preview-metrics">
                  <div>
                    <strong>Max Gain</strong>
                    <span className="positive">$1,320</span>
                  </div>
                  <div>
                    <strong>Max Loss</strong>
                    <span>$680</span>
                  </div>
                  <div>
                    <strong>Prob. Profit</strong>
                    <span>63%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section assurance">
          <div className="assurance-card">
            <h2>Secure, compliant, trader-first.</h2>
            <p>
              OptiScope keeps your brokerage credentials encrypted, respects read-only access, and offers granular
              audit logs so you always know how data is used.
            </p>
            <div className="assurance-highlights">
              <span>Encrypted storage</span>
              <span>Broker OAuth ready</span>
              <span>Role-based access</span>
            </div>
          </div>
        </section>
      </main>

      <section id="cta" className="section cta">
        <div className="cta-card">
          <h2>Bring institutional-grade options analytics to your desk.</h2>
          <p>
            Join the waitlist to access early product drops, roadmap input sessions, and priority onboarding once integrations go live.
          </p>
          <form className="cta-form">
            <input type="email" placeholder="Email address" aria-label="Email address" />
            <button type="button">Notify me</button>
          </form>
          <small>No spam. Just launch updates and actionable trading content.</small>
        </div>
      </section>

      <footer className="footer">
        <div>© {new Date().getFullYear()} OptiScope. Built for active options traders.</div>
        <div className="footer-links">
          <a href="#features">Product</a>
          <a href="#workflow">Workflow</a>
          <a href="#cta">Early access</a>
        </div>
      </footer>

      {isConsoleOpen && (
        <div className="console-overlay" role="dialog" aria-modal="true">
          <div className="console-panel">
            <header className="console-header">
              <div>
                <h3>Manual trading console</h3>
                <p>Authenticate and record trades to preview the OptiScope workflow.</p>
              </div>
              <button
                className="console-close"
                type="button"
                onClick={() => setIsConsoleOpen(false)}
                aria-label="Close console"
              >
                ×
              </button>
            </header>

            {auth ? (
              <div className="console-authenticated">
                <div className="console-toolbar">
                  <span className="token-chip">{auth.user.email}</span>
                  <button type="button" className="muted-button" onClick={handleLogout}>
                    Log out
                  </button>
                </div>

                <div className="console-content">
                  <section className="console-section">
                    <div className="analytics-header">
                      <div>
                        <h4>Portfolio analytics</h4>
                        <p className="section-subtle">
                          {analyticsRefreshing
                            ? 'Refreshing metrics…'
                            : analyticsSummary
                              ? `Last generated ${analyticsGeneratedLabel ?? 'recently'}`
                              : analyticsLoading
                                ? 'Generating analytics…'
                                : 'Analytics refresh automatically after new trades are recorded.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="muted-button"
                        onClick={handleAnalyticsRefresh}
                        disabled={analyticsRefreshing || analyticsLoading}
                      >
                        {analyticsRefreshing ? 'Refreshing…' : 'Refresh analytics'}
                      </button>
                    </div>
                    {analyticsError && <p className="form-error">{analyticsError}</p>}
                    {analyticsLoading && !analyticsSummary ? (
                      <div className="empty-state">Generating analytics…</div>
                    ) : analyticsSummary ? (
                      <>
                        <div className="analytics-metrics">
                          <div className="analytics-metric">
                            <span className="metric-label">Win rate</span>
                            <span className="metric-value">
                              {Number.isFinite(analyticsSummary.totals.winRate)
                                ? `${analyticsSummary.totals.winRate.toFixed(2)}%`
                                : '0.00%'}
                            </span>
                          </div>
                          <div className="analytics-metric">
                            <span className="metric-label">Avg P/L</span>
                            <span className={`metric-value ${analyticsSummary.totals.averagePnl >= 0 ? 'positive' : analyticsSummary.totals.averagePnl < 0 ? 'negative' : ''}`}>
                              {formatCurrency(analyticsSummary.totals.averagePnl)}
                            </span>
                          </div>
                          <div className="analytics-metric">
                            <span className="metric-label">Avg P/L %</span>
                            <span className={`metric-value ${analyticsSummary.totals.averagePnlPct >= 0 ? 'positive' : analyticsSummary.totals.averagePnlPct < 0 ? 'negative' : ''}`}>
                              {formatPercent(analyticsSummary.totals.averagePnlPct)}
                            </span>
                          </div>
                          <div className="analytics-metric">
                            <span className="metric-label">Expectancy</span>
                            <span className={`metric-value ${analyticsSummary.totals.expectancy >= 0 ? 'positive' : analyticsSummary.totals.expectancy < 0 ? 'negative' : ''}`}>
                              {formatCurrency(analyticsSummary.totals.expectancy)}
                            </span>
                          </div>
                          <div className="analytics-metric">
                            <span className="metric-label">Avg hold</span>
                            <span className="metric-value">{analyticsSummary.totals.averageHoldDays.toFixed(1)}d</span>
                          </div>
                          <div className="analytics-metric">
                            <span className="metric-label">Closed trades</span>
                            <span className="metric-value">{analyticsSummary.totals.closedTrades}</span>
                          </div>
                        </div>
                        <div className="analytics-details">
                          <div className="analytics-card">
                            <h5>Strategy breakdown</h5>
                            {analyticsSummary.strategyBreakdown.length === 0 ? (
                              <p className="section-subtle">Need more closed trades to benchmark strategies.</p>
                            ) : (
                              <ul>
                                {analyticsSummary.strategyBreakdown.slice(0, 4).map((item, index) => {
                                  const winRate = item.total ? (item.wins / item.total) * 100 : 0
                                  const winRateLabel = Number.isFinite(winRate)
                                    ? `${winRate.toFixed(0)}%`
                                    : '0%'
                                  return (
                                    <li key={`${item.strategy || 'unclassified'}-${index}`}>
                                      <div>
                                        <strong>{item.strategy || 'Unclassified'}</strong>
                                        <span className="list-subtle">
                                          {item.total} trades · Avg {formatCurrency(item.averagePnl)}
                                        </span>
                                      </div>
                                      <span className={`metric-chip ${winRate > 50 ? 'positive' : winRate < 50 ? 'negative' : ''}`}>
                                        {winRateLabel} win
                                      </span>
                                    </li>
                                  )
                                })}
                              </ul>
                            )}
                          </div>
                          <div className="analytics-card">
                            <h5>Holding periods</h5>
                            {analyticsSummary.holdingPeriods.length === 0 ? (
                              <p className="section-subtle">Start closing trades to populate holding periods.</p>
                            ) : (
                              <ul>
                                {analyticsSummary.holdingPeriods.map((bucket) => (
                                  <li key={bucket.bucket}>
                                    <span>{bucket.bucket}</span>
                                    <span>{bucket.count}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <div className="analytics-card">
                            <h5>Equity curve</h5>
                            {equitySummary ? (
                              <div className="equity-summary">
                                <span className={`equity-change ${equitySummary.change > 0 ? 'positive' : equitySummary.change < 0 ? 'negative' : ''}`}>
                                  {formatCurrency(equitySummary.change)}
                                </span>
                                <span className="equity-range">
                                  {formatCurrency(equitySummary.start)} → {formatCurrency(equitySummary.end)}
                                </span>
                                <span className="equity-points">{equitySummary.points} data points</span>
                              </div>
                            ) : (
                              <p className="section-subtle">We will chart your curve once you record more history.</p>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="empty-state">
                        <strong>No analytics yet.</strong>
                        <span>Add closed trades to unlock portfolio analytics.</span>
                      </div>
                    )}
                  </section>
                  <section className="console-section">
                    <h4>Add a trade</h4>
                    <p className="section-subtle">
                      Enter the primary leg for a structure. Additional legs can be layered in the upcoming strategy builder.
                    </p>
                    <form className="trade-form" onSubmit={handleTradeSubmit}>
                      <div className="trade-grid">
                        <label>
                          <span>Symbol *</span>
                          <input
                            value={tradeForm.symbol}
                            onChange={(event) => handleTradeChange('symbol', event.target.value)}
                            placeholder="TSLA"
                            required
                          />
                        </label>
                        <label>
                          <span>Strategy</span>
                          <input
                            value={tradeForm.strategy}
                            onChange={(event) => handleTradeChange('strategy', event.target.value)}
                            placeholder="Short call spread"
                          />
                        </label>
                        <label>
                          <span>Status</span>
                          <select
                            value={tradeForm.status}
                            onChange={(event) => handleTradeChange('status', event.target.value as TradeFormState['status'])}
                          >
                            <option value="open">Open</option>
                            <option value="closed">Closed</option>
                            <option value="rolled">Rolled</option>
                          </select>
                        </label>
                        <label>
                          <span>Opened</span>
                          <input
                            type="date"
                            value={tradeForm.openedAt}
                            onChange={(event) => handleTradeChange('openedAt', event.target.value)}
                          />
                        </label>
                        <label>
                          <span>Side *</span>
                          <select
                            value={tradeForm.side}
                            onChange={(event) => handleTradeChange('side', event.target.value as TradeFormState['side'])}
                          >
                            <option value="credit">Credit</option>
                            <option value="debit">Debit</option>
                          </select>
                        </label>
                        <label>
                          <span>Entry price *</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={tradeForm.entryPrice}
                            onChange={(event) => handleTradeChange('entryPrice', event.target.value)}
                            placeholder="1.20"
                            required
                          />
                        </label>
                        <label>
                          <span>Quantity *</span>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={tradeForm.quantity}
                            onChange={(event) => handleTradeChange('quantity', event.target.value)}
                            required
                          />
                        </label>
                        <label>
                          <span>Option type *</span>
                          <select
                            value={tradeForm.optionType}
                            onChange={(event) =>
                              handleTradeChange('optionType', event.target.value as TradeFormState['optionType'])
                            }
                          >
                            <option value="call">Call</option>
                            <option value="put">Put</option>
                          </select>
                        </label>
                        <label>
                          <span>Strike *</span>
                          <input
                            type="number"
                            step="0.01"
                            value={tradeForm.strike}
                            onChange={(event) => handleTradeChange('strike', event.target.value)}
                            placeholder="250"
                            required
                          />
                        </label>
                        <label>
                          <span>Expiry *</span>
                          <input
                            type="date"
                            value={tradeForm.expiry}
                            onChange={(event) => handleTradeChange('expiry', event.target.value)}
                            required
                          />
                        </label>
                      </div>
                      <label className="notes-block">
                        <span>Notes</span>
                        <textarea
                          rows={3}
                          value={tradeForm.notes}
                          onChange={(event) => handleTradeChange('notes', event.target.value)}
                          placeholder="Earnings play targeting post-report IV crush."
                        />
                      </label>
                      {tradeError && <p className="form-error">{tradeError}</p>}
                      <div className="form-actions">
                        <button className="primary-action" type="submit" disabled={savingTrade}>
                          {savingTrade ? 'Saving trade…' : 'Save trade'}
                        </button>
                      </div>
                    </form>
                  </section>

                  <section className="console-section">
                    <h4>Recent trades</h4>
                    <p className="section-subtle">
                      Showing the latest {summarizedTrades.length} trades synced to your OptiScope workspace.
                    </p>
                    {loadingTrades ? (
                      <div className="empty-state">Loading trades…</div>
                    ) : summarizedTrades.length === 0 ? (
                      <div className="empty-state">
                        <strong>No trades yet.</strong>
                        <span>Add your first position to preview the analytics pipeline.</span>
                      </div>
                    ) : (
                      <ul className="trade-list">
                        {summarizedTrades.map((trade) => {
                          const primaryLeg = trade.legs[0]
                          const credit = trade.netCredit ?? undefined
                          const debit = trade.netDebit ?? undefined
                          return (
                            <li key={trade.id} className="trade-item">
                              <header>
                                <div>
                                  <strong>{trade.symbol}</strong>
                                  {trade.strategy && <span className="strategy-label">{trade.strategy}</span>}
                                </div>
                                <span className={`badge ${trade.status}`}>{trade.status}</span>
                              </header>
                              <dl>
                                <div>
                                  <dt>Opened</dt>
                                  <dd>{trade.openedAt}</dd>
                                </div>
                                {primaryLeg && (
                                  <div>
                                    <dt>Leg</dt>
                                    <dd>
                                      {primaryLeg.position} {primaryLeg.legType} {primaryLeg.strike} · exp {primaryLeg.expiry}
                                    </dd>
                                  </div>
                                )}
                                <div>
                                  <dt>Premium</dt>
                                  <dd>
                                    {credit !== undefined
                                      ? `+${credit.toFixed(2)} credit`
                                      : debit !== undefined
                                        ? `-${debit.toFixed(2)} debit`
                                        : '—'}
                                  </dd>
                                </div>
                              </dl>
                              {trade.notes && <p className="trade-notes">{trade.notes}</p>}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </section>
                </div>
              </div>
            ) : (
              <div className="auth-grid">
                <form className="auth-form" onSubmit={handleAuthSubmit}>
                  <h4>{authMode === 'login' ? 'Sign in to OptiScope' : 'Create an OptiScope account'}</h4>
                  <p className="section-subtle">
                    {authMode === 'login'
                      ? 'Use your email and password to access the manual trading console.'
                      : 'Register with an email and secure password to start capturing trades.'}
                  </p>
                  <label>
                    <span>Email</span>
                    <input
                      type="email"
                      value={authForm.email}
                      autoComplete="email"
                      onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    <span>Password</span>
                    <input
                      type="password"
                      value={authForm.password}
                      autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                      onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
                      required
                    />
                  </label>
                  {authError && <p className="form-error">{authError}</p>}
                  <div className="form-actions">
                    <button className="primary-action" type="submit" disabled={authLoading}>
                      {authLoading
                        ? 'Submitting…'
                        : authMode === 'login'
                          ? 'Sign in'
                          : 'Create account'}
                    </button>
                    <button
                      className="muted-button"
                      type="button"
                      onClick={() => {
                        setAuthMode((prev) => (prev === 'login' ? 'register' : 'login'))
                        setAuthError(null)
                      }}
                    >
                      {authMode === 'login' ? 'Need an account?' : 'Already registered?'}
                    </button>
                  </div>
                </form>
                <aside className="auth-aside">
                  <h4>What you get today</h4>
                  <ul>
                    <li>Secure JWT-backed authentication</li>
                    <li>Manual trade capture with strategy metadata</li>
                    <li>Immediate confirmation in the dashboard</li>
                  </ul>
                  <h4>Coming soon</h4>
                  <ul>
                    <li>Live broker syncing</li>
                    <li>AI risk commentary and alerts</li>
                    <li>Collaborative notes and export</li>
                  </ul>
                </aside>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
