# Plan Maestro Scrum — Atelier Predict × Ecommerce Integration

**Fecha:** 23 de octubre de 2026  
**Objetivo:** Conectar los tres motores de Atelier Predict (Holt-Winters, TimesFM, Claude Sonnet 4.6) con los datos reales de ventas e inventario del Atelier Commerce OS para que las recomendaciones del agente sean accionables y ejecutables.

---

## Arquitectura objetivo

```
Atelier Commerce OS (NestJS :3007 + Next.js :3100)
         │
         │  POST /api/sales/history/upload  (nuevo)
         │  GET  /api/sales/history         (nuevo)
         │  GET  /api/inventory/reorder-points  (nuevo)
         │  PUT  /api/inventory/reorder-points/:sku  (nuevo)
         │  POST /api/campaigns/activate    (nuevo, wired to sales-advisor :8080)
         │
         ▼
S3: atelier-predict-forecastbucket-520847769480
  └─ history.json        ← serie real de ventas (number[])
  └─ forecast.json       ← resultado TimesFM nightly

         │
         ├─────────────────────────────────────────────────────
         │                                                     │
         ▼                                                     ▼
Lambda: atelier-predict-forecast              Lambda: atelier-predict-agent
  (Holt-Winters campeón + TimesFM retador)      (Claude Sonnet 4.6 + Bedrock)
         │                                       │
         ▼                                       ▼
  GET /forecast (KPIs reales)            POST /chat (acción ejecutada realmente)
         │                                       │
         └─────────────┬─────────────────────────┘
                       ▼
              demo.colombiatic.com.co
              (Dashboard con datos reales)
```

---

## Estado actual vs objetivo

| Componente | Hoy (sintético) | Objetivo (real) |
|---|---|---|
| Historia de ventas | 90 días generados con semilla fija | Ventas diarias reales del Atelier por SKU/categoría |
| Forecast | Holt-Winters sobre datos sintéticos | TimesFM + Holt-Winters sobre ventas reales |
| `activate_campaign` | Devuelve `{status:'ok'}` simulado | Llama al sales-advisor (:8080) con audiencia real |
| `adjust_reorder_point` | Devuelve `{status:'ok'}` simulado | Persiste en BD, notifica al dashboard de inventario |
| Audiencia de campaña | Claude la inventa | Conteo real de segmentos del sales-advisor |
| Margen de contribución | `$4.60` hardcodeado | Parámetro configurable por SKU o categoría |
| Forecast granularidad | Total unidades/día (1 serie) | Por SKU o por categoría (configurable) |

---

## Epics

| Epic | Descripción |
|---|---|
| **E1** | Ingesta de datos reales — alimentar S3 con ventas históricas del Atelier |
| **E2** | Dashboard de inventario — mostrar el estado de stock en el frontend del Predict |
| **E3** | Herramientas ejecutables — hacer que `activate_campaign` y `adjust_reorder_point` actúen de verdad |
| **E4** | Forecast multi-SKU — pasar de 1 serie a N series (por producto o categoría) |
| **E5** | Autenticación y multi-tenant — que cada tenant del Atelier vea solo sus datos |

---

## Sprint 0 — Fundamentos (1 semana)

**Meta:** Infraestructura de datos lista; la serie de ventas reales llega a S3 aunque sea vacía.

### Historias

#### S0-1 — Endpoint de historia de ventas en el BFF (3 puntos)
**Como** sistema Predict  
**Quiero** poder pedir `GET /api/sales/history?days=90` al ecommerce  
**Para** recibir un `number[]` de unidades vendidas por día, más recientes al final

**Criterios de aceptación:**
- Agrega `order_items.quantity` por `orders.createdAt::date`, rellena con 0 los días sin ventas
- Devuelve `{ history: number[], from: ISO, to: ISO, currency: "USD", unit: "units" }`
- Autenticado con `INTERNAL_API_KEY` (cabecera `X-Internal-Key`)
- Mínimo 28 días de datos para que Holt-Winters arranque

**Archivos a tocar:**
- `ecommerce/src/app/api/sales/history/route.ts` (nuevo)
- `backend/src/modules/orders/orders.service.ts` (método de agregación)

---

