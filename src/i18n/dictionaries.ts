/**
 * Translation dictionaries.
 *
 * Flat-ish nested objects keyed by dotted path, mirroring the `t('a.b.c')` shape
 * used on colombiatic.com.co so copy conventions stay familiar between projects.
 */

export type Locale = 'es' | 'en'

export const LOCALES: { locale: Locale; label: string; short: string }[] = [
  { locale: 'es', label: 'Español', short: 'ES' },
  { locale: 'en', label: 'English', short: 'EN' },
]

export const DEFAULT_LOCALE: Locale = 'es'

const es = {
  meta: {
    title: 'Atelier Predict — Pronóstico de Demanda con IA Agéntica',
    description:
      'Anticipa el consumo, optimiza costos y automatiza la interacción con tus clientes. Motor de pronóstico de demanda con IA agéntica para retail colombiano.',
  },
  nav: {
    agent: 'Agente',
    forecast: 'Pronóstico',
    services: 'Servicios',
    lab: 'Tus datos',
    contact: 'Contacto',
    legal: 'Legal',
    skipToContent: 'Saltar al contenido',
  },
  hero: {
    badge: 'Pronóstico agéntico para retail colombiano',
    titleLead: 'Motor de Pronóstico de Demanda con',
    titleAccent: 'IA Agéntica',
    subtitle:
      'Anticipa el consumo, optimiza costos y automatiza la interacción con tus clientes.',
    cta: 'Iniciar Predicción',
    ctaSecondary: 'Hablar con el agente',
    trust: ['Amazon Bedrock', 'Pronóstico en tiempo real', 'Acciones agénticas'],
    live: 'Datos en vivo · AWS',
    demo: 'Modo demostración',
    loading: 'Consultando la API',
  },
kpis: {
title: 'Indicadores clave',
    model: 'Modelo: Holt-Winters estacional · período 7 días',
    vsWeek: 'vs. semana actual',
    demandLabel: 'Demanda predicha (7 días)',
    demandHint: 'Suma del pronóstico frente a {units} unidades reales de la semana en curso.',
    savingsLabel: 'Ahorro en reposición (30 días)',
    savingsHint:
      'Backtest: el modelo comete {modelMae} unidades/día de error frente a {baselineMae} del baseline estacional, a un margen de {margin} por unidad. Ahorro {savings} a {rate} COP/USD.',
    accuracyLabel: 'Precisión del modelo (WAPE)',
    accuracyHint:
      'Validado sobre {holdout} días retenidos. Baseline estacional: {baseline}% → modelo: {model}% ({improvement}% mejor).',
    unit: 'unid.',
    usd: 'USD',
    percent: '%',
  },
  lab: {
    eyebrow: 'Pruébalo con tus datos',
    title: 'El mismo modelo, sobre tu propia serie',
    lead: 'Lo de arriba corre sobre una serie sintética. Aquí sube la tuya y el motor la evalúa de verdad: aparta los últimos 14 días sin verlos, pronostica, y se compara contra una regla ingenua que solo repite la semana anterior. El mismo código que produce el 7,77 % del panel es el que corre aquí.',
    stepData: '1 · Tus datos',
    stepDataBody:
      'Descarga la serie de ejemplo de una tienda (28 semanas con ritmo semanal, picos de quincena y un salto en Navidad) y edítala, o sube tu propio CSV. Aceptamos coma o punto y coma, y coma decimal.',
    loadSample: 'Cargar la serie de ejemplo',
    upload: 'Subir mi CSV',
    csvLabel: 'Contenido del CSV (editable)',
    csvPlaceholder: 'date,units\n2026-01-01,142\n2026-01-02,118',
    csvHint: 'Mínimo 28 días. Columna de unidades chamada units, unidades, ventas o demanda. Hasta 365 días.',
    run: 'Evaluar mi serie',
    running: 'Evaluando…',
    stepResult: '2 · Resultado medido',
    idle: 'Carga una serie y presiona evaluar. Verás el error del modelo y el de la línea base, medidos sobre los mismos 14 días que el modelo nunca vio.',
    errorPrefix: 'No se pudo evaluar:',
    errorNetwork: 'No se pudo contactar la API. Revisa tu conexión e inténtalo de nuevo.',
    metricWape: 'WAPE del modelo',
    metricWapeHint: 'Error ponderado del Holt-Winters sobre la base retenida.',
    metricBaseline: 'WAPE línea base',
    metricBaselineHint: 'Estacional naive: repetir la semana anterior.',
    metricImprovement: 'Mejora',
    metricImprovementHint: 'Cuánto menos error que la línea base.',
    metricMae: 'MAE (unidades/día)',
    metricMaeHint: 'Unidades equivocadas por día; la línea base: {baseline}.',
    resultSentence:
      'Evaluados {points} días con 14 retenidos. El pico cae el {peak} con {units} unidades.',
    savingsSentence:
      'A un margen de 18.500 COP por unidad, ese salto de precisión vale {money} al mes.',
    persisted: 'Evaluación registrada como {id} y conservada {days} días.',
    notPersisted:
      'La métrica es real pero no se pudo guardar: la base de datos no respondió. El cálculo no depende de ella.',
  },
  history: {
    title: 'Todo lo que hemos medido',
    subtitle:
      'Leído de la base de datos, no de un contador en esta página. Los agregados se calculan en MongoDB sobre todos los registros guardados.',
    refresh: 'Actualizar',
    failed: 'No se pudo leer el historial. La base de datos no respondió.',
    empty: 'Todavía no hay evaluaciones guardadas. Evalúa una serie y aparecerá aquí.',
    statTotal: 'Evaluaciones',
    statTotalHint: 'Series distintas que alguien ha enviado.',
    statBeaten: 'Venció al baseline',
    statBeatenHint: 'Proporción de series donde el modelo tuvo menos error.',
    statAvg: 'WAPE medio',
    statAvgHint: 'La línea base promedió {baseline}.',
    statAvgEmpty: 'Sin datos suficientes.',
    statSpread: 'Rango de mejora',
    statSpreadHint: 'De la peor serie a la mejor.',
    colWhen: 'Cuándo',
    colSource: 'Origen',
    colPoints: 'Días',
    colWape: 'Modelo',
    colBaseline: 'Baseline',
    colImprovement: 'Mejora',
    disclaimer:
      'Esto es un registro, no una tendencia. Las primeras entradas son todas la misma serie de ejemplo, así que un gráfico de precisión en el tiempo no diría nada todavía. La serie que subiste nunca se devuelve por esta vía.',
  },
  services: {
    badge: 'Cómo funciona',
    title: 'Tres servicios, una decisión',
    subtitle:
      'Cada pieza hace lo que mejor se le da. El pronóstico es instantáneo, el modelo fundacional se recalcula por la noche y el agente convierte ambos en acciones.',
    layers: 'Capas',
    items: [
      {
        name: 'Pronóstico instantáneo',
        tag: 'Ruta caliente',
        what: 'Proyecta la demanda de los próximos 14 días en ~1 ms.',
        how: 'Un modelo estadístico ajustado dentro de la misma función que responde. Sin llamadas a otros servicios, sin esperas.',
        proof: 'WAPE 7,77 % · backtest estacional',
      },
      {
        name: 'Modelo fundacional',
        tag: 'Recalculo nocturno',
        what: 'Un modelo fundacional de series de tiempo, 200 millones de parámetros, entrenado con millones de series públicas.',
        how: 'Corre una vez por la noche sobre el histórico completo y publica el resultado. La ruta de la mañana solo lo lee.',
        proof: 'WAPE 5,61 % · 2,15 puntos mejor',
      },
      {
        name: 'Agente con herramientas',
        tag: 'Acción',
        what: 'Convierte el pronóstico en una campaña o una orden de reposición.',
        how: 'Lee el mismo dato que tú ves y propone la acción con cifras concretas. Tú confirmas antes de que salga.',
        proof: 'Bedrock · 2 herramientas verificadas',
      },
    ],
winner: {
      title: 'Ingeniería, no promesas de IA',
      points: [
        {
          head: 'La precisión se demuestra, no se afirma',
          body: 'Publicamos el backtest y el holdout exacto de 14 días. Un juez lo reproduce con un solo comando. Esa es la diferencia entre afirmar y probar.',
        },
        {
          head: 'Arquitectura champion / challenger',
          body: 'El modelo fundacional aporta la precisión máxima; el modelo estadístico aporta la latencia de 1 ms. Separados por presupuesto de rendimiento, no hay que renunciar a ninguno.',
        },
        {
          head: 'Cero alucinaciones',
          body: 'Las herramientas del agente solo leen lo que el pronóstico ya calculó. Si el número no existe, la herramienta falla de forma controlada y el agente lo admite.',
        },
        {
          head: 'Sin punto único de falla',
          body: 'Si el servicio del modelo fundacional falla, el pronóstico instantáneo sigue respondiendo. El cliente nunca queda sin respuesta.',
        },
      ],
    },
  },
  chart: {
    reality: 'Realidad',
    prediction: 'Predicción IA',
    peakDetected: 'Pico detectado',
    backtest: 'Backtest sobre {days} días',
    baseline: 'baseline estacional {value}%',
    unit: 'unid.',
  },
  chat: {
    badge: 'Agente de decisión',
    subtitle: 'Del pronóstico a la acción: el agente no solo predice, ejecuta.',
    online: 'En línea · Claude en Bedrock',
    offline: 'Sin conexión · respuestas locales',
    placeholder: 'Escribe una instrucción al agente...',
    hint: 'Enter para enviar · El agente responde con Claude (Amazon Bedrock) sobre el pronóstico.',
    demoReplyNote: 'Respuesta local · sin API',
    fallbackNote: 'Respuesta local · API no disponible',
    fallbackNotice:
      'No se pudo contactar al agente ({detail}). Se muestra una respuesta de demostración.',
    send: 'Enviar',
    channelWhatsapp: 'WhatsApp',
    actionCampaign: 'Campaña activada',
    actionReorder: 'Punto de reposición ajustado',
    actionExecuted: 'Acción ejecutada',
    contacts: 'contactos',
    skuSuffix: 'unid.',
    initial: [
      {
        role: 'agent',
        text: 'He analizado tu histórico. Detecto un pico de demanda para el próximo jueves. ¿Activo la campaña de WhatsApp para ese día?',
        meta: 'Confianza del modelo: 87%',
      },
      { role: 'user', text: 'Sí, optimiza el envío para maximizar el recaudo.' },
      {
        role: 'agent',
        text: 'Listo. Segmenté 1.842 contactos con alta propensión y programé 3 ventanas de envío (10:00, 16:00 y 20:00) para evitar saturación. Proyección de recaudo adicional: USD 32 (COP 128.600 a 4.000 COP/USD).',
        meta: 'Campaña programada · WhatsApp',
      },
    ],
    replies: [
      'Entendido. Ajusté el umbral de reposición al 82% y reservé inventario con el proveedor para cubrir el pico.',
      'Listo. Comparé tres proveedores y el mejor costo por unidad está en el lote del jueves. ¿Autorizas la orden?',
      'Hecho. Dejé la campaña en modo learns y te aviso mañana con el resultado real contra lo proyectado.',
    ],
  },
  contact: {
    badge: 'Hablemos',
    title: 'Contacta al equipo',
    subtitle:
      'Prueba el motor con tus datos reales o hable con nuestro equipo de arquitectura.',
    nameLabel: 'Nombre completo',
    emailLabel: 'Correo electrónico',
    companyLabel: 'Empresa',
    roleLabel: 'Cargo',
    challengeLabel: 'Cuál es tu desafío',
    challengeHint:
      'Por ejemplo: necesitoPronosticar demanda por tienda y SKU con menos de un día de rezago.',
    interestLabel: 'Interés principal',
    submit: 'Enviar solicitud',
    submitting: 'Enviando...',
    sendAnother: 'Enviar otra',
    footnote:
      'Usamos tus datos únicamente para responder esta solicitud, conforme a nuestra política de privacidad. No compartimos información con terceros.',
    successTitle: 'Solicitud recibida',
    successBody:
      'Nuestro equipo ya la tiene. Te respondemos en menos de 24 horas hábiles.',
    errorTitle: 'No pudimos enviar tu solicitud',
    errors: {
      name: 'El nombre es obligatorio',
      email: 'El correo es obligatorio',
      emailInvalid: 'Ingresa un correo válido',
      company: 'La empresa es obligatoria',
      role: 'El cargo es obligatorio',
      challenge: 'Cuéntanos tu desafío',
      generic: 'Intenta de nuevo en unos segundos',
      rate: 'Demasiados envíos desde esta conexión. Espera unos minutos.',
      delivery: 'No pudimos entregar el mensaje. Escríbenos directo a',
    },
    interests: {
      government: 'Gobierno y sector público',
      business: 'Empresas y comercio',
      investment: 'Inversión',
    },
    directEmail: 'O escríbenos directo a',
  },
  cookies: {
    title: 'Tu privacidad, tu decisión',
    body:
      'Usamos almacenamiento local para recordar tus preferencias de cookies. No usamos cookies publicitarias ni de seguimiento.',
    acceptAll: 'Aceptar todas',
    rejectAll: 'Solo esenciales',
    learnMore: 'Ver política de cookies',
  },
  footer: {
    built: 'Construido para el Hackathon AWS Zero to Shipped 2026',
    legal: 'Legal',
    privacy: 'Política de privacidad',
    terms: 'Términos y condiciones',
    cookies: 'Política de cookies',
    refunds: 'Política de reembolsos',
    rights: 'ColombiaTIC Ingeniería SAS · Todos los derechos reservados',
  },
  legal: {
    draftNotice:
      'Documento de referencia para el MVP del hackathon. Requiere validación jurídica antes de publicarse como política definitiva.',
    updated: 'Última actualización',
    effective: 'Vigente desde',
    toc: 'Contenido',
    backToHome: 'Volver al inicio',
    contactHeading: 'Contacto para asuntos de datos',
  },
  common: {
    loading: 'Cargando',
    notFound: 'Página no encontrada',
    notFoundBody: 'La ruta que buscas no existe.',
    goHome: 'Ir al inicio',
  },
}

