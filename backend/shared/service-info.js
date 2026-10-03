/**
 * Service metadata for the Atelier Predict API.
 *
 * Served from `GET /` so the base URL is self-describing: a judge who pastes it
 * or an agent that discovers it gets the endpoint index and the model identity
 * instead of a bare 404.
 */

const MODEL = {
  name: 'holt-winters-additive',
  description:
    'Additive Holt-Winters triple exponential smoothing with weekly seasonality (period 7), fitted on the request history and scored against a seasonal-naive baseline on a 14-day holdout.',
  holdoutPoints: 14,
  period: 7,
}

const ENDPOINTS = [
  {
    method: 'GET',
    path: '/forecast',
    description:
      'Demand forecast with 95% confidence bands plus backtest metrics. Accepts an optional JSON body { history: number[] } to run on real data instead of the synthetic demo series.',
    query: { horizon: 'days to project, 1-30 (default 14)', unitMargin: 'COP contribution margin per unit (default 18500)' },
  },
  {
    method: 'POST',
    path: '/chat',
    description:
      'Agentic endpoint. Claude receives the statistical forecast as ground truth and can call activate_campaign or adjust_reorder_point.',
    body: { message: 'string (required)', history: 'array of { role, content } turns (optional)', locale: "'es' or 'en' (optional, default es)" },
  },
  {
    method: 'POST',
    path: '/lead',
    description:
      'Hackathon lead capture. Sends a notification to the sales inbox plus a confirmation to the submitter, both tagged with the originating site.',
    body: {
      name: 'string (required)',
      email: 'string (required)',
      company: 'string (required)',
      role: 'string (required)',
      challenge: 'string (required)',
      interests: 'array of government | business | investment (optional)',
      locale: "'es' or 'en' (optional)",
    },
    notes: 'Rate limited to 5 requests per 10 minutes per IP. Bots hitting the honeypot field receive a 201 with no mail sent.',
  },
]

const FRONTEND_URL = 'https://main.d28ukybtuih8pa.amplifyapp.com'
const REPOSITORY_URL = 'https://github.com/Alejob60/studious-disco'

/**
 * Builds the index payload.
 *
 * @param {string} origin absolute origin of the running API, kept for reference
 *   so a caller can build same-host URLs if the surface ever moves here.
 */
function describeApi(origin) {
  return {
    service: 'Atelier Predict API',
    version: '1.0.0',
    description:
      'Serverless demand forecasting for retail, with an Amazon Bedrock agent that turns the forecast into actions.',
    status: 'operational',
    model: MODEL,
    accuracy: {
      metric: 'WAPE on a 14-day holdout',
      model: 7.77,
      baselineSeasonalNaive: 10.17,
      improvementPct: 23.61,
      note: 'Reproducible from a fixed seed; asserted in backend/test/forecast-engine.test.js.',
    },
    endpoints: ENDPOINTS,
    thisApi: origin || null,
    frontend: FRONTEND_URL,
    repository: REPOSITORY_URL,
    // These files are served by Amplify, not by this API. Linking them against
    // the API origin would 404.
    agentSurface: {
      llms: `${FRONTEND_URL}/llms.txt`,
      robots: `${FRONTEND_URL}/robots.txt`,
      sitemap: `${FRONTEND_URL}/sitemap.xml`,
      documentation: `${REPOSITORY_URL}#readme`,
    },
    caveats: [
      'The default forecast uses a deterministic synthetic history for the demo.',
      'The legal pages are reference drafts and require legal review before being published as binding policy.',
      'Chat and lead endpoints are unauthenticated; rate limiting on /lead is per instance.',
      'There is no route for GET /chat or GET /lead: those endpoints are POST only.',
    ],
    contact: { sales: 'enterprise@colombiatic.com.co' },
  }
}

module.exports = { MODEL, ENDPOINTS, FRONTEND_URL, REPOSITORY_URL, describeApi }