#### S0-2 — Endpoint de upload a S3 desde ecommerce (2 puntos)
**Como** proceso ETL del ecommerce  
**Quiero** poder hacer `PUT /api/sales/history/upload`  
**Para** escribir la serie en `s3://atelier-predict-forecastbucket-520847769480/history.json`

**Criterios de aceptación:**
- Llama a `GET /api/sales/history` internamente y sube el resultado a S3
- Política S3 configurada para que el rol de la Lambda del ecommerce tenga `s3:PutObject` solo en `history.json`
- Responde `{ uploaded: true, points: N, bucket: "..." }`
- Solo accesible con `INTERNAL_API_KEY`

**Archivos a tocar:**
- `ecommerce/src/app/api/sales/history/upload/route.ts` (nuevo)
- `infra-aws/atelier/iam/` — policy para PutObject en bucket predict

---

#### S0-3 — Cron nightly de ETL en ecommerce (1 punto)
**Como** arquitectura de datos  
**Quiero** que el ecommerce suba la historia automáticamente a las 04:00 UTC  
**Para** que el batch de TimesFM a las 04:30 siempre tenga data fresca

**Criterios de aceptación:**
- Vercel/Next.js cron job (`/api/cron/sales-etl`) o EventBridge rule que llama al endpoint S0-2
- Logs en CloudWatch con timestamp y `points` subidos
- Si hay menos de 28 días de datos reales → usa los sintéticos como fallback (no rompe el forecast)

**Archivos a tocar:**
- `ecommerce/src/app/api/cron/sales-etl/route.ts` (nuevo)
- `.env` del ecommerce: `PREDICT_BUCKET=atelier-predict-forecastbucket-520847769480`

---

#### S0-4 — Test de integración S0 (1 punto)
- Verificar que `GET /forecast` devuelve `dataSource: "provided"` cuando `history.json` existe en S3
- Test en el repo predict: `scripts/verify-integration.mjs` ya tiene la infraestructura

**Velocidad estimada S0: 7 puntos**

---

## Sprint 1 — Herramientas ejecutables (2 semanas)

**Meta:** `activate_campaign` envía una campaña real; `adjust_reorder_point` persiste en BD.

### Historias

#### S1-1 — Endpoint de segmentos de audiencia (3 puntos)
**Como** agente Claude  
**Quiero** poder consultar cuántos clientes hay por canal  
**Para** no inventar el `audienceSize` y citar un número real

**Criterios de aceptación:**
- `GET /api/customers/segments/count` → `{ whatsapp: N, email: N, sms: N }`
- Cuenta usuarios con `notification_prefs.whatsapp === true` etc.
- Cacheado 5 minutos (mismo patrón que TtlCache del predict)
- La Lambda `atelier-predict-agent` llama este endpoint ANTES de generar la respuesta y lo inyecta en el system prompt: `"audienciaDisponible": { whatsapp: 3412, email: 5621, sms: 1204 }`

**Archivos a tocar:**
- `ecommerce/src/app/api/customers/segments/count/route.ts` (nuevo)
- `backend/agent/index.js` — enriquecer system prompt con audiencia real

---

#### S1-2 — Activar campaña real via sales-advisor (5 puntos)
**Como** operador  
**Quiero** que cuando Claude proponga activar una campaña y yo confirme  
**Para** que el mensaje llegue realmente a los clientes vía WhatsApp/email

**Criterios de aceptación:**
- `POST /api/campaigns/activate` en el ecommerce BFF
- Body: `{ channel: "whatsapp"|"email"|"sms", targetDay: string, audienceSize: int, message?: string }`
- Internamente llama `POST http://127.0.0.1:8080/api/v1/campaign/trigger` (sales-advisor)
- Responde `{ campaignId: UUID, sentTo: N, channel, scheduledFor: ISO }`
- La Lambda `atelier-predict-agent`: al recibir `tool_use activate_campaign`, llama este endpoint real en lugar de retornar `{status:'ok'}`
- Si el endpoint falla → la herramienta devuelve `{status:'error', reason}` y Claude informa al usuario

**Archivos a tocar:**
- `ecommerce/src/app/api/campaigns/activate/route.ts` (nuevo)
- `backend/agent/index.js` — `executeTool()` llama endpoint real
- `backend/agent/index.js` — env var `ECOMMERCE_API_URL` + `INTERNAL_API_KEY`
- Lambda env: `ECOMMERCE_API_URL=https://atelier.colombiatic.com.co`