export type Dictionary = typeof es

const en: Dictionary = {
  meta: {
    title: 'Atelier Predict — Agentic AI Demand Forecasting',
    description:
      'Anticipate demand, optimise costs and automate customer outreach. An agentic demand forecasting engine for Colombian retail.',
  },
  nav: {
    agent: 'Agent',
    forecast: 'Forecast',
    services: 'Services',
    lab: 'Your data',
    contact: 'Contact',
    legal: 'Legal',
    skipToContent: 'Skip to content',
  },
  hero: {
    badge: 'Agentic forecasting for Colombian retail',
    titleLead: 'Agentic AI Demand',
    titleAccent: 'Forecasting Engine',
    subtitle:
      'Anticipate demand, optimise costs and automate the way you talk to your customers.',
    cta: 'Run a forecast',
    ctaSecondary: 'Talk to the agent',
    trust: ['Amazon Bedrock', 'Real-time forecasting', 'Agentic actions'],
    live: 'Live data · AWS',
    demo: 'Demo mode',
    loading: 'Calling the API',
  },
  kpis: {
title: 'Key metrics',
    model: 'Model: seasonal Holt-Winters · 7-day period',
    vsWeek: 'vs. current week',
    demandLabel: 'Forecast demand (7 days)',
    demandHint: 'Sum of the projection against {units} real units for the week in progress.',
    savingsLabel: 'Replenishment savings (30 days)',
    savingsHint:
      'Backtest: the model misses by {modelMae} units/day against {baselineMae} for the seasonal baseline, at a {margin} margin per unit. Worth {savings} at {rate} COP/USD.',
    accuracyLabel: 'Model precision (WAPE)',
    accuracyHint:
      'Measured on {holdout} held-out days. Seasonal baseline: {baseline}% → model: {model}% ({improvement}% better).',
    unit: 'units',
    usd: 'USD',
    percent: '%',
  },
  lab: {
    eyebrow: 'Try it on your data',
    title: 'The same model, on your own series',
    lead: 'The chart above runs on a synthetic series. Upload yours and the engine evaluates it for real: it holds back the last 14 days unseen, forecasts them, and compares itself against a naive rule that just repeats last week. This is the same code that produces the 7.77 % on the dashboard.',
    stepData: '1 · Your data',
    stepDataBody:
      'Download the sample series for a neighbourhood shop (28 weeks of weekly rhythm, payday bumps and a Christmas spike) and edit it, or upload your own CSV. Both comma and semicolon delimiters are accepted, as is a decimal comma.',
    loadSample: 'Load the sample series',
    upload: 'Upload my CSV',
    csvLabel: 'CSV contents (editable)',
    csvPlaceholder: 'date,units\n2026-01-01,142\n2026-01-02,118',
    csvHint: 'At least 28 days. Name the units column units, unidades, sales or demand. Up to 365 days.',
    run: 'Evaluate my series',
    running: 'Evaluating…',
    stepResult: '2 · Measured result',
    idle: 'Load a series and press evaluate. You will see the model error next to the baseline error, both measured on the same 14 days the model never saw.',
    errorPrefix: 'Could not evaluate:',
    errorNetwork: 'Could not reach the API. Check your connection and try again.',
    metricWape: 'Model WAPE',
    metricWapeHint: "Holt-Winters weighted error on the held-out window.",
    metricBaseline: 'Baseline WAPE',
    metricBaselineHint: 'Seasonal naive: repeating last week.',
    metricImprovement: 'Improvement',
    metricImprovementHint: 'How much less error than the baseline.',
    metricMae: 'MAE (units/day)',
    metricMaeHint: 'Wrong units per day; the baseline gets {baseline}.',
    resultSentence:
      'Evaluated {points} days with 14 held out. The peak lands on {peak} at {units} units.',
    savingsSentence:
      'At an 18,500 COP contribution margin per unit, that jump in accuracy is worth {money} a month.',
    persisted: 'Evaluation stored as {id} and kept for {days} days.',
    notPersisted:
      'The measurement is real but could not be stored: the database did not answer. The calculation does not depend on it.',
  },
  history: {
    title: 'Everything we have measured',
    subtitle:
      'Read from the database, not from a counter on this page. The aggregates are computed in MongoDB across every stored record.',
    refresh: 'Refresh',
    failed: 'Could not read the ledger. The database did not answer.',
    empty: 'No evaluations stored yet. Score a series and it will appear here.',
    statTotal: 'Evaluations',
    statTotalHint: 'Distinct series somebody has sent.',
    statBeaten: 'Beat the baseline',
    statBeatenHint: 'Share of series where the model had less error.',
    statAvg: 'Average WAPE',
    statAvgHint: 'The baseline averaged {baseline}.',
    statAvgEmpty: 'Not enough data.',
    statSpread: 'Improvement range',
    statSpreadHint: 'From the worst series to the best.',
    colWhen: 'When',
    colSource: 'Source',
    colPoints: 'Days',
    colWape: 'Model',
    colBaseline: 'Baseline',
    colImprovement: 'Improvement',
    disclaimer:
      'This is a ledger, not a trend. Every entry so far is the same sample series, so an accuracy-over-time chart would say nothing yet. The series you upload is never returned through this path.',
  },
  services: {
    badge: 'How it works',
    title: 'Three services, one decision',
    subtitle:
      'Each piece does what it is best at. The forecast is instant, the foundation model is recomputed overnight, and the agent turns both into actions.',
    layers: 'Layers',
    items: [
      {
        name: 'Instant forecast',
        tag: 'Hot path',
        what: 'Projects demand for the next 14 days in about 1 ms.',
        how: 'A statistical model fitted inside the same function that answers. No calls to other services, no waiting.',
        proof: '7.77 % WAPE · seasonal backtest',
      },
      {
        name: 'Foundation model',
        tag: 'Nightly recompute',
        what: 'A 200-million-parameter time-series foundation model, pre-trained on millions of public series.',
        how: 'It runs once a night over the full history and publishes the result. The morning request only reads it.',
        proof: '5.61 % WAPE · 2.15 points better',
      },
      {
        name: 'Tool-using agent',
        tag: 'Action',
        what: 'Turns the forecast into a campaign or a reorder.',
        how: 'It reads the same numbers you see and proposes the action with real figures. You confirm before anything ships.',
        proof: 'Bedrock · 2 verified tools',
      },
    ],
    winner: {
title: 'Engineering, not AI promises',
      points: [
        {
          head: 'Accuracy is shown, not claimed',
          body: 'We publish the backtest and the exact 14-day holdout. A judge reproduces it with one command. That is the difference between claiming and proving.',
        },
        {
          head: 'Champion / challenger architecture',
          body: 'The foundation model brings maximum accuracy; the statistical model brings 1 ms latency. Split by performance budget, neither has to be given up.',
        },
        {
          head: 'No hallucinations',
          body: "The agent's tools only read what the forecast already computed. If the number does not exist, the tool fails in a controlled way and the agent admits it.",
        },
        {
          head: 'No single point of failure',
          body: 'If the foundation model service fails, the instant forecast keeps answering. The customer is never left without a response.',
        },
      ],
    },
  },
  chart: {
    reality: 'Actual',
    prediction: 'AI forecast',
    peakDetected: 'Detected peak',
    backtest: 'Backtest over {days} days',
    baseline: 'seasonal baseline {value}%',
    unit: 'units',
  },
  chat: {
    badge: 'Decision agent',
    subtitle: 'From forecast to action: the agent does not only predict, it acts.',
    online: 'Online · Claude on Bedrock',
    offline: 'Offline · local replies',
    placeholder: 'Write an instruction to the agent...',
    hint: 'Press Enter to send · The agent answers with Claude (Amazon Bedrock) over the forecast.',
    demoReplyNote: 'Local reply · no API',
    fallbackNote: 'Local reply · API unavailable',
    fallbackNotice:
      'Could not reach the agent ({detail}). Showing a demo reply instead.',
    send: 'Send',
    channelWhatsapp: 'WhatsApp',
    actionCampaign: 'Campaign activated',
    actionReorder: 'Reorder point adjusted',
    actionExecuted: 'Action executed',
    contacts: 'contacts',
    skuSuffix: 'units',
    initial: [
      {
        role: 'agent',
        text: 'I reviewed your history. I detect a demand spike for next Thursday. Should I activate the WhatsApp campaign for that day?',
        meta: 'Model confidence: 87%',
      },
      { role: 'user', text: 'Yes, optimise the send to maximise revenue.' },
      {
        role: 'agent',
        text: 'Done. I segmented 1,842 high-propensity contacts and scheduled 3 send windows (10:00, 16:00 and 20:00) to avoid saturation. Projected extra revenue: USD 32 (COP 128,600 at 4,000 COP/USD).',
        meta: 'Campaign scheduled · WhatsApp',
      },
    ],
    replies: [
      'Understood. I raised the reorder threshold to 82% and reserved inventory with the supplier to cover the peak.',
      'Done. I compared three suppliers and the best unit cost is on Thursday’s batch. Do you authorise the order?',
      'All set. I left the campaign in learns mode and will report tomorrow with actuals against the forecast.',
    ],
  },
  contact: {
    badge: 'Get in touch',
    title: 'Contact the team',
    subtitle:
      'Try the engine on your own data, or talk to our architecture team.',
    nameLabel: 'Full name',
    emailLabel: 'Email address',
    companyLabel: 'Company',
    roleLabel: 'Job title',
    challengeLabel: 'What is your challenge',
    challengeHint:
      'For example: I need to forecast demand per store and SKU with less than a day of lag.',
    interestLabel: 'Main interest',
    submit: 'Send request',
    submitting: 'Sending...',
    sendAnother: 'Send another',
    footnote:
      'We use your data only to answer this request, in line with our privacy policy. We do not share information with third parties.',
    successTitle: 'Request received',
    successBody: 'Our team already has it. We reply within one business day.',
    errorTitle: 'We could not send your request',
    errors: {
      name: 'Name is required',
      email: 'Email is required',
      emailInvalid: 'Enter a valid email address',
      company: 'Company is required',
      role: 'Job title is required',
      challenge: 'Tell us about your challenge',
      generic: 'Please try again in a few seconds',
      rate: 'Too many submissions from this connection. Please wait a few minutes.',
      delivery: 'We could not deliver your message. Write to us directly at',
    },
    interests: {
      government: 'Government and public sector',
      business: 'Business and commerce',
      investment: 'Investment',
    },
    directEmail: 'Or write to us directly at',
  },
  cookies: {
    title: 'Your privacy, your choice',
    body:
      'We use local storage to remember your cookie preferences. We do not use advertising or tracking cookies.',
    acceptAll: 'Accept all',
    rejectAll: 'Essential only',
    learnMore: 'View cookie policy',
  },
  footer: {
    built: 'Built for the AWS Zero to Shipped 2026 Hackathon',
    legal: 'Legal',
    privacy: 'Privacy policy',
    terms: 'Terms and conditions',
    cookies: 'Cookie policy',
    refunds: 'Refund policy',
    rights: 'ColombiaTIC Ingeniería SAS · All rights reserved',
  },
  legal: {
    draftNotice:
      'Reference document for the hackathon MVP. It requires legal review before being published as a final policy.',
    updated: 'Last updated',
    effective: 'Effective from',
    toc: 'Contents',
    backToHome: 'Back to home',
    contactHeading: 'Data protection contact',
  },
  common: {
    loading: 'Loading',
    notFound: 'Page not found',
    notFoundBody: 'The page you are looking for does not exist.',
    goHome: 'Go home',
  },
}

export const dictionaries: Record<Locale, Dictionary> = { es, en }

