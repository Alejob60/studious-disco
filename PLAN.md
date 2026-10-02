# Atelier Predict — Plan de trabajo

**Objetivo del sprint:** convertir el MVP del hackathon en un producto que un
cliente pueda evaluar sin ayuda externa, con datos trazables, tracking verificable
y una postura de seguridad que no dependa de que nadie pregunte.

**Estado al inicio del sprint (verificado, no supuesto):**

| Área | Estado | Evidencia |
| ---- | ------ | --------- |
| Integración frontend ↔ backend | 26/26 checks verdes | `npm run verify:integration` |
| Contrato API ↔ UI | 29/29 checks verdes | `npm run verify:api` |
| Tests unitarios backend | 31/31 verdes | `npm run test:backend` |
| TypeScript | limpio | `npm run typecheck` |
| Build producción | limpio, 142 kB gzip inicial | `npm run build` |
| Bundle de Recharts | lazy, 105 kB gzip aparte | `ForecastChart-*.js` |
| Accesibilidad | `prefers-reduced-motion` respetado, skip link, aria en formulario | — |

---

## Sprint 1 — Cimientos de medición y confianza (1 día)

Objetivo: que cualquier persona pueda verificar por sí misma qué está pasando.

### TASK-1.1 · Activar Google Analytics 4
**Tamaño:** S · **Depende de:** que compartas el Measurement ID

- Crear la propiedad GA4 para el dominio de Amplify.
- Añadir `VITE_GA4_ID=G-…` a `.env.production`.
- Redesplegar y confirmar en DebugView que llegan `page_view`.
- **Feedback esperado:** en GA4 → Informes → Tiempo real aparece tráfico de la
  URL de Amplify en menos de 5 minutos.
- **Prueba de aceptación:** navegar `/es` → `/en` → `/en/privacy` produce tres
  `page_view` con `page_language` correcto y `page_path` distinto cada vez.

> **Bloqueante:** sin el Measurement ID, `analyticsEnabled` es `false` y todo el
> módulo es no-op por diseño. Al activar el ID **hay que actualizar también
> `src/content/legal.ts`**, porque la política de cookies afirma hoy que no usamos
> analítica. Publicar tracking sin actualizar la política sería un inconsistency
> legal real.

### TASK-1.2 · Rewrites SPA en Amplify
**Tamaño:** XS · **Bloqueante para deep links**

- Consola Amplify → Hosting → Rewrites and redirects → pegar
  `infra/amplify-rewrites.json`.
- **Feedback esperado:** `/es`, `/en`, `/en/terms` devuelven 200 al refrescar.
- **Prueba de aceptación:** `curl -I` de las 11 rutas de `sitemap.xml` devuelve
  200. Hoy devuelven 404.

### TASK-1.3 · Google Search Console
**Tamaño:** S · **Depende de:** acceso al dominio

- Verificar la propiedad por archivo HTML (la más simple si no hay dominio propio).
- Enviar `sitemap.xml` y usar la API de indexación para `/es` y `/en`.
- **Feedback esperado:** cobertura de páginas pasa de 0 a indexadas.
- **Prueba de aceptación:** Search Console muestra todas las rutas sin «error de
  rastreo».

### TASK-1.4 · `llms.txt` publicado
**Tamaño:** XS · **Hecho, falta verificar en producción**

- El archivo ya existe en `public/llms.txt`.
- **Prueba de aceptación:** `curl https://<host>/llms.txt` devuelve 200 con el
  mapa de rutas y las cifras técnicas verificables.

---

## Sprint 2 — Cobertura de pruebas de servicios (1–2 días)

Objetivo: que un cambio en el agente o en el formulario no pueda romper en
silencio. Hoy 31 tests cubren la lógica pura; falta la capa HTTP.

### TASK-2.1 · Tests del handler `/lead`
**Tamaño:** M

Mockear `fetch` global y `SecretsManager`, invocar `handler()` con eventos
sintéticos y afirmar el contrato HTTP completo.

| Caso | Aserción |
| ---- | -------- |
| Honeypot lleno | 201, `emailed: false`, cero llamadas a Resend |
| Payload inválido | 400 `invalid_fields`, lista de errores |
| Body no-JSON | 400 `invalid_payload` |
| Rate limit (6.º envío) | 429 `rate_limited` |
| Resend 500 | 502 `delivery_failed` |
| Éxito | 201, dos correos enviados en paralelo |
| Escaping | `<script>` en `challenge` no aparece crudo en el HTML |
| Secret ausente | 502 sin lanzar excepción |