---

#### S1-3 — Punto de reposición real (3 puntos)
**Como** operador de inventario  
**Quiero** que cuando Claude proponga ajustar el reorder point de un SKU y yo confirme  
**Para** que ese threshold quede guardado y visible en el dashboard de inventario

**Criterios de aceptación:**
- `GET /api/inventory/reorder-points` → `[{ sku, currentStock, reorderPoint, suggestedByAi: null|int }]`
- `PUT /api/inventory/reorder-points/:sku` body: `{ newUnits: int, source: "ai"|"manual" }`
- Claude recibe el `currentStock` del SKU en el tool response (antes de la segunda llamada a Bedrock)
- La respuesta de Claude incluye: `"El stock actual es 47 unidades. El nuevo punto de reposición de 85 queda guardado."`

**Archivos a tocar:**
- `ecommerce/src/app/api/inventory/reorder-points/route.ts` (nuevo)
- `backend/src/modules/catalog/catalog.service.ts` — campo `reorderPoint` en BD
- `backend/agent/index.js` — `executeTool()` para `adjust_reorder_point`

---

#### S1-4 — Tests de herramientas ejecutables (2 puntos)
- Unit tests para los dos `executeTool()` actualizados
- Integration test: `POST /chat` con "activa campaña WhatsApp para el sábado" → `campaignId` real en la respuesta

**Velocidad estimada S1: 13 puntos**

---

## Sprint 2 — Dashboard de inventario en el Predict (2 semanas)

**Meta:** El frontend `demo.colombiatic.com.co` muestra datos reales de stock y el forecast está etiquetado con los SKUs más importantes.

### Historias

#### S2-1 — Panel de inventario en DataLab (3 puntos)
**Como** operador  
**Quiero** ver en el Predict dashboard el stock actual de los N productos de mayor rotación  
**Para** relacionar el forecast con el inventario disponible sin cambiar de pantalla

**Criterios de aceptación:**
- Nuevo componente `InventoryPanel.tsx` debajo de `DataLab`
- Llama `GET /api/catalog/stats` + `GET /api/inventory/reorder-points`
- Muestra: producto, stock actual, reorder point, estado (OK / BAJO / CRITICO)
- CRITICO = stock < reorder point; BAJO = stock < 2× reorder point
- Solo visible cuando `isApiConfigured === true` (guard ya existe)

---

#### S2-2 — Selector de granularidad en el forecast (3 puntos)
**Como** usuario  
**Quiero** poder elegir si ver el forecast del total, de una categoría o de un SKU específico  
**Para** comparar el comportamiento de diferentes líneas de producto

**Criterios de aceptación:**
- Dropdown en el header de la sección de forecast: `[Total, Ropa Mujer, Ropa Hombre, <SKU manual>]`
- Al cambiar, llama `GET /forecast?sku=XXXX` o `GET /forecast?category=women`
- El backend acepta el parámetro y llama `GET /api/sales/history?sku=XXXX&days=90` al ecommerce
- Si el SKU no tiene suficiente historia → fallback sintético con un badge "datos insuficientes"

**Archivos a tocar:**
- `backend/forecast/index.js` — parámetros `sku`, `category`
- `ecommerce/src/app/api/sales/history/route.ts` — filtros por SKU/categoría
- `src/components/ForecastChart.tsx` — selector de granularidad

---

#### S2-3 — Margen de contribución configurable (2 puntos)
**Como** usuario  
**Quiero** poder ingresar mi margen real por unidad (no el $4.60 hardcodeado)  
**Para** que el ahorro calculado sea relevante para mi operación

**Criterios de aceptación:**
- Input numérico en `KpiCards` con label "Margen por unidad (USD)"
- Valor default = `unitMarginUsd` del forecast response
- Al cambiar, recalcula KPIs localmente (no re-llama la API): `savings = (baselineMae - modelMae) × 30 × margin`
- El valor se pasa a `POST /chat` para que Claude cite el margen real en sus recomendaciones

---

