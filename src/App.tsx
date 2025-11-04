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

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'
const AUTH_STORAGE_KEY = 'optiscope.auth'

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

  const handleLogout = () => {
    setAuth(null)
    setTrades([])
    setIsConsoleOpen(false)
  }

  const summarizedTrades = useMemo(() => trades.slice(0, 20), [trades])

  return (
    <div className="page">
      <header className="hero" id="top">
        <nav className="navbar">
          <div className="brand">OptiScope</div>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#workflow">Workflow</a>
            <a href="#scenarios">Scenarios</a>
          </div>
          <button className="nav-cta" type="button" onClick={primaryCTA}>
            {hasAuth ? 'Open console' : 'Launch console'}
          </button>
        </nav>
        <div className="hero-body">
          <div className="hero-copy">
            <span className="tagline">AI-powered options intelligence</span>
            <h1>Clarity and conviction for every multi-leg trade.</h1>
            <p>
              OptiScope transforms your options portfolio into interactive strategy maps, real-time Greeks,
              and proactive guidance so you can stay ahead of volatility without spreadsheet sprawl.
            </p>
            <div className="hero-actions">
              <button className="primary-action" type="button" onClick={primaryCTA}>
                Launch trading console
              </button>
              <a className="secondary-action" href="#cta">
                View product roadmap
              </a>
            </div>
            <div className="hero-stats">
              <div className="stat-card">
                <span className="stat-value">45+</span>
                <span className="stat-label">Strategies auto-detected</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">60s</span>
                <span className="stat-label">Insight delivery per sync</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">0</span>
                <span className="stat-label">Extra spreadsheets required</span>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="visual-card">
              <div className="visual-header">
                <span>Live P/L Surface</span>
                <span className="visual-status">Synced</span>
              </div>
              <div className="visual-chart" aria-hidden="true">
                <div className="chart-line" />
                <div className="chart-line" />
                <div className="chart-highlight" />
              </div>
              <div className="visual-footer">
                <div>
                  <strong>Portfolio Delta</strong>
                  <span className="visual-metric positive">+0.42</span>
                </div>
                <div>
                  <strong>Theta (24h)</strong>
                  <span className="visual-metric">-138</span>
                </div>
                <div>
                  <strong>Vega Sensitivity</strong>
                  <span className="visual-metric">Medium</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main>
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
