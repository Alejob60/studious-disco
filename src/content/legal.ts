/**
 * Legal document content.
 *
 * IMPORTANT: these are reference drafts written for the hackathon MVP, not
 * advice. They follow the structure Colombian law expects (Ley 1581 de 2012 on
 * personal data protection, Ley 1712 on transparency, and the consumer
 * provisions on distance sales) but MUST be reviewed by a lawyer before being
 * published as binding policy.
 *
 * The `body` fields are plain paragraphs so the renderer stays free of raw HTML.
 */

import {
  type LegalDocId,
} from './legal-meta'

// Slugs, labels and lookups live in legal-meta.ts so lightweight components can
// link to a policy without pulling every policy body into the main bundle.
export * from './legal-meta'

export type LegalSection = {
  heading: string
  paragraphs: string[]
  list?: string[]
}

export type LegalDoc = {
  id: LegalDocId
  title: string
  updated: string
  effective: string
  intro: string[]
  sections: LegalSection[]
}

const UPDATED_ES = '23 de octubre de 2026'
const UPDATED_EN = 'October 23, 2026'
const EFFECTIVE_ES = '23 de octubre de 2026'
const EFFECTIVE_EN = 'October 23, 2026'

export const LEGAL_DOCS_ES: Record<LegalDocId, LegalDoc> = {
  privacy: {
    id: 'privacy',
    title: 'Política de Privacidad',
    updated: UPDATED_ES,
    effective: EFFECTIVE_ES,
    intro: [
      'ColombiaTIC Ingeniería SAS, identificada con el NIT que se indique en la factura correspondiente y domiciliada en Colombia, es la responsable del tratamiento de los datos personales que se recopilan a través de este sitio web (en adelante, «Atelier Predict»).',
      'Esta política explica qué datos recogemos, con qué finalidad, sobre qué base legal los tratamos, cuánto tiempo los conservamos y cómo puedes ejercer tus derechos.',
    ],
    sections: [
      {
        heading: '1. Responsable y contacto',
        paragraphs: [
          'El responsable del tratamiento es ColombiaTIC Ingeniería SAS. Para cualquier consulta sobre esta política o sobre el ejercicio de derechos puedes escribir a dairagarzon@colombiatic.com.co. Responderemos dentro de los plazos legales vigentes, y en todo caso dentro de los diez (10) días hábiles siguientes a la recepción de la solicitud.',
        ],
      },
      {
        heading: '2. Qué datos recogemos',
        paragraphs: ['Recogemos únicamente los datos que nos proporcionas voluntariamente a través del formulario de contacto:'],
        list: [
          'Nombre completo.',
          'Correo electrónico.',
          'Empresa u organización.',
          'Cargo o rol.',
          'Descripción del desafío o necesidad.',
          'Interés declarado (gobierno, empresas o inversión).',
          'Idioma de la interfaz y datos técnicos básicos de la conexión, como la dirección IP de origen, que se procesan de forma transitoria para prevenir abuso.',
        ],
      },
      {
        heading: '3. Para qué usamos los datos y con qué autorización',
        paragraphs: [
          'Tratamos tus datos con las siguientes finalidades y marcos de autorización:',
        ],
        list: [
          'Para responder tu solicitud comercial o técnica. Base: tu consentimiento inequívoco al enviar el formulario, y nuestro interés legítimo en atender las consultas que diriges a la empresa.',
          'Para mantener un registro de las comunicaciones comerciales. Base: tu consentimiento y el cumplimiento de obligaciones legales de conservación.',
          'Para enviarte comunicaciones informativas sobre el producto. Base: tu consentimiento, que puedes retirar en cualquier momento.',
        ],
      },
      {
        heading: '4. Encargados y terceros',
        paragraphs: [
          'No vendemos, rents ni cedemos tus datos personales. Podemos usar los siguientes terceros, que actúan como encargados del tratamiento y solo por cuenta propia:',
        ],
        list: [
          'Amazon Web Services (AWS) — alojamiento e infraestructura en la nube, región us-east-1.',
          'Amazon Bedrock (servicio de AWS) — procesamiento de modelos de IA generativa (Claude Sonnet 4.5 de Anthropic). Los mensajes de chat se envían a Bedrock para inferencia y no se almacenan en servidores propios.',
          'MongoDB Atlas (MongoDB Inc.) — almacenamiento de resultados de evaluación con TTL de 90 días, en la nube pública (región us-east-1).',
          'Resend — envío de correos electrónicos transaccionales.',
          'Google Fonts — fuentes tipográficas en línea (puede revelar la dirección IP al proveedor).',
          'Registro de la Autoridad para la Protección de Datos Personales de Colombia, cuando corresponda conforme a la ley.',
        ],
      },
      {
        heading: '5. Cómo y durante cuánto tiempo conservamos tus datos?',
        paragraphs: [
          'Conservamos los datos mientras exista una relación comercial o mientras no revoques tu consentimiento, y por los plazos de conservación legales aplicables. Una vez vencidos, los eliminamos o los anonimizamos de forma irreversible.',
        ],
      },
      {
        heading: '6. Tus derechos como titular',
        paragraphs: [
          'Como titular de los datos tienes derecho a conocer, actualizar, rectificar, suprimir (derecho de acceso y supresión de los datos), revocar el consentimiento, solicitar la portabilidad y presentar una queja ante la Autoridad para la Protección de Datos Personales de Colombia.',
          'Para ejercerlos, escribe a dairagarzon@colombiatic.com.co indicando tu nombre, la identidad del dato y la actuación que solicitas. Respondemos dentro de los plazos legales vigentes.',
        ],
      },
      {
        heading: '7. Seguridad de la información',
        paragraphs: [
          'Aplicamos medidas técnicas y administrativas razonables para proteger tus datos contra acceso no autorizado, pérdida o alteración. El sitio se sirve íntegramente sobre HTTPS y los secretos de los servicios de terceros se almacenan cifrados en un gestor de secretos.',
          'Ninguna transmisión por Internet es totalmente segura, por lo que no podemos garantizar la seguridad absoluta de la información.',
        ],
      },
      {
        heading: '8. Cambios a esta política',
        paragraphs: [
          'Podemos actualizar esta política para reflejar cambios legales o del producto. Publicaremos la versión vigente en esta página junto con su fecha de actualización.',
        ],
      },
    ],
  },

  terms: {
    id: 'terms',
    title: 'Términos y Condiciones',
    updated: UPDATED_ES,
    effective: EFFECTIVE_ES,
    intro: [
      'Estos términos regulan el acceso y uso del sitio web de Atelier Predict. Al navegar por el sitio aceptas estas condiciones. Si no estás de acuerdo, te pedimos que no continúes usando el sitio.',
      'Atelier Predict es un proyecto presentado en el hackathon AWS Zero to Shipped 2026. Se ofrece en fase de demostración y prelanzamiento.',
    ],
    sections: [
      {
        heading: '1. Objeto del servicio',
        paragraphs: [
          'Atelier Predict es una herramienta de pronóstico de demanda y de asistencia agéntica. El servicio combina un modelo estadístico de pronóstico con un asistente de inteligencia artificial que responde preguntas y propone acciones sobre la operación comercial.',
          'El servicio se ofrece «tal cual» y «según disponibilidad», sin garantía de disponibilidad continua.',
        ],
      },
      {
        heading: '2. Uso aceptable',
        paragraphs: ['Te comprometes a no usar el sitio para:'],
        list: [
          'Cargar contenido ilegal, SMEs o que infrinja derechos de terceros.',
          'Intentar acceder sin autorización a cuentas, credenciales o sistemas.',
          'Realizar pruebas de carga, scraping masivo o ataques contra la disponibilidad del servicio.',
          'Enviar información falsa, engañosa o de terceros sin autorización.',
        ],
      },
      {
        heading: '3. Precios y planes de la versión comercial',
        paragraphs: [
          'La versión de demostración publicada con motivo del hackathon es gratuita y no requiere pago. Cualquier tarifa comercial se comunicará expresamente antes de la contratación y quedará sujeta a un contrato separado.',
          'Los importes de este sitio se expresan en dólares estadounidenses (USD). Las cifras de ahorro derivan del margen de contribución por unidad, que es un supuesto declarado y no una cotización: al digestible por el margen real del cliente.',
        ],
      },
      {
        heading: '4. Propiedad intelectual',
        paragraphs: [
          'La marca, el diseño, el código y los textos de este sitio pertenecen a ColombiaTIC Ingeniería SAS o a sus licenciantes. Te otorgamos una licencia limitada, no exclusiva e intransferible para usar el sitio para fines evaluativos o internos.',
          'Los datos que cargas en el servicio permanecen tuyos.',
        ],
      },
      {
        heading: '5. Contenido generado por inteligencia artificial',
        paragraphs: [
          'El asistente utiliza modelos de inteligencia artificial de Amazon Bedrock. Sus respuestas son orientativas y pueden contener errores. El pronóstico de demanda se calcula con un modelo estadístico y se valida con backtesting, pero no constituye una garantía de resultados futuros.',
          'Las acciones que el asistente propone deben ser validadas por una persona autorizada antes de ejecutarse.',
        ],
      },
      {
        heading: '6. Responsabilidad',
        paragraphs: [
          'En la medida permitida por la ley, no respondemos por daños indirectos, lucro cesante, pérdida de datos o interrupción del servicio. Nuestra responsabilidad total se limita al monto efectivamente pagado por el servicio en los doce (12) meses anteriores al hecho generador.',
          'Esta limitación no aplica en casos de dolo, culpa grave, o enthose situaciones en que la ley Colombian la limite.',
        ],
      },
      {
        heading: '7. Terminación',
        paragraphs: [
          'Puedes dejar de usar el sitio en cualquier momento. Podemos suspender el acceso si detectamos un uso que vulnere estos términos.',
        ],
      },
      {
        heading: '8. Ley aplicable y jurisdicción',
        paragraphs: [
          'Estos términos se rigen por la ley colombiana. Las partes se someten a la jurisdicción de los jueces y tribunales de Bogotá, D.C.',
        ],
      },
    ],
  },

  cookies: {
    id: 'cookies',
    title: 'Política de Cookies',
    updated: UPDATED_ES,
    effective: EFFECTIVE_ES,
    intro: [
      'Esta política explica qué tecnologías de seguimiento utiliza Atelier Predict y cómo puedes controlarlas. El sitio está diseñado para funcionar sin cookies de seguimiento.',
    ],
    sections: [
      {
        heading: '1. Qué utilizamos',
        paragraphs: ['En la versión actual del sitio utilizamos únicamente:'],
        list: [
          'Almacenamiento local (localStorage) para recordar tu preferencia sobre el consentimiento de cookies. Es estrictamente técnico y no permite identificarte fuera de tu navegador.',
          'Solicitudes al servicio de fuentes tipográficas en línea de Google Fonts, que puedeindirectamente revelar tu dirección IP al proveedor.',
          'Registro técnico del servidor (dirección IP de origen) con un fin de seguridad y prevención de abuso en los formularios.',
        ],
      },
      {
        heading: '2. Qué NO utilizamos',
        paragraphs: [
          'No utilizamos cookies publicitarias ni píxeles de redes sociales. No compartimos datos de comportamiento con terceros para fines de publicidad.',
          'Google Analytics 4 (GA4) puede activarse mediante la variable de entorno VITE_GA4_ID. Cuando está activo, carga el script de Google de forma diferida solo tras obtener tu consentimiento explícito y registra eventos de navegación, interacciones con el agente y uso del laboratorio de datos. GA4 establece sus propias cookies de primera parte (_ga, _ga_XXXXXXXX). Si no se ha configurado esa variable, no se carga ningún script de analítica.',
        ],
      },
      {
        heading: '3. Gestión del consentimiento',
        paragraphs: [
          'Al entrar por primera vez te mostramos un aviso con dos opciones: aceptar todas las cookies o mantener únicamente las esenciales. Tu elección se guarda en tu navegador y puede cambiarse en cualquier momento borrando el almacenamiento local del sitio.',
          'Rechazar las cookies esenciales no impide navegar el sitio ni utilizar el pronóstico.',
        ],
      },
      {
        heading: '4. Cómo eliminar información desde tu navegador',
        paragraphs: [
          'Puedes borrar las cookies y el almacenamiento local desde la configuración de tu navegador. Ten en cuenta que al hacerlo volverá a mostrarse el aviso de consentimiento.',
        ],
      },
      {
        heading: '5. Cambios',
        paragraphs: [
          'Si en el futuro incorporamos cookies analíticas o publicitarias, actualizaremos esta política y te pediremos un consentimiento previo y separado.',
        ],
      },
    ],
  },

  refunds: {
    id: 'refunds',
    title: 'Política de Reembolsos',
    updated: UPDATED_ES,
    effective: EFFECTIVE_ES,
    intro: [
      'La versión de demostración de Atelier Predict es gratuita y no genera cobros. Esta política aplica a contrataciones de planes comerciales o pilotos pagados.',
    ],
    sections: [
      {
        heading: '1. Versión de demostración',
        paragraphs: [
          'El acceso a la demostración es gratuito y no constituye una relación de consumo onerosa. No hay importes que reembolsar.',
        ],
      },
      {
        heading: '2. Suscripciones y pilotos pagados',
        paragraphs: [
          'Cuando se contrate un plan de pago, las condiciones de cancelación y reembolso se detallarán en el contrato o en las condiciones comerciales específicas que aceptes antes del pago.',
        ],
      },
      {
        heading: '3. Derecho de retraction',
        paragraphs: [
          'En ventas a distancia, puedes retractarte de la compra dentro de los cinco (5) días hábiles siguientes a la entrega o a la celebración del contrato, sin necesidad de justificación, conforme al artículo 2 del Decreto 1074 de 2015 y el Estatuto del Consumidor.',
          'En ese caso devolvemos el 100 % de lo pagado. Para ejercer este derecho escribe a dairagarzon@colombiatic.com.co indicando la fecha de compra y el medio de pago.',
        ],
      },
      {
        heading: '4. Reembolsos por UCLUESTRE servicio no prestado',
        paragraphs: [
          'Si no cobramos un servicio contratado o incurremos en un fallo material que lo impida, gestionaremos el reembolso o la sustitución correspondiente dentro de los treinta (30) días calendario siguientes a la notificación.',
        ],
      },
      {
        heading: '5. Plazos de devolución',
        paragraphs: [
          'Los reembolsos se realizan por el mismo medio de pago utilizado para la compra y se reflejan en un plazo máximo de treinta (30) días calendario, dependiendo de la institución financiera.',
        ],
      },
      {
        heading: '6. Casos excluidos',
        paragraphs: [
          'No dan lugar a reembolso los importes correspondientes a servicios efectivamente prestados, contratos celebrados con total aceptación de las condiciones, ni los derivados de cambios en las tarifas de AWS que estén fuera de nuestro control razonable.',
        ],
      },
    ],
  },

  'ai-policy': {
    id: 'ai-policy',
    title: 'Política de Uso de Inteligencia Artificial y Analítica de Datos',
    updated: UPDATED_ES,
    effective: EFFECTIVE_ES,
    intro: [
      'Atelier Predict utiliza modelos de inteligencia artificial (IA) y herramientas de analítica para ofrecer sus funcionalidades de pronóstico de demanda y asistencia agéntica. Esta política describe qué modelos utilizamos, cómo procesan tus datos, qué garantías ofrecemos y qué derechos te asisten.',
      'La IA en este servicio tiene un rol de asistencia y recomendación. Ninguna acción se ejecuta de forma automática sin validación humana, en cumplimiento del principio de supervisión humana en sistemas de IA.',
    ],
    sections: [
      {
        heading: '1. Modelos y proveedores de IA',
        paragraphs: [
          'Utilizamos los siguientes modelos y servicios de IA:',
        ],
        list: [
          'Amazon Bedrock (AWS, región us-east-1) — plataforma de modelos fundacionales gestionada. Actúa como procesador de datos bajo el DPA de AWS.',
          'Anthropic Claude Sonnet 4.5 (accedido a través de Amazon Bedrock) — modelo de lenguaje grande (LLM) utilizado para el asistente de chat agéntico.',
          'Amazon Titan Embeddings v2 (Amazon) — modelo de embeddings utilizado internamente para indexación semántica del catálogo de productos.',
          'Holt-Winters Additive (modelo estadístico propio) — algoritmo determinista de suavizado exponencial triple para el pronóstico de demanda. No usa aprendizaje automático y sus parámetros son reproducibles desde una semilla fija.',
        ],
      },
      {
        heading: '2. Qué datos procesa la IA',
        paragraphs: [
          'Los modelos de IA generativa (Claude Sonnet) reciben exclusivamente:',
        ],
        list: [
          'El contenido de tus mensajes en el chat del agente, junto con el contexto estadístico del pronóstico vigente.',
          'No reciben datos personales de tus clientes finales. Si incluyes datos personales en los mensajes del chat, te recomendamos no hacerlo, ya que no podemos garantizar que Bedrock los trate con las mismas garantías que los datos gestionados por nosotros directamente.',
          'Las series de demanda que subes al laboratorio de datos son vectores de números sin identificadores personales. El motor estadístico las procesa localmente en el servidor Lambda; el modelo de IA generativa no las recibe a menos que las pegues expresamente en el chat.',
        ],
      },
      {
        heading: '3. Retención de datos por parte de los modelos de IA',
        paragraphs: [
          'Amazon Bedrock no almacena los inputs ni los outputs de las inferencias una vez completada la solicitud, conforme a su política de privacidad y al DPA de AWS.',
          'Nosotros no registramos el contenido de las conversaciones del chat en ninguna base de datos propia. Sí registramos eventos analíticos anónimos (ver Política de Cookies) cuando el usuario ha dado su consentimiento.',
        ],
      },
      {
        heading: '4. Toma de decisiones automatizada',
        paragraphs: [
          'El sistema no toma decisiones con efectos jurídicos ni significativos de manera automatizada. El asistente propone acciones (activar campaña, ajustar punto de reposición) que requieren la confirmación explícita de un operador humano antes de ejecutarse.',
          'Los pronósticos son estimaciones estadísticas, no garantías. La responsabilidad de las decisiones operativas recae siempre en la persona que las adopta.',
        ],
      },
      {
        heading: '5. Analítica del comportamiento del usuario',
        paragraphs: [
          'Cuando el usuario acepta las cookies analíticas, registramos eventos de uso mediante Google Analytics 4 (GA4): páginas visitadas, idioma seleccionado, interacciones con el agente y evaluaciones del laboratorio de datos. Estos datos son pseudónimos y se procesan conforme a la Política de Cookies.',
          'Los datos analíticos no se usan para entrenar modelos de IA ni se ceden a terceros distintos de Google (bajo sus Condiciones de Tratamiento de Datos para GA4).',
        ],
      },
      {
        heading: '6. Sesgos y limitaciones',
        paragraphs: [
          'Los modelos de IA pueden producir respuestas incorrectas, incompletas o sesgadas. El pronóstico estadístico tiene un error medio (WAPE) del 7,77 % medido sobre una serie sintética: tu serie real puede comportarse de forma diferente.',
          'No recomendamos tomar decisiones de inventario de alto impacto basadas exclusivamente en las salidas del sistema sin validar con datos propios.',
        ],
      },
      {
        heading: '7. Derechos y contacto',
        paragraphs: [
          'Si tienes preguntas sobre cómo la IA procesa tus datos, escribe a dairagarzon@colombiatic.com.co. Para ejercer derechos relativos a datos personales, consulta la Política de Privacidad.',
        ],
      },
    ],
  },

  dpa: {
    id: 'dpa',
    title: 'Acuerdo de Tratamiento de Datos (DPA)',
    updated: UPDATED_ES,
    effective: EFFECTIVE_ES,
    intro: [
      'Este Acuerdo de Tratamiento de Datos ("DPA") regula el tratamiento de datos que ColombiaTIC Ingeniería SAS realiza como encargado del tratamiento en nombre del cliente ("Responsable") cuando este proporciona series de datos de demanda u otros datos empresariales a través del servicio Atelier Predict.',
      'Este DPA se incorpora por referencia a los Términos y Condiciones del servicio y prevalece en caso de conflicto en lo que concierne al tratamiento de datos personales.',
    ],
    sections: [
      {
        heading: '1. Partes y roles',
        paragraphs: [
          'ColombiaTIC Ingeniería SAS actúa como Encargado del Tratamiento respecto de los datos que el Cliente (Responsable) introduce en el servicio. El Cliente es responsable de garantizar que tiene una base legal adecuada para compartir dichos datos con ColombiaTIC.',
        ],
      },
      {
        heading: '2. Datos tratados',
        paragraphs: [
          'Los datos tratados bajo este DPA son, con carácter general, series temporales de cantidades (unidades vendidas, demanda histórica) sin identificadores personales directos. Si el Cliente incluye datos personales en las series o en los mensajes del chat, este DPA aplica también a esos datos.',
        ],
        list: [
          'Series de demanda: vectores de números con marcas temporales.',
          'Resultados de evaluación: métricas estadísticas derivadas de las series anteriores, almacenadas en MongoDB Atlas con un TTL de 90 días.',
          'Datos del formulario de contacto: nombre, correo, empresa y cargo (cubiertos también por la Política de Privacidad).',
        ],
      },
      {
        heading: '3. Finalidades del tratamiento',
        paragraphs: [
          'ColombiaTIC trata los datos exclusivamente para:',
        ],
        list: [
          'Generar pronósticos de demanda y métricas de error sobre las series del Cliente.',
          'Almacenar los resultados de evaluación para mostrarlos al Cliente durante el período de retención.',
          'Mejorar la calidad del servicio de forma agregada y anonimizada, nunca a nivel individual.',
        ],
      },
      {
        heading: '4. Subencargados',
        paragraphs: [
          'ColombiaTIC utiliza los siguientes subencargados para prestar el servicio:',
        ],
        list: [
          'Amazon Web Services (AWS), región us-east-1 — cómputo serverless (Lambda) y almacenamiento temporal.',
          'MongoDB Atlas (MongoDB Inc.) — almacenamiento persistente de resultados de evaluación, 90 días TTL.',
          'Amazon Bedrock (AWS) — inferencia de modelos de IA generativa para el chat agéntico.',
        ],
      },
      {
        heading: '5. Medidas de seguridad',
        paragraphs: [
          'ColombiaTIC aplica las siguientes medidas técnicas y organizativas:',
        ],
        list: [
          'Comunicaciones cifradas con TLS 1.2 o superior en todos los extremos.',
          'Secretos de acceso a servicios de terceros almacenados en AWS Secrets Manager, nunca en código ni en variables de entorno planas.',
          'Acceso a la infraestructura limitado por IAM con principio de mínimo privilegio.',
          'Logs de acceso a nivel de API Gateway para detección de anomalías.',
          'Eliminación automática de evaluaciones a los 90 días mediante TTL de MongoDB.',
        ],
      },
      {
        heading: '6. Notificación de brechas',
        paragraphs: [
          'En caso de una brecha de seguridad que afecte a datos del Cliente, ColombiaTIC notificará al Cliente dentro de las 72 horas siguientes al conocimiento de la brecha, con la información disponible en ese momento.',
        ],
      },
      {
        heading: '7. Derechos de auditoría',
        paragraphs: [
          'El Cliente puede solicitar información sobre las medidas de seguridad y los subencargados escribiendo a dairagarzon@colombiatic.com.co. ColombiaTIC responderá dentro de los treinta (30) días calendario siguientes.',
        ],
      },
      {
        heading: '8. Supresión de datos',
        paragraphs: [
          'A la finalización del contrato o a petición del Cliente, ColombiaTIC eliminará o anonimizará los datos del Cliente en un plazo máximo de treinta (30) días, salvo obligación legal de conservación.',
        ],
      },
      {
        heading: '9. Ley aplicable',
        paragraphs: [
          'Este DPA se rige por la Ley 1581 de 2012 y sus decretos reglamentarios, y por el Reglamento (UE) 2016/679 (RGPD) en lo que aplique a datos de titulares en la Unión Europea.',
        ],
      },
    ],
  },
}

