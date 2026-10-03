# Análisis del repositorio y plan maestro de optimización

**Fecha:** 3 de octubre de 2026 · **Base:** `5f79c32` · **Región:** `us-east-1`

Este documento parte de lo que **el repositorio contiene hoy**, verificado contra
el entorno desplegado. No parte de Supuestos.

---

## 1. Estado real del repositorio

| Capa | Implementación | AWS | Estado |
| --- | --- | --- | --- |
| Frontend | React 19 + Vite 8, SPA estática | Amplify Hosting | En producción |
| Router / i18n | react-router, `/es` + `/en`, `t()` propio | — | En producción |
| Pronóstico | Holt-Winters aditivo, Node puro | **Ninguna** | En producción |
| Agente | Claude Sonnet 4.5 + tool use | Bedrock Converse | En producción |
| Leads | Validación + Resend | Secrets Manager | En producción |
| API | 4 rutas (`GET /`, `/forecast`, `POST /chat`, `/lead`) | API Gateway HTTP | En producción |
| IaC | 1 plantilla, 3 roles IAM mínimo | CloudFormation | En producción |
| Tests | 39 unit + 29 contrato + 28 integración | — | Verde |

**Lo que NO existe** (verificado por búsqueda en los 63 archivos versionados):
TimeFM, ANE, App Runner desplegado, DynamoDB, Terraform, Dockerfile, NestJS.

---

## 2. Correcciones al plan propuesto

El plan pegado asume un stack que no es el nuestro. Tres correcciones:

| El plan asume | Realidad | Impacto |
| --- | --- | --- |
| Frontend **Next.js** con **NestJS** detrás | Vite SPA + Lambda en API Gateway | El servicio `timesfm.service.ts` con `@Injectable` no aplica tal cual |
| Frontend con **datos mock** | Consume la API real; hay badge que lo indica | No hay cambio de "mock a real" que hacer |
| Modelo activo **Haiku** | **Claude Sonnet 4.5** (`us.anthropic.claude-sonnet-4-5-20250929-v1:0`) | El cambio de modelo es un parámetro, no una migración |

### 2.1 Aclaración de capas — la confusión de fondo

El plan trata TimesFM y el modelo de Bedrock como si fueran la misma cosa. **Son
dos capas distintas:**

```
Capa 1 — PRONÓSTICO    Holt-Winters en Node puro     → TimesFM entraría AQUÍ
Capa 2 — AGENTE / LLM  Claude Sonnet 4.5 en Bedrock  → Haiku entraría AQUÍ
```

- Cambiar a **Haiku 4.5** afecta la capa 2. Es un parámetro de CloudFormation
  (`BedrockModelId`), reversible en un redeploy. Haiku 4.5 sí está disponible
  (`us.anthropic.claude-haiku-4-5-20251001-v1:0`, perfil ACTIVE).
- **TimesFM** reemplazaría la capa 1, que hoy **no usa Bedrock en absoluto**.

Recomendación sobre Haiku: **no cambiar todavía.** Sonnet 4.5 da mejores
decisiones de herramienta; Haiku es más barato pero en un agente que decide
campañas de venta, el costo por token se paga en errores de decisión. Se puede
usar Haiku para el endpoint público `/chat` y Sonnet para acciones de alto valor,
pero primero medimos.
> Nota: originalmente usabamos Sonnet 4.6 y pasamos a 4.5 porque 4.6 devolvio un
> error de entitlement de AWS Marketplace (3 de 3 intentos). Cualquier cambio de
> modelo debe probarse con una llamada real antes de cerrar el deploy.
> probarse con una llamada real antes de cerrar el deploy.

### 2.2 Licencia de TimesFM — el plan acertó

Verificado contra el README oficial de `google-research/timesfm`:

| Componente | Licencia |
| --- | --- |
| Código fuente | Apache-2.0 |
| Pesos **hasta 2.5** | Apache-2.0 → **comercial permitido en self-hosting** |
| Pesos **3.0** | `timesfm-non-commercial-license-v1.0` → **prohibido comercial en self-hosting** |
| TimesFM 3.0 vía BigQuery ML / Vertex Model Garden | Permitido comercialmente |