#### S2-4 — Notificaciones del agente al dashboard de inventario (3 puntos)
**Como** sistema  
**Quiero** que cuando el agente ajuste un reorder point en S1-3  
**Para** que aparezca una notificación en el panel de `atelier.colombiatic.com.co`

**Criterios de aceptación:**
- `PUT /api/inventory/reorder-points/:sku` emite un evento SSE a `/api/notifications/stream`
- El dashboard del Atelier tiene un bell icon con badge cuando hay cambios del agente
- Notificación: `"Atelier Predict sugirió cambiar el reorder de SKU-001 a 85 unidades (era 50)"`

**Velocidad estimada S2: 11 puntos**

---

## Sprint 3 — Autenticación y multi-tenant (2 semanas)

**Meta:** Cada cliente del Atelier tiene su propio forecast, sin compartir datos.

### Historias

#### S3-1 — Autenticación en `/chat` y `/evaluate` (5 puntos)
**Como** arquitectura  
**Quiero** que los endpoints `/chat`, `/lead` y `/evaluate` requieran un JWT válido  
**Para** poder cobrar por uso y asociar evaluaciones a un tenant

**Criterios de aceptación:**
- Middleware en API Gateway o Lambda: verifica `Authorization: Bearer <jwt>` firmado con `JWT_SECRET` compartido con realculture
- JWT contiene `{ sub: userId, tenantId, plan: "essential"|"growth"|"pro" }`
- Si `plan === "essential"` → máx 50 llamadas/mes a `/chat`; si se supera → 429 con mensaje claro
- El `/forecast` sigue siendo público (es el hook de adquisición)

**Archivos a tocar:**
- `backend/shared/auth.js` (nuevo) — verificación JWT
- `backend/agent/index.js`, `backend/evaluate/index.js` — aplicar middleware
- `ecommerce/src/app/api/predict/token/route.ts` (nuevo) — genera token corto (30 min) para el frontend del Predict

---

#### S3-2 — Datos por tenant en S3 (3 puntos)
**Como** arquitectura multi-tenant  
**Quiero** que cada tenant tenga su propio `history.json` y `forecast.json`  
**Para** que los datos de un cliente no afecten el forecast de otro

**Criterios de aceptación:**
- S3 keys: `tenants/{tenantId}/history.json` y `tenants/{tenantId}/forecast.json`
- La Lambda forecast y batch usan `tenantId` del JWT para construir el path
- El cron de ETL (S0-3) sube a `tenants/{tenantId}/history.json`
- `/forecast` sin JWT → path default `history.json` (el sintético del demo público)

---

#### S3-3 — Rate limiting y billing events (3 puntos)
**Como** negocio  
**Quiero** registrar cada llamada a `/chat` por tenant  
**Para** poder cobrar según el plan y mostrar el uso en el dashboard del Atelier

**Criterios de aceptación:**
- Lambda `atelier-predict-agent`: al completar cada turn, escribe un registro en MongoDB `atelier_predict.usage_events`
  `{ tenantId, userId, at, inputTokens, outputTokens, model, tool_used?: string }`
- `GET /evaluate/history` retorna `usage: { chatsThisMonth, limit, remaining }` cuando hay JWT
- Dashboard del Atelier: card "Uso de Predict este mes" con barra de progreso

**Velocidad estimada S3: 11 puntos**

---

## Sprint 4 — Streaming y UX de producción (1 semana)

**Meta:** El chat responde token a token, sin el "loading..." de 5-10 segundos.

### Historias

#### S4-1 — ConverseStream en el agente (5 puntos)
**Como** usuario  
**Quiero** que el chat muestre las palabras llegando en tiempo real  
**Para** que la experiencia no parezca bloqueada durante 8 segundos

**Criterios de aceptación:**
- Lambda `atelier-predict-agent` usa `ConverseStreamCommand` en lugar de `ConverseCommand`
- API Gateway HTTP API con `Content-Type: text/event-stream`
- Frontend: `EventSource` o `fetch` con `ReadableStream`, agrega tokens al estado del chat
- Si el turn incluye tool use → buffer completo hasta el tool result, luego stream del final

**Nota técnica:** Lambda tiene timeout máximo de 15 min, pero el streaming de API Gateway HTTP tiene un límite de 29 s de idle. El agente debe responder parcialmente antes de ese límite.