- **Feedback esperado:** cobertura de líneas de `lead/index.js` > 85 %.
- **Prueba de aceptación:** los 8 casos pasan y un fallo deliberado en el
  inyectado rompe la suite.

### TASK-2.2 · Tests del handler `/chat`
**Tamaño:** M

Mockear `BedrockRuntimeClient` y verificar el ciclo de tool use completo.

| Caso | Aserción |
| ---- | -------- |
| Respuesta normal | devuelve `reply` + `usage` |
| `stopReason: tool_use` | ejecuta la acción y hace una segunda llamada |
| Argumentos maliciosos | se clapan antes de llegar a la respuesta |
| Modelo inválido | 500 `chat_failed`, sin filtrar el error crudo |
| `history` con turnos inválidos | se descartan, no rompen la llamada |

- **Prueba de aceptación:** suite verde y el caso de tool use cubre las dos
  invocaciones a Bedrock.

### TASK-2.3 · Tests del motor de pronóstico con datos reales
**Tamaño:** M

Hoy el motor solo se prueba con la serie sintética. Falta el caso que más importa:
una serie con las propiedades que romperían un modelo ingenuo.

| Caso | Aserción |
| ---- | -------- |
| Serie plana | no diverge, error bajo |
| Serie con tendencia fuerte | la capturada |
| Pico puntual | error alto, y el intervalo de confianza lo refleja |
| Menos de 2·periodo | lanza con mensaje explícito |
| Semana 53 con NaN o negativo | rechazado en el borde |

- **Feedback esperado:** el WAPE sobre la serie con pico sube de forma medible y
  `sigma` crece en consecuencia. Si no crece, el intervalo está mintiendo.

### TASK-2.4 · Mutation testing manual
**Tamaño:** S

Romper a propósito cada guarda (quitar el cap de longitud, el clamp del canal, la
comprobación de honeypot) y confirmar que **al menos un test falla** cada vez.

- **Prueba de aceptación:** las cuatro mutaciones están cubiertas. Un test que no
  falla al romper el código es un test que no está probando nada.

---

## Sprint 3 — Rendimiento y todos los dispositivos (1 día)

Objetivo: que se sienta rápido en un móvil de gama baja con 4G y que no haya
layout shift.

### TASK-3.1 · Presupuesto de performance automatizado
**Tamaño:** M

- Medir con `vite build` y fallar el build si el chunk inicial supera 160 kB gzip.
- Umbrales: inicial ≤ 160 kB gzip, cualquier chunk lazy ≤ 120 kB gzip.

- **Prueba de aceptación:** subir el umbral por debajo del tamaño actual hace
  fallar el build. Hoy estamos en 142 kB, con margen real.

### TASK-3.2 · Core Web Vitals en campo
**Tamaño:** M

- Los Web Vitals de laboratorio no predicen campo. Reportar `LCP`, `INP`,
  `CLS` por ruta y por dispositivo desde el propio sitio.
- **Feedback esperado:** LCP < 2.5 s en móvil 4G. Sospecho que la fuente de
  Google Fonts es el cuello: hoy bloquea el render con `display=swap`.

### TASK-3.3 · Tipografía sin bloquear el render
**Tamaño:** S

- Auto-hospedar Inter y Playfair Display como woff2 y precargar solo la variante
  usada en el hero.
- **Feedback esperado:** LCP mejora de forma medible en red lenta.

- **Beneficio extra:** eliminar la petición a `fonts.gstatic.com`, lo que además
  simplifica la política de cookies (un tercero menos).

### TASK-3.4 · Auditoría responsive real
**Tamaño:** M

Hoy el CSS usa 43 utilidades `sm:` y 10 `lg:`, pero **nadie lo ha visto en un
dispositivo real**. Auditar en 320, 375, 414, 768, 1024, 1440 y 1920 px:

| Riesgo | Por qué |
| ------ | ------- |
| Header a 320 px | logo + switcher + badge AWS son ~260 px antes de padding |
| Banner de cookies | dos botones apilados tapan el CTA del hero en móvil |
| Chat en pantalla corta | `max-h-[420px]` puede exceder el viewport |
| Tabla del gráfico | 35 etiquetas en 375 px |
| Objetivos táctiles | botones del formulario por debajo de 44 px |

- **Prueba de aceptación:** captura de cada ancho sin scroll horizontal y sin
  solapamiento; todos los objetivos táctiles ≥ 44×44 px.

### TASK-3.5 · Contraste y foco visible
**Tamaño:** S

- `text-white/25` sobre `#050505` no pasa WCAG AA para texto.
- Comprobar foco visible en todos los controles interactivos.

