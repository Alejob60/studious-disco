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

