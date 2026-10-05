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

const UPDATED_ES = '1 de octubre de 2026'
const UPDATED_EN = 'October 1, 2026'
const EFFECTIVE_ES = '1 de octubre de 2026'
const EFFECTIVE_EN = 'October 1, 2026'

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
          'El responsable del tratamiento es ColombiaTIC Ingeniería SAS. Para cualquier consulta sobre esta política o sobre el ejercicio de derechos puedes escribir a enterprise@colombiatic.com.co. Responderemos dentro de los plazos legales vigentes, y en todo caso dentro de los diez (10) días hábiles siguientes a la recepción de la solicitud.',
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
          'Amazon Web Services (AWS) — alojamiento e infraestructura en la nube.',
          'Resend — envío de correos electrónicos transaccionales.',
          'Proveedores de fuentes tipográficas en línea (Google Fonts) — para mostrar la tipografía del sitio.',
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
          'Para ejercerlos, escribe a enterprise@colombiatic.com.co indicando tu nombre, la identidad del dato y la actuación que solicitas. Respondemos dentro de los plazos legales vigentes.',
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
          'Los importes se expresan en dólares estadounidenses (USD) cuando así se indique. Cuando se muestre un equivalente en pesos colombianos (COP), se aplicará una tasa de referencia de 4.000 COP por USD, que es un supuesto declarado y no una cotización en tiempo real.',
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
          'No utilizamos cookies publicitarias, cookies de seguimiento entre sitios, píxeles de redes sociales ni perfiles de comportamiento. No integramos herramientas de analítica de terceros.',
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
      'La versión de Atelier Predict publicada con motivo del hackathon AWS Zero to Shipped 2026 es una demostración gratuita y no genera cobros. Esta política aplica a eventuales contrataciones de planes comerciales o pilotos pagados.',
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
          'En ese caso devolvemos el 100 % de lo pagado. Para ejercer este derecho escribe a enterprise@colombiatic.com.co indicando la fecha de compra y el medio de pago.',
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
          'The data controller is ColombiaTIC Ingeniería SAS. For any question about this policy or to exercise your rights, write to enterprise@colombiatic.com.co. We reply within the statutory deadlines and in any case within ten (10) business days of receiving your request.',
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
          'Amazon Web Services (AWS) — hosting and cloud infrastructure.',
          'Resend — transactional email delivery.',
          'Online font providers (Google Fonts) — to render the site typography.',
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
          'To exercise these rights write to enterprise@colombiatic.com.co stating your name, the data concerned and the action requested. We reply within the statutory deadlines.',
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
          'Amounts are expressed in United States dollars (USD) where stated. Where a Colombian peso (COP) equivalent is shown, a reference rate of 4,000 COP per USD is applied; that rate is a stated assumption, not a live quote.',
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
          'We do not use advertising cookies, cross-site tracking cookies, social pixels or behavioural profiling. We do not integrate third-party analytics tools.',
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
      'The version of Atelier Predict published for the AWS Zero to Shipped 2026 hackathon is a free demo and generates no charges. This policy applies to any commercial plan or paid pilot.',
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
          'In that case we refund 100% of what was paid. To exercise this right write to enterprise@colombiatic.com.co stating the purchase date and payment method.',
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
}

export const LEGAL_DOCS: Record<'es' | 'en', Record<LegalDocId, LegalDoc>> = {
  es: LEGAL_DOCS_ES,
  en: LEGAL_DOCS_EN,
}

