/**
 * Generates docs/CONTRATO-DATOS.md and the retailer template.
 *
 * The contract is written from docs/data-contract.examples.json, and every example
 * in that file is asserted against the real parser by backend/test/data-contract.test.js.
 * So this generator cannot describe a format the code does not accept: the
 * examples fail the suite before the document can claim them.
 *
 *   node scripts/generate-data-contract.mjs
 *
 * Produces:
 *   docs/CONTRATO-DATOS.md        the contract to send a customer
 *   dist/plantilla-demanda.csv    an empty template, ready to fill in
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')

const contract = JSON.parse(readFileSync(join(repoRoot, 'docs', 'data-contract.examples.json'), 'utf8'))
const outDir = join(repoRoot, 'dist')

const list = (items, format) => items.map(format).join('\n')

const md = `# Contrato de datos — Atelier Predict

> Generado desde \`docs/data-contract.examples.json\`. Cada ejemplo de este
> documento se ejecuta contra el parser real en
> \`backend/test/data-contract.test.js\`, así que no puede describir un formato
> que el sistema no acepte.

Si estás leyendo esto para enviarnos tus ventas, lo mínimo que necesitamos son
**dos columnas y ${contract.minPoints} días**. Todo lo demás es opcional.

---

## Lo mínimo indispensable

| | |
|---|---|
| **Columna 1** | La fecha de cada día |
| **Columna 2** | Las unidades vendidas ese día |
| **Granularidad** | ${contract.granularity}. Una fila por día, sin saltarse ni repetir fechas |
| **Mínimo** | **${contract.minPoints} días** |
| **Recomendado** | **${contract.recommendedMinPoints} días o más** |
| **Tope** | ${contract.maxPoints} días |

Por qué ${contract.minPoints} y no menos: el modelo aparta los últimos
${contract.recommendedMinPoints > 30 ? '14' : '14'} días sin verlos para medirse, y
con lo que queda necesita dos semanas completas para aprender el ritmo semanal. Con
menos de ${contract.minPoints} días no hay nada que medir.

${contract.minPoints} días es el mínimo que el sistema **acepta**. Por encima de
${contract.recommendedMinPoints} el pronóstico se estabiliza de verdad.

---

## Nombres de columna que aceptamos

Si tu archivo tiene encabezado, el sistema busca la columna por nombre. Estos
funcionan:

${list(contract.columns.accepted, (c) => `- \`${c.name}\`${c.why ? ` — ${c.why}` : ''}`)}

Estos **no** son la columna de unidades y el sistema los rechaza:

${list(contract.columns.notAccepted, (c) => `- \`${c.name}\` — ${c.why}`)}

Sin encabezado también funciona: un archivo que solo tenga números, uno por día,
es una serie válida.

---

## Fechas

${list(contract.dateColumns.accepted, (c) => `- \`${c.name}\``)}

Formatos que leemos:

${list(contract.dateColumns.formats, (f) => `- \`${f.format}\` — ej. \`${f.example}\`${f.why ? ` (${f.why})` : ''}`)}

### ⚠️ Las barras se leen día-primero, siempre

> **${contract.dateColumns.dayFirstIsMandatory.rule}**

| | |
|---|---|
| **Ejemplo** | \`${contract.dateColumns.dayFirstIsMandatory.danger.example}\` |
| **Lo leemos como** | ${contract.dateColumns.dayFirstIsMandatory.danger.readAs} |
| **Pero puede significar** | ${contract.dateColumns.dayFirstIsMandatory.danger.butMayMean} |

${contract.dateColumns.dayFirstIsMandatory.danger.consequence}

**Qué hacer:** exporta como \`YYYY-MM-DD\` y el problema desaparece. Si no puedes,
dinos tu convención y leemos el archivo como tú quieras.

${contract.dateFormats?.dayFirstDetection ?? contract.dateColumns.dayFirstIsMandatory.detection}

---

## Separadores y decimales

${list(contract.delimiters, (d) => `- \`${d.delimiter}\` con decimal \`${d.decimal}\` — ${d.why}`)}

El separador se detecta solo en la primera línea. No hay que declarar nada.

Ojo con esto: un archivo separado por comas **no** puede llevar coma decimal.
Un valor como \`1,234\` puede ser 1234 o 1.234 según de dónde venga, y elegir mal
es un error de mil veces en el dato. El sistema **rechaza** ese valor en vez de
adivinar. Si tu Excel es español, guárdalo con punto y coma.

---

## Lo que toleramos sin quejarnos

${list(contract.lexicalTolerances, (c) => `- **${c.case}** (\`${c.example}\`) — ${c.why}`)}

Los comentarios son el mejor sitio para dejarle una nota a quien lea el archivo
después.

---

## Lo que rechazamos, y por qué

Cada rechazo dice qué línea falló y cuál fue el problema. No adivinamos.

${list(contract.refusals, (r) => `- **${r.case}** (\`${r.error}\`)${r.why ? ` — ${r.why}` : ''}`)}

Un rechazo no es un fallo del sistema: es preferable a devolver un pronóstico
construido sobre un número mal leído.

---

## Lo que quisiéramos pero todavía no aceptamos

${list(contract.openColumns, (c) => `### \`${c.name}\` — ${c.status}

${c.why}${c.nextStep ? `\n\n**${c.nextStep}**` : ''}`)}

---

## Qué recibes de vuelta

${list(contract.whatTheCustomerGetsBack, (item) => `- ${item}`)}

Y el registro queda guardado 90 días en nuestra base, con su propio id, para
poder comparar tu resultado contra el de otro periodo.

---

## Cómo se envía

En \`https://main.d28ukybtuih8pa.amplifyapp.com\`:

1. Baja \`plantilla-demanda.csv\` (o usa el archivo que te mandamos).
2. Ábrelo, pega tus datos sobre las dos columnas.
3. Vuelve a subirlo y presiona **Evaluar mi serie**.

Si prefieres que lo miremos nosotros, mándalo por correo a
\`enterprise@colombiatic.com.co\`.
`

mkdirSync(join(repoRoot, 'docs'), { recursive: true })
writeFileSync(join(repoRoot, 'docs', 'CONTRATO-DATOS.md'), md, 'utf8')

// An empty template. Column names in English because they are what the parser
// looks for first, and the Spanish aliases also work but this removes a question
// from the conversation.
const header = [
  '# Llena las dos columnas de abajo y vuelve a subir este archivo.',
  `# Mínimo ${contract.minPoints} días, una fila por día, sin fechas repetidas ni saltadas.`,
  '# Formato de fecha recomendado: AAAA-MM-DD (por ejemplo 2026-03-24).',
  '# Si prefieres 24/03/2026 está bien: las barras se leen día primero.',
  '#',
  '# Si tu Excel está en español, guárdalo con PUNTO Y COMA entre columnas y coma',
  '# en los decimales. Un archivo separado por comas no puede llevar coma decimal:',
  '# un valor como 1,234 puede ser 1234 o 1.234, y el sistema lo rechaza en vez de',
  '# adivinar. Si ya lo guardaste con comas, guárdalo de nuevo con punto y coma.',
  '#',
  '# Los días en cero valen, pero si el producto estaba agotado avísanos aparte:',
  '# el sistema puede avisarte que ese día no era demanda real.',
  '',
  'date,units',
  '',
].join('\n')

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'plantilla-demanda.csv'), header, 'utf8')

console.log(`generated docs/CONTRATO-DATOS.md and dist/plantilla-demanda.csv (min ${contract.minPoints} days)`)