---

#### S4-2 — UI de acción con confirmación explícita (3 puntos)
**Como** operador  
**Quiero** que cuando Claude proponga activar una campaña  
**Para** que yo tenga que confirmar antes de que se ejecute (no automático)

**Criterios de aceptación:**
- `AgentChat.tsx`: cuando el response contiene `actions[]`, muestra cards de confirmación
- Card muestra: canal, día target, audiencia real (del S1-1), revenue estimado
- Dos botones: **Ejecutar** / **Cancelar**
- Si Ejecutar → `POST /chat` con `{ confirmActions: [actionId] }` → backend llama al endpoint real
- Si Cancelar → responde al modelo `"El usuario canceló la acción"`

**Velocidad estimada S4: 8 puntos**

---

## Resumen de sprints

| Sprint | Meta | Velocidad | Duración |
|---|---|---|---|
| **S0** | Pipeline de datos reales a S3 | 7 pts | 1 semana |
| **S1** | Herramientas ejecutables (campaña + inventario) | 13 pts | 2 semanas |
| **S2** | Dashboard de inventario + forecast multi-SKU | 11 pts | 2 semanas |
| **S3** | Auth JWT + multi-tenant + billing | 11 pts | 2 semanas |
| **S4** | Streaming + UX de confirmación | 8 pts | 1 semana |
| **TOTAL** | Sistema completo integrado | **50 pts** | **~8 semanas** |

---

## Dependencias críticas (no se puede hacer hasta que...)

```
S0-1 (historia de ventas)
  └─► S0-2 (upload a S3)
        └─► S0-3 (cron ETL)
              └─► S1-1 (audiencia real)
                    └─► S1-2 (activate_campaign real)
              └─► S2-2 (forecast multi-SKU)

S0-2 (upload S3)
  └─► S2-2 (forecast granular)

S1-3 (reorder real)
  └─► S2-4 (notificaciones dashboard)

S1-2 + S1-3 (herramientas reales)
  └─► S3-1 (JWT — para cobrar por uso)
        └─► S3-2 (datos por tenant)
              └─► S3-3 (billing events)

S3-1 (JWT)
  └─► S4-2 (confirmación explícita — necesita userId para registrar)
```

---

## Stack técnico de la integración

| Capa | Tecnología | Ya existe |
|---|---|---|
| Agregación de ventas | NestJS service + TypeORM query | ✅ (NestJS en :3007) |
| Upload a S3 | AWS SDK v3 S3Client en Next.js API route | ✅ (patrón en aws_vault.py de govdocs) |
| Ejecución de campaña | HTTP interno a sales-advisor :8080 | ✅ (sales-advisor corre en la VM) |
| Auth JWT | jose / jsonwebtoken, misma clave que realculture | ✅ (JWT_SECRET compartido) |
| Streaming | Lambda ConverseStream → API GW HTTP streaming | ✅ (API GW ya es HTTP API) |
| Storage de eventos de uso | MongoDB Atlas, colección `usage_events` | ✅ (Atlas configurado) |
| Notificaciones dashboard | SSE desde Next.js API route | ✅ (patrón ya existe en GovDocs) |
| Multi-tenant S3 | S3 key prefix `tenants/{id}/` | ✅ (bucket ya existe) |

---

## Métrica de éxito del plan

Al completar los 5 sprints, el flujo completo será:

1. Un vendedor del Atelier tiene 847 transacciones en RDS los últimos 90 días
2. A las 04:00 UTC el cron sube `history.json` con 90 números reales a S3
3. A las 04:30 UTC TimesFM procesa la serie y publica `forecast.json` en S3
4. El vendedor abre `demo.colombiatic.com.co`, ve el forecast de sus ventas reales con WAPE 5.61%
5. Le pregunta al agente: "¿Debo activar una campaña para el pico del sábado?"
6. Claude responde: "Sí. El sábado proyecta 312 unidades (+23% vs semana anterior). Tienes 4,218 contactos WhatsApp disponibles. Estimo $1,437 de ingreso incremental."
7. El vendedor presiona **Ejecutar** — la campaña llega a 4,218 WhatsApps reales
8. El lunes, el vendedor ve en el dashboard que vendió 298 unidades (+19% vs baseline)
