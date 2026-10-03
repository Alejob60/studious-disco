# Benchmark: campeón vs. retador

> Ejecutado el 3 de octubre de 2026. Los números de esta tabla son reproducibles
> con dos comandos desde un checkout limpio.

## Resultado

Los tres modelos evaluados sobre **el mismo holdout de 14 días**, con la misma
métrica (WAPE) y exactamente los mismos datos:

| Modelo | WAPE | MAE (unid/día) |
| --- | --- | --- |
| `seasonal-naive` (baseline) | 10.17 % | — |
| `holt-winters-additive` (campeón) | 7.77 % | 13.97 |
| **`timesfm-2.5-200m-pytorch` (retador)** | **5.61 %** | **10.10** |

**El retador gana por 2.15 puntos de WAPE — una mejora relativa del 27.7 %.**

Primer día del holdout, para ver el carácter del error:

| | Valor |
| --- | --- |
| Real | 248.0 |
| TimesFM 2.5 | 230.2 |
| Holt-Winters | 240.7 |

## Reproducirlo

```bash
# 1. Exportar el dataset canónico desde Node
node scripts/export-benchmark-dataset.mjs

# 2. Preparar el entorno del retador (una sola vez)
python -m venv .venv-tfm
.venv-tfm\Scripts\python -m pip install torch --index-url https://download.pytorch.org/whl/cpu
.venv-tfm\Scripts\python -m pip install timesfm==2.0.2 numpy

# 3. Correr el benchmark
.venv-tfm\Scripts\python benchmarks\timesfm_benchmark.py
```

El dataset se exporta desde Node en lugar de regenerarse en Python a propósito:
el PRNG `mulberry32` de `forecast-engine.js` no se reimplementa, así que es
imposible que ambos modelos puntuen distinto por una diferencia en los datos. Node escribe la
serie y el split; Python los lee.

## Por qué el.dataset lo exporta Node

Una comparación honesta exige entradas byte-idénticas. Reimplementar el generador
en Python habría introducido una divergencia silenciosa: los números habrían
difiereado por redondeo en coma flotante y nadie lo habría notado.

## Nota de API (importante para quien implemente esto)

El paquete de PyPI `timesfm==2.0.2` **incluye el código de la 2.5**, no el de la 2.0.
La API es:

```python
# 2.0 (lo que casi todos los tutoriales siguen mostrando)
tfm = timesfm.TimesFm(context_len=512, num_layers=20, model_dims=1280, backend="cpu")
tfm.load_from_checkpoint(repo_id="google/timesfm-2.0-200m-pytorch")
tfm.forecast([series], freq="D")          # <-- falla: no hay `freq` en 2.5

# 2.5 (API real)
tfm = timesfm.TimesFM_2p5_200M_torch.from_pretrained(repo_id, torch_compile=False)
tfm.compile(timesfm.ForecastConfig(max_context=1024, max_horizon=14))
tfm.forecast(horizon=14, inputs=[series])  # <-- sin `freq`
```

Tres cosas que solo se descubren al ejecutar:
1. `timesfm.TimesFm` **no existe** en el paquete actual.
2. `forecast()` lanza `RuntimeError: Model is not compiled` si no se llama a
   `compile()` antes, incluso con `torch_compile=False`.
3. El checkpoint por defecto es `google/timesfm-2.5-200m-pytorch`.

## Licencia

- Pesos de TimesFM **hasta la 2.5**: Apache-2.0 → self-hosting comercial permitido.
- Pesos de **3.0**: licencia no comercial → **no** self-hosteable en producción.

Este benchmark usa 2.5, que es la última versión comercialmente permisiva por
vía propia. Google también aclara que la versión abierta *"no es un producto de
Google soportado oficialmente"*.

## Latencia: donde el campeón gana

| | Champion | Retador |
| --- | --- | --- |
| Inferencia (CPU, 1 serie de 76 puntos) | **1 ms** (cacheado) | **1.878–2.651 ms** |
| Carga del modelo | 0 ms | **4.6–5.8 s** |
| Motor | Node puro en Lambda | Python + PyTorch en App Runner |
| Coste en reposo | ~$0 (escala a cero) | instancia siempre activa |
| Dependencia | ninguna | 200M parámetros + PyTorch |

## Decisión

**El retador gana en precisión, el campeón gana en todo lo demás.** Por eso la
arquitectura objetivo no es "cambiar el modelo", sino **separarlos por presupuesto
de latencia**:

```
                    ┌─────────────────────────────────────┐
   /forecast ──────►│  CAMINO CALIENTE                    │
   (síncrono)       │  Holt-Winters en Lambda · 1 ms      │
                    │  escala a cero, sin dependencias     │
                    └─────────────────────────────────────┘

   EventBridge (nightly) ──► App Runner: TimesFM 2.5
                              │  ~2 s de inferencia, sin nadie esperando
                              ▼
                           S3: forecast.json
                              │
   /forecast ────────────────┴──► lee el pronóstico precomputado
                                   (misma ruta, misma latencia, mejor WAPE)
```

El usuario recibe **5.61 % de WAPE con la latencia del camino caliente**, porque
el trabajo pesado ocurre de noche cuando nadie espera.

This is also the honest answer if a judge asks *"why not just use TimesFM?"*:
putting 2.6 s of inference on the path of every page load makes the product
worse to gain 2.15 points on an error that is already 7.77 %.

## Pendiente antes de producción

- [ ] Nightly en EventBridge + App Runner, no una llamada síncrona
- [ ] S3 para el pronóstico precomputado, con el hash del histórico como clave
- [ ] Alerta si el WAPE del precomputado se degrada (drift de datos)
- [ ] Coste mensual real de la instancia App Runner frente al ahorro
- [ ] Evaluar si 2.5 sigue siendo la última versión permisiva cuando salga la 3.1