**Conclusión:** el Camino 1 del plan (usar 2.5) es correcto y legal. Pero ojo,
el propio README dice *"This open version is not an officially supported Google
product"* — eso hay que decirlo ante un juez.

### 2.3 El código de ejemplo del plan tiene bugs

El fragmento `tfm.forecast([...], freq="D")` es la API **2.0**. TimesFM 2.5
eliminó el parámetro `freq`. Además la configuración
`num_layers=20, model_dims=1280` corresponde al modelo de **500M parámetros (2.0)**,
no al de 200M de 2.5. El ejemplo no es consistente consigo mismo.

---

## 3. Decisión de arquitectura: Chronicle vs Challenger

### El problema de TimesFM en App Runner

- Es Python + PyTorch. Nuestro backend es Node 22 en Lambda.
- 200M parámetros ≈ 1,5 GB de RAM solo en el modelo.
- **Cold starts:** App Runner carga el modelo **por instancia**. En demo con
  traffic bajo, cada request tras un rato inactivo puede pagar la carga completa.
- No es producto de Google soportado oficialmente.

Para un hackathon, un endpoint que tarda 30 s en arrancar es un riesgo en vivo.

### La opción que no considera el plan

**Bedrock tiene modelos de series temporales (Chronos). No están habilitados en
esta cuenta** — verificado: 0 coincidencias de `chronos` entre los modelos
disponibles. Es el camino más nativo de AWS y el único que correría en Lambda sin
contenedor.

### Recomendación: modelo campeón y retador

```
                    ┌─────────────────────────────┐
   /forecast ──────►│  Campeón: Holt-Winters       │  ← hoy, gratis, 0 llamadas AWS
                    │  ( siempre disponible )      │
                    └──────────────┬──────────────┘
                                   │ mismo holdout de 14 días
                    ┌──────────────▼──────────────┐
                    │  Retador: TimesFM 2.5        │  ← opt-in, con feature flag
                    │  (App Runner, Python)        │
                    └─────────────────────────────┘
                                   │
                                   ▼
              ambos WAPE sobre los MISMOS datos → la métrica decide
```

**Por qué esto es mejor que migrar:** convierte "usamos un modelo de foundation"
en una afirmación falsable. Si TimesFM gana en **nuestro** holdout, lo activamos y
lo anunciamos con número. Si pierde, lo documentamos — y eso también suma: electividad
técnica demostrada.

Mientras tanto **nada se rompe**: el Campeón sigue en pie.

---

## 4. Optimizaciones del backend (medidas, notheory)

Encontré dos problemas reales midiendo el código desplegado.

### OPT-1 · La función de pronóstico descarga 2,4 MB para usar 18 KB

Elegí un único zip compartido por simplicidad. Consecuencia medida:

| | Peso |
| --- | --- |
| Lo que la función **usa** (engine + handler) | **18 KB** |
| Lo que **descarga** en cada cold start | **2,4 MB** |
| Desperdicio | **133×** |

`forecast/index.js` no requiere ningún SDK de AWS. `lead/index.js` solo necesita
Secrets Manager. Solo `agent` necesita Bedrock. Todo lo demás viaja en el paquete
de los demás.

**Fix:** un artefacto por función, con sus dependencias mínimas.
**Impacto:** cold start de la ruta caliente (se ejecuta en cada carga de página).
**Esfuerzo:** bajo — `deploy.ps1` genera tres zips.

### OPT-2 · Las dos funciones recalculan el mismo pronóstico en cada request

`backend/agent/index.js:96` y `backend/forecast/index.js:47` ambos ejecutan
`buildForecastReport(buildSyntheticHistory())`. Como la semilla es fija, **el
resultado es idéntico siempre**.

Memoizar a nivel de módulo:
- `forecast` → 1 cold start paga el cálculo, los siguientes requests son gratis
- `agent` → igual, y el system prompt se construye una vez por locale

**Impacto:** menos billed duration en las dos funciones más invocadas.
**Riesgo:** hay que invalidar si `horizon` o `unitMargin` cambian → cachear por
clave, no un único valor.

### OPT-3 · Concurrencia reservada

`/chat` es público. Hoy un bucle de requests puede generar una factura ilimitada.
`ReservedConcurrentExecutions: 5` en el agente corta eso con un error claro en vez
de un gasto descontrolado. Coste: 0.