- **Prueba de aceptación:** axe DevTools sin violaciones críticas.

---

## Sprint 4 — Cerrar la deuda de seguridad (1–2 días)

Todo esto está documentado en el README, pero none está resuelto. Es lo primero
que preguntará un juez que sepa mirar.

### TASK-4.1 · Autenticación en `/chat` y `/lead`
**Tamaño:** L · **Es el más importante**

Hoy ambos endpoints son públicos y cada llamada gasta tokens de Bedrock reales.
Un tercero puede agotarte la cuenta.

- Opción mínima: API key de Amplify + Lambda Authorizer.
- Opción correcta: Cognito con el flujo de hosted UI.

- **Prueba de aceptación:** una llamada sin token devuelve 401 y no ejecuta nada.

### TASK-4.2 · CORS restrictivo
**Tamaño:** XS

- Cambiar `AllowOrigins: ['*']` por la URL de Amplify.
- **Prueba de aceptación:** un origen distinto recibe `access-control-allow-origin`
  ausente.

### TASK-4.3 · Credenciales de despliegue
**Tamaño:** S

Todo se desplegó con credenciales **root**. Crear un IAM user con permisos
limitados a CloudFormation, S3, Lambda, IAM y Bedrock, y rotar las de root.

- **Prueba de aceptación:** el deploy completo funciona sin credenciales root.

### TASK-4.4 · Rate limit distribuido
**Tamaño:** M

El límite actual es un `Map` en memoria: cada instancia tiene el suyo, así que
con más de una Lambda el límite real se multiplica.

- Migrar a DynamoDB con TTL, o seguir con el límite y documentarlo.

### TASK-4.5 · Rotación del secreto de Resend
**Tamaño:** S

- Activar rotación automática en Secrets Manager y probar el flujo.

---

## Sprint 5 — Robustez del agente (2 días)

### TASK-5.1 · Streaming de respuestas
**Tamaño:** M

Hoy el usuario espera ~6 s en blanco antes de la respuesta.

- `ConverseStream` (el skill de Bedrock lo marca explícitamente como la opción
  para chat).
- Medir y publicar la latencia time-to-first-token en el badge del agente.

### TASK-5.2 · Prompt caching
**Tamaño:** S

**No activar todavía.** El prompt de sistema está por debajo del mínimo cacheable
de Sonnet, así que hoy no cachearía nada. Subirlo a caché solo tiene sentido si
primero se agranda el contexto (historial de 90 días al agente). Decisión
documentada en el README para que nadie lo intente a ciegas.

### TASK-5.3 · Historial de conversación en el agente
**Tamaño:** M

Hoy el contexto se reconstruye desde el DOM de React en cada envío. Con más de
10 turnos se pierde coherencia.

- Estado de conversación en un reducer, con ventana deslizante explícita.

### TASK-5.4 · Validación de salida del modelo
**Tamaño:** M

El agente puede afirmar cifras que no están en el contexto. Añadir una capa que
verifique que cada número citado aparece en el pronóstico, y que lo marque si no.

---

## Definición de hecho

Una tarea está terminada cuando:

1. `npm run verify` (typecheck + 31 tests) pasa.
2. `npm run verify:api` y `verify:integration` pasan contra el entorno desplegado.
3. Si toca UI, hay captura en móvil y escritorio.
4. Si toca un contrato, el test de contrato correspondiente está actualizado **en el
   mismo commit** que el cambio.
5. El README refleja el nuevo estado, incluidas las deudas nuevas.

---

## Riesgos que hay que decidir pronto

| Riesgo | Impacto | Decisión |
| ------ | ------- | -------- |
| Textos legales sin abogado | Alto: es lo primero que revisa un Enterprises contact | Contratar revisión antes del hackathon |
| `/chat` público | Alto: coste de Bedrock exposed | TASK-4.1 antes de cualquier demo pública |
| Credenciales root | Medio: exposición total de la cuenta | TASK-4.3 |
| Datos sintéticos | Medio: un juez puede pedir el CSV | `POST /forecast` ya acepta `{ history: [...] }`; falta subir un fichero real |
| Dominio propio | Bajo ahora, alto si se Busca SEO | Afecta sitemap, canonical y Search Console |

## Orden recomendado

```
Sprint 1 (medición)  →  Sprint 4.1 y 4.2 (seguridad)
                      →  Sprint 3.3 y 3.4 (rendimiento y responsive)
                      →  Sprint 2 (tests)
                      →  Sprint 5 (agente)
```

Seguridad antes que el rendimiento: no tiene sentido medir con precisión el uso de
un endpoint que cualquiera puede agotar.
