# Contrato de datos — Atelier Predict

> Generado desde `docs/data-contract.examples.json`. Cada ejemplo de este
> documento se ejecuta contra el parser real en
> `backend/test/data-contract.test.js`, así que no puede describir un formato
> que el sistema no acepte.

Si estás leyendo esto para enviarnos tus ventas, lo mínimo que necesitamos son
**dos columnas y 28 días**. Todo lo demás es opcional.

---

## Lo mínimo indispensable

| | |
|---|---|
| **Columna 1** | La fecha de cada día |
| **Columna 2** | Las unidades vendidas ese día |
| **Granularidad** | daily. Una fila por día, sin saltarse ni repetir fechas |
| **Mínimo** | **28 días** |
| **Recomendado** | **90 días o más** |
| **Tope** | 365 días |

Por qué 28 y no menos: el modelo aparta los últimos
14 días sin verlos para medirse, y
con lo que queda necesita dos semanas completas para aprender el ritmo semanal. Con
menos de 28 días no hay nada que medir.

28 días es el mínimo que el sistema **acepta**. Por encima de
90 el pronóstico se estabiliza de verdad.

---

## Nombres de columna que aceptamos

Si tu archivo tiene encabezado, el sistema busca la columna por nombre. Estos
funcionan:

- `units` — the measured value; the whole point of the file
- `unit` — singular spelling of the same
- `unidades` — the Spanish header, which is what a Colombian export usually carries
- `qty` — what most POS systems name it
- `quantity` — full spelling of qty
- `cantidad` — Spanish spelling of qty
- `ventas` — some systems export the sold count under this name
- `sales` — English counterpart of ventas
- `value` — generic, but unambiguous in a two-column file
- `valor` — Spanish counterpart of value
- `demanda` — what the model is predicting, named as such
- `demand` — English counterpart of demanda

Estos **no** son la columna de unidades y el sistema los rechaza:

- `precio` — a price is not a demand count, so accepting it would model money instead of units
- `total` — ambiguous between a line total and a day total
- `stock` — not a demand measure. See openColumns below.
- `inventario` — same: a quantity on hand, not a quantity sold

Sin encabezado también funciona: un archivo que solo tenga números, uno por día,
es una serie válida.

---

## Fechas

- `date`
- `fecha`
- `dia`
- `día`
- `day`
- `periodo`
- `period`

Formatos que leemos:

- `YYYY-MM-DD` — ej. `2026-03-24` (unambiguous, and the safest thing to send)
- `DD/MM/YYYY` — ej. `24/03/2026` (what Colombian Excel writes. Read as DAY first.)
- `DD-MM-YYYY` — ej. `24-03-2026` (same convention with a hyphen)
- `DD.MM.YYYY` — ej. `24.03.2026` (same convention with a dot)

### ⚠️ Las barras se leen día-primero, siempre

> **Any slash, hyphen or dot date is read DAY first. There is no way to detect which convention the writer used from the shape alone.**

| | |
|---|---|
| **Ejemplo** | `03/04/2026` |
| **Lo leemos como** | 3 April |
| **Pero puede significar** | 4 March, if the file came from a month-first system |

the series is silently out of order and the weekly seasonality the model depends on becomes noise. The model still returns a WAPE, so nothing looks wrong.

**Qué hacer:** exporta como `YYYY-MM-DD` y el problema desaparece. Si no puedes,
dinos tu convención y leemos el archivo como tú quieras.

undefined

---

## Separadores y decimales

- `,` con decimal `.` — the safe default: what a POS export and a developer both produce
- `;` con decimal `,` — Spanish-locale Excel. Detected from the first line, so it does not need to be declared anywhere.
- `\t` con decimal `.` — tab-separated, which is what some BI tools emit

El separador se detecta solo en la primera línea. No hay que declarar nada.

Ojo con esto: un archivo separado por comas **no** puede llevar coma decimal.
Un valor como `1,234` puede ser 1234 o 1.234 según de dónde venga, y elegir mal
es un error de mil veces en el dato. El sistema **rechaza** ese valor en vez de
adivinar. Si tu Excel es español, guárdalo con punto y coma.

---

## Lo que toleramos sin quejarnos

- **header row** (`date,units`) — optional. A file of nothing but numbers is a valid series.
- **blank lines** (``) — ignored
- **comments** (`# exportado del POS`) — any line starting with # is ignored, which is where the note to the reader goes
- **quoted cells** (`"120"`) — quotes are stripped, and a doubled quote inside is an escaped quote
- **byte-order mark** (`﻿units`) — tolerated, because a Windows copy/paste adds one and it would otherwise hide the header
- **thousands with a semicolon** (`1.234,50`) — the dot groups thousands and the comma is the decimal, in that locale

Los comentarios son el mejor sitio para dejarle una nota a quien lea el archivo
después.

---

## Lo que rechazamos, y por qué

Cada rechazo dice qué línea falló y cuál fue el problema. No adivinamos.

- **negative value** (`negative_value`) — a negative sale is a return, which needs the returns included, not netted into a demand series
- **non-numeric cell** (`not_a_number`)
- **too short** (`too_short`) — below 28 days there is not enough left after a 14-day holdout to fit a weekly season
- **too long** (`too_long`) — above 365 days. Not a limit of interest, a guard against a stray multi-year file.
- **three columns** (`too_many_columns`) — there is no way to tell which column is the demand measure
- **comma decimal in a comma-delimited file** (`not_a_number`) — 1,234 is either 1234 or 1.234 and guessing wrong is a 1000x error in the data, so it is refused instead
- **impossible date** (`not_a_number`) — 2026-02-31 is not rolled forward into March; the date is dropped and gap detection is lost for that row
- **empty file** (`empty_file`)
- **no series at all** (`no_series`) — the body carried neither an array nor csv text

Un rechazo no es un fallo del sistema: es preferable a devolver un pronóstico
construido sobre un número mal leído.

---

## Lo que quisiéramos pero todavía no aceptamos

### `stock_disponible` — not accepted today

This is the most valuable thing a retailer could send and the parser will refuse it as a third column. A zero on a day the shelf was empty is not zero demand, and the diagnostics can only report that it happened, not act on it. Excluding those days before fitting would make the WAPE honest rather than merely flagged.

**A stock flag turns the diagnostics from a warning into a correction. Say so when you send the request: it is the difference between a demo and a pilot.**
### `precio / promocion` — not accepted today

Price explains a demand spike, so it belongs in the model eventually. It is not needed for the first evaluation and would make the first conversation harder.
### `sku / producto` — one series per file

The endpoint takes a single series. To compare products, send one file per SKU. Multi-series is what the phase-two dashboard adds.

---

## Qué recibes de vuelta

- WAPE of the model against a seasonal-naive baseline, on the same held-out days
- the improvement in error, and the money that is worth at their own contribution margin
- a 14-day projection with a 95% interval
- a data-quality report: stock-out runs named by date, calendar gaps, promotion-sized outliers
- a stored record with a 90-day retention, readable back through the same API

Y el registro queda guardado 90 días en nuestra base, con su propio id, para
poder comparar tu resultado contra el de otro periodo.

---

## Cómo se envía

En `https://main.d28ukybtuih8pa.amplifyapp.com`:

1. Baja `plantilla-demanda.csv` (o usa el archivo que te mandamos).
2. Ábrelo, pega tus datos sobre las dos columnas.
3. Vuelve a subirlo y presiona **Evaluar mi serie**.

Si prefieres que lo miremos nosotros, mándalo por correo a
`enterprise@colombiatic.com.co`.