### OPT-4 · Caché de la respuesta del pronóstico

`Cache-Control: public, max-age=300` ya está en la respuesta, pero **HTTP API no
cachea por sí solo**. Con la serie sintética el resultado es idéntico, así que
una caché de 5 minutos es gratis en coste y casi gratis en latencia. Cuando
lleguen datos reales, la clave de caché debe incluir el hash del histórico.

### OPT-5 · Reducir la carga útil

`/forecast` devuelve 90 puntos de histórico + 14 de pronóstico. El gráfico solo
muestra 21. Añadir `?window=21` (con default) reduce la respuesta sin tocar el
cliente.

---

## 5. Plan maestro

### Fase A — Optimizar lo que ya funciona (1 día, sin riesgo)

| # | Tarea | Esfuerzo | Verificación |
| --- | --- | --- | --- |
| A.1 | OPT-1: un artefacto por función | Bajo | Cold start de `forecast` baja; test de integración verde |
| A.2 | OPT-2: memoizar pronóstico determinista | Bajo | Segundo request en la misma instancia no recalcula |
| A.3 | OPT-3: concurrencia reservada | Bajo | overrun devuelve 429, no cobra |
| A.4 | OPT-4: caché de `/forecast` | Medio | Segundo request < 100 ms |
| A.5 | OPT-5: parámetro `window` | Bajo | Payload reducido, contrato verificado |

### Fase B — Retador TimesFM (3–5 días, opt-in)

| # | Tarea | Riesgo | Nota |
| --- | --- | --- | --- |
| B.1 | Fix local: `timesfm==2.0.2` en Python 3.12 | — | PyTorch 3.14 existe (2.14.1) pero verificar compatibility |
| B.2 | `forecast` comparativo sobre el mismo holdout | — | Un solo script, salida WAPE de ambos |
| B.3 | Si gana: microservicio FastAPI + Dockerfile | — | Endurecer el del plan: `--workers 1`, health check, model load en lifespan |
| B.4 | Desplegar en App Runner | — | Solo si B.2 dice que gana |
| B.5 | `GET /forecast?engine=timesfm` con feature flag | — | Campeón sigue por defecto |
| B.6 | Documentar el resultado, gane o pierda | — | Con el número, sea cual sea |

**Sobre B.6:** publicar "evaluamos TimesFM 2.5 y con **nuestro** holdout dio WAPE
X frente a 7.77% de Holt-Winters, así que seguimos con el campeón" es una
respuesta fuerte ante un juez técnico. Publicar solo "usamos foundation models"
es débil.

### Fase C — Capa del agente (1 día)

| # | Tarea | Nota |
| --- | --- | --- |
| C.1 | Streaming con `ConverseStream` | Hoy el usuario espera ~6 s en blanco |
| C.2 | Evaluar Haiku 4.5 para `/chat` | Solo con medición de coste y calidad |
| C.3 | Historial de conversación en reducer | Hoy se reconstruye desde el DOM |

---

## 6. Decisiones que necesito

| Decisión | Mi recomendación |
| --- | --- |
| Migrar a TimesFM o mantenerlo como retador? | **Champion-challenger.** Migrar a ciegas empeora la demo (cold starts) y la afirmacion. |
| ¿Optimizar antes de añadir TimesFM? | **Sí, Fase A primero.** Son 4 KB de código, 2,4 MB de ahorro y menos coste por request. |
| ¿Cambiar a Haiku ahora? | **No.** Se mide en Fase C.2 con Sonnet como referencia. |
| ¿App Runner para el retador? | **Sí**, por App Runner: es serverless, paga por segundo y escala a cero. Un EC2 siempre encendido costaría más para un demo. |

## 7. Orden recomendado

```
Fase A (optimizar, 1 día)
  └─► B.1 + B.2 (decidir con datos si TimesFM merece existir en el stack)
        └─► B.3-B.6 solo si la métrica dice que sí
              └─► Fase C (agente: streaming y coste)
```

**No añadir un modelo de foundation antes de haber medido contra el que ya
tenemos.** El riesgo no es técnico, es de narrativa: si el juez pregunta
"¿cuál de los dos acierta más?", la respuesta tiene que ser un número, no una
preferencia.