export const LEGAL_DOCS_EN: Record<LegalDocId, LegalDoc> = {
  privacy: {
    id: 'privacy',
    title: 'Privacy Policy',
    updated: UPDATED_EN,
    effective: EFFECTIVE_EN,
    intro: [
      'ColombiaTIC Ingeniería SAS, identified by the tax ID stated on the corresponding invoice and domiciled in Colombia, is the data controller for the personal data collected through this website (hereinafter "Atelier Predict").',
      'This policy explains what data we collect, why, on what legal basis we process it, how long we keep it and how you can exercise your rights.',
    ],
    sections: [
      {
        heading: '1. Controller and contact',
        paragraphs: [
          'The data controller is ColombiaTIC Ingeniería SAS. For any question about this policy or to exercise your rights, write to dairagarzon@colombiatic.com.co. We reply within the statutory deadlines and in any case within ten (10) business days of receiving your request.',
        ],
      },
      {
        heading: '2. What data we collect',
        paragraphs: ['We only collect the data you voluntarily provide through the contact form:'],
        list: [
          'Full name.',
          'Email address.',
          'Company or organisation.',
          'Job title or role.',
          'Description of your challenge or need.',
          'Declared interest (government, business or investment).',
          'Interface language and basic connection data, such as the originating IP address, processed transiently to prevent abuse.',
        ],
      },
      {
        heading: '3. Why we use your data and on what basis',
        paragraphs: ['We process your data for the following purposes and legal bases:'],
        list: [
          'To answer your commercial or technical request. Basis: your unambiguous consent when submitting the form, and our legitimate interest in answering enquiries addressed to the company.',
          'To keep a record of commercial communications. Basis: your consent and compliance with statutory retention obligations.',
          'To send you product updates. Basis: your consent, which you may withdraw at any time.',
        ],
      },
      {
        heading: '4. Processors and third parties',
        paragraphs: [
          'We do not sell, rent or transfer your personal data. We may rely on the following processors, acting on our behalf and only for that purpose:',
        ],
        list: [
          'Amazon Web Services (AWS) — hosting and cloud infrastructure, region us-east-1.',
          'Amazon Bedrock (an AWS service) — generative AI model processing (Anthropic Claude Sonnet 4.5). Chat messages are sent to Bedrock for inference and are not retained on our servers.',
          'MongoDB Atlas (MongoDB Inc.) — evaluation result storage with a 90-day TTL, on public cloud (region us-east-1).',
          'Resend — transactional email delivery.',
          'Google Fonts — online font service (may reveal IP address to provider).',
          'The Colombian Data Protection Authority register, where applicable by law.',
        ],
      },
      {
        heading: '5. How long we keep your data',
        paragraphs: [
          'We keep data for as long as a commercial relationship lasts or while you do not withdraw consent, and for any statutory retention periods. Once those expire we delete or irreversibly anonymise the data.',
        ],
      },
      {
        heading: '6. Your rights as data subject',
        paragraphs: [
          'As a data subject you have the right to know, update, rectify, delete (right of erasure), withdraw consent, request portability and file a complaint before the Colombian Data Protection Authority.',
          'To exercise these rights write to dairagarzon@colombiatic.com.co stating your name, the data concerned and the action requested. We reply within the statutory deadlines.',
        ],
      },
      {
        heading: '7. Information security',
        paragraphs: [
          'We apply reasonable technical and administrative safeguards to protect your data against unauthorised access, loss or alteration. The site is served entirely over HTTPS and third-party service secrets are stored encrypted in a secrets manager.',
          'No internet transmission is entirely secure, so we cannot guarantee absolute security.',
        ],
      },
      {
        heading: '8. Changes to this policy',
        paragraphs: [
          'We may update this policy to reflect legal or product changes. We will publish the current version on this page together with its update date.',
        ],
      },
    ],
  },

  terms: {
    id: 'terms',
    title: 'Terms and Conditions',
    updated: UPDATED_EN,
    effective: EFFECTIVE_EN,
    intro: [
      'These terms govern access to and use of the Atelier Predict website. By browsing the site you accept these conditions. If you disagree, please stop using the site.',
      'Atelier Predict is a project submitted to the AWS Zero to Shipped 2026 hackathon. It is offered as a demo and pre-release build.',
    ],
    sections: [
      {
        heading: '1. Service description',
        paragraphs: [
          'Atelier Predict is a demand forecasting and agentic assistance tool. The service combines a statistical forecasting model with an AI assistant that answers questions and proposes actions for your commercial operation.',
          'The service is provided "as is" and "as available", with no guarantee of continuous availability.',
        ],
      },
      {
        heading: '2. Acceptable use',
        paragraphs: ['You agree not to use the site to:'],
        list: [
          'Upload illegal, infringing or third-party-rights-violating content.',
          'Attempt unauthorised access to accounts, credentials or systems.',
          'Run load tests, bulk scraping, or attacks against service availability.',
          'Submit false, misleading or unauthorised third-party information.',
        ],
      },
      {
        heading: '3. Pricing',
        paragraphs: [
          'The demo version published for the hackathon is free and requires no payment. Any commercial pricing will be communicated expressly before contracting and will be subject to a separate agreement.',
          'All amounts on this site are expressed in United States dollars (USD). Savings figures are derived from a per-unit contribution margin, which is a stated assumption and not a quote: replace it with the customer’s actual margin to make the figures their own.',
        ],
      },
      {
        heading: '4. Intellectual property',
        paragraphs: [
          'The brand, design, code and copy on this site belong to ColombiaTIC Ingeniería SAS or its licensors. We grant you a limited, non-exclusive, non-transferable licence to use the site for evaluation or internal purposes.',
          'Data you upload to the service remains yours.',
        ],
      },
      {
        heading: '5. AI-generated content',
        paragraphs: [
          'The assistant uses AI models hosted on Amazon Bedrock. Its replies are indicative and may contain errors. The demand forecast is computed with a statistical model and validated by backtesting, but it does not guarantee future results.',
          'Actions proposed by the assistant must be validated by an authorised person before execution.',
        ],
      },
      {
        heading: '6. Liability',
        paragraphs: [
          'To the extent permitted by law, we are not liable for indirect damages, lost profit, data loss or service interruption. Our total liability is limited to the amount actually paid for the service in the twelve (12) months preceding the event giving rise to the claim.',
          'This limitation does not apply in cases of wilful misconduct, gross negligence, or where Colombian law limits it.',
        ],
      },
      {
        heading: '7. Termination',
        paragraphs: [
          'You may stop using the site at any time. We may suspend access if we detect use that breaches these terms.',
        ],
      },
      {
        heading: '8. Governing law and jurisdiction',
        paragraphs: [
          'These terms are governed by Colombian law. The parties submit to the jurisdiction of the courts of Bogotá, D.C.',
        ],
      },
    ],
  },

  cookies: {
    id: 'cookies',
    title: 'Cookie Policy',
    updated: UPDATED_EN,
    effective: EFFECTIVE_EN,
    intro: [
      'This policy explains which tracking technologies Atelier Predict uses and how you can control them. The site is designed to work without tracking cookies.',
    ],
    sections: [
      {
        heading: '1. What we use',
        paragraphs: ['The current version of the site uses only:'],
        list: [
          'Local storage (localStorage) to remember your cookie consent preference. It is strictly technical and cannot identify you outside your browser.',
          'Requests to the Google Fonts online font service, which may indirectly reveal your IP address to that provider.',
          'Server request logging (originating IP address) for security and abuse prevention on forms.',
        ],
      },
      {
        heading: '2. What we do not use',
        paragraphs: [
          'We do not use advertising cookies or social-media pixels. We do not share behavioural data with third parties for advertising purposes.',
          'Google Analytics 4 (GA4) may be activated via the VITE_GA4_ID environment variable. When active, it loads the Google script lazily, only after your explicit consent, and records navigation events, agent interactions and data-lab usage. GA4 sets its own first-party cookies (_ga, _ga_XXXXXXXX). If that variable is not configured, no analytics script is loaded.',
        ],
      },
      {
        heading: '3. Managing consent',
        paragraphs: [
          'On your first visit we show a notice with two options: accept all cookies, or keep essential ones only. Your choice is stored in your browser and can be changed at any time by clearing the site local storage.',
          'Rejecting non-essential cookies does not prevent browsing the site or using the forecast.',
        ],
      },
      {
        heading: '4. Clearing data from your browser',
        paragraphs: [
          'You can delete cookies and local storage from your browser settings. Note that doing so will make the consent notice appear again.',
        ],
      },
      {
        heading: '5. Changes',
        paragraphs: [
          'If we ever introduce analytics or advertising cookies we will update this policy and ask for separate, prior consent.',
        ],
      },
    ],
  },

  refunds: {
    id: 'refunds',
    title: 'Refund Policy',
    updated: UPDATED_EN,
    effective: EFFECTIVE_EN,
    intro: [
      'The Atelier Predict demo version is free and generates no charges. This policy applies to any commercial plan or paid pilot.',
    ],
    sections: [
      {
        heading: '1. Demo version',
        paragraphs: [
          'Access to the demo is free and does not create a paid consumer relationship, so there are no amounts to refund.',
        ],
      },
      {
        heading: '2. Subscriptions and paid pilots',
        paragraphs: [
          'When a paid plan is contracted, the cancellation and refund terms are set out in the agreement or in the specific commercial terms you accept before paying.',
        ],
      },
      {
        heading: '3. Right of withdrawal',
        paragraphs: [
          'For distance sales you may withdraw from the purchase within five (5) business days of delivery or of signing the agreement, without giving a reason, under article 2 of Decree 1074 of 2015 and the Colombian Consumer Statute.',
          'In that case we refund 100% of what was paid. To exercise this right write to dairagarzon@colombiatic.com.co stating the purchase date and payment method.',
        ],
      },
      {
        heading: '4. Refunds for undelivered service',
        paragraphs: [
          'If we charge for a contracted service we do not deliver, or a material failure prevents delivery, we will process the corresponding refund or replacement within thirty (30) calendar days of being notified.',
        ],
      },
      {
        heading: '5. Refund timelines',
        paragraphs: [
          'Refunds are issued to the original payment method and may take up to thirty (30) calendar days to appear, depending on your financial institution.',
        ],
      },
      {
        heading: '6. Excluded cases',
        paragraphs: [
          'Amounts corresponding to services actually performed, contracts accepted with full knowledge of the conditions, and amounts arising from changes in the AWS pricing policies that are outside our reasonable control are not refundable.',
        ],
      },
    ],
  },

  'ai-policy': {
    id: 'ai-policy',
    title: 'AI & Data Analytics Policy',
    updated: UPDATED_EN,
    effective: EFFECTIVE_EN,
    intro: [
      'Atelier Predict uses artificial intelligence (AI) models and analytics tools to deliver its demand-forecasting and agentic-assistance features. This policy describes which models we use, how they process your data, what guarantees we offer, and what rights you have.',
      'AI in this service plays an assistive and recommendation role. No action is executed automatically without human validation, in line with the human-oversight principle for AI systems.',
    ],
    sections: [
      {
        heading: '1. AI models and providers',
        paragraphs: [
          'We use the following AI models and services:',
        ],
        list: [
          'Amazon Bedrock (AWS, region us-east-1) — managed foundation model platform. Acts as a data processor under the AWS DPA.',
          'Anthropic Claude Sonnet 4.5 (accessed via Amazon Bedrock) — large language model (LLM) used for the agentic chat assistant.',
          'Amazon Titan Embeddings v2 (Amazon) — embeddings model used internally for semantic indexing of the product catalogue.',
          'Holt-Winters Additive (proprietary statistical model) — deterministic triple exponential smoothing algorithm for demand forecasting. Does not use machine learning and its parameters are reproducible from a fixed seed.',
        ],
      },
      {
        heading: '2. What data AI processes',
        paragraphs: [
          'Generative AI models (Claude Sonnet) receive exclusively:',
        ],
        list: [
          'The content of your messages in the agent chat, together with the statistical context of the current forecast.',
          'They do not receive personal data about your end customers. If you include personal data in chat messages, we advise against it, as we cannot guarantee Bedrock will treat it with the same safeguards we apply to data we manage directly.',
          'Demand series you upload to the data lab are vectors of numbers without personal identifiers. The statistical engine processes them locally in the Lambda server; the generative AI model does not receive them unless you explicitly paste them into the chat.',
        ],
      },
      {
        heading: '3. Data retention by AI models',
        paragraphs: [
          'Amazon Bedrock does not store inference inputs or outputs after the request completes, in accordance with its privacy policy and the AWS DPA.',
          'We do not log the content of chat conversations in any of our own databases. We do log anonymous analytics events (see Cookie Policy) when the user has given consent.',
        ],
      },
      {
        heading: '4. Automated decision-making',
        paragraphs: [
          'The system does not make decisions with legal or significant effects in an automated way. The assistant proposes actions (activate campaign, adjust reorder point) that require explicit confirmation from a human operator before executing.',
          'Forecasts are statistical estimates, not guarantees. The responsibility for operational decisions always rests with the person who makes them.',
        ],
      },
      {
        heading: '5. User behaviour analytics',
        paragraphs: [
          'When the user accepts analytics cookies, we record usage events via Google Analytics 4 (GA4): pages visited, language selected, agent interactions and data-lab evaluations. This data is pseudonymous and processed in accordance with the Cookie Policy.',
          'Analytics data is not used to train AI models and is not shared with third parties other than Google (under its Data Processing Terms for GA4).',
        ],
      },
      {
        heading: '6. Biases and limitations',
        paragraphs: [
          'AI models may produce incorrect, incomplete or biased responses. The statistical forecast has a mean error (WAPE) of 7.77% measured on a synthetic series: your real series may behave differently.',
          'We do not recommend making high-impact inventory decisions based solely on system outputs without validating against your own data.',
        ],
      },
      {
        heading: '7. Rights and contact',
        paragraphs: [
          'If you have questions about how AI processes your data, write to dairagarzon@colombiatic.com.co. To exercise rights relating to personal data, see the Privacy Policy.',
        ],
      },
    ],
  },

  dpa: {
    id: 'dpa',
    title: 'Data Processing Agreement (DPA)',
    updated: UPDATED_EN,
    effective: EFFECTIVE_EN,
    intro: [
      'This Data Processing Agreement ("DPA") governs the processing that ColombiaTIC Ingeniería SAS carries out as a data processor on behalf of the customer ("Controller") when the customer provides demand series or other business data through the Atelier Predict service.',
      'This DPA is incorporated by reference into the Terms and Conditions and prevails in the event of conflict as regards personal data processing.',
    ],
    sections: [
      {
        heading: '1. Parties and roles',
        paragraphs: [
          'ColombiaTIC Ingeniería SAS acts as Data Processor in respect of the data that the Customer (Controller) introduces into the service. The Customer is responsible for ensuring it has an adequate legal basis to share such data with ColombiaTIC.',
        ],
      },
      {
        heading: '2. Data processed',
        paragraphs: [
          'Data processed under this DPA consists generally of time series of quantities (units sold, historical demand) without direct personal identifiers. If the Customer includes personal data in series or chat messages, this DPA applies to that data as well.',
        ],
        list: [
          'Demand series: vectors of numbers with timestamps.',
          'Evaluation results: statistical metrics derived from the series above, stored in MongoDB Atlas with a 90-day TTL.',
          'Contact form data: name, email, company and role (also covered by the Privacy Policy).',
        ],
      },
      {
        heading: '3. Processing purposes',
        paragraphs: [
          'ColombiaTIC processes data solely to:',
        ],
        list: [
          'Generate demand forecasts and error metrics for the Customer\'s series.',
          'Store evaluation results to display to the Customer during the retention period.',
          'Improve service quality in an aggregated, anonymised way, never at the individual level.',
        ],
      },
      {
        heading: '4. Sub-processors',
        paragraphs: [
          'ColombiaTIC uses the following sub-processors to deliver the service:',
        ],
        list: [
          'Amazon Web Services (AWS), region us-east-1 — serverless compute (Lambda) and temporary storage.',
          'MongoDB Atlas (MongoDB Inc.) — persistent storage of evaluation results, 90-day TTL.',
          'Amazon Bedrock (AWS) — generative AI model inference for the agentic chat.',
        ],
      },
      {
        heading: '5. Security measures',
        paragraphs: [
          'ColombiaTIC applies the following technical and organisational measures:',
        ],
        list: [
          'TLS 1.2 or higher encrypted communications at all endpoints.',
          'Third-party service access secrets stored in AWS Secrets Manager, never in code or plain environment variables.',
          'Infrastructure access limited by IAM with least-privilege principle.',
          'API Gateway access logs for anomaly detection.',
          'Automatic deletion of evaluations after 90 days via MongoDB TTL.',
        ],
      },
      {
        heading: '6. Breach notification',
        paragraphs: [
          'In the event of a security breach affecting Customer data, ColombiaTIC will notify the Customer within 72 hours of becoming aware of the breach, with information available at that time.',
        ],
      },
      {
        heading: '7. Audit rights',
        paragraphs: [
          'The Customer may request information about security measures and sub-processors by writing to dairagarzon@colombiatic.com.co. ColombiaTIC will reply within thirty (30) calendar days.',
        ],
      },
      {
        heading: '8. Data deletion',
        paragraphs: [
          'On termination of the contract or at the Customer\'s request, ColombiaTIC will delete or anonymise the Customer\'s data within a maximum of thirty (30) days, unless a legal retention obligation applies.',
        ],
      },
      {
        heading: '9. Governing law',
        paragraphs: [
          'This DPA is governed by Colombian Law 1581 of 2012 and its implementing regulations, and by Regulation (EU) 2016/679 (GDPR) to the extent applicable to data subjects in the European Union.',
        ],
      },
    ],
  },
}

export const LEGAL_DOCS: Record<'es' | 'en', Record<LegalDocId, LegalDoc>> = {
  es: LEGAL_DOCS_ES,
  en: LEGAL_DOCS_EN,
}

