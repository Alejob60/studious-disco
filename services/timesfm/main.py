"""TimesFM 2.5 inference service for Atelier Predict.

This is the "challenger" forecaster, measured at 5.61% WAPE against our 7.77%
Holt-Winters champion on the same 14-day holdout (see benchmarks/README.md).

It is deliberately NOT on the synchronous request path. Inference costs ~2 s of
CPU and the model takes ~5 s to load, so this service is designed to be called
by a nightly job that writes the result to S3. The dashboard keeps serving the
fast champion path and reads the precomputed forecast when one exists.

Endpoints
---------
GET  /health    liveness plus whether weights are resident
GET  /          service index, mirroring the Node API
POST /forecast  forecast a series

Design notes
------------
- Weights are baked into the image at build time, so the container starts offline
  and does not depend on Hugging Face at runtime.
- The model is loaded once in the lifespan handler. App Runner keeps the
  container warm between invocations, so the cost is paid per cold instance, not
  per request.
- torch_compile is disabled: it adds a long first-call compile that would distort
  the latency we are trying to control.
"""

from __future__ import annotations

import os
import time
from contextlib import asynccontextmanager
from typing import Any

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# Keep Hugging Face offline: the weights ship in the image, and a runtime call to
# the hub would make the service fail closed whenever egress is blocked.
os.environ.setdefault("HF_HUB_OFFLINE", "1")

import timesfm  # noqa: E402  (imported after the offline flag is set)

MODEL_REPO = os.environ.get("TIMESFM_REPO", "google/timesfm-2.5-200m-pytorch")
MIN_CONTEXT_POINTS = 32
MAX_CONTEXT_POINTS = 2048
MAX_HORIZON = 64

_STATE: dict[str, Any] = {"model": None, "loaded_at": None, "load_seconds": None}


class ForecastRequest(BaseModel):
    history: list[float] = Field(
        ...,
        min_length=MIN_CONTEXT_POINTS,
        max_length=MAX_CONTEXT_POINTS,
        description="Chronological daily observations, oldest first.",
    )
    horizon: int = Field(14, ge=1, le=MAX_HORIZON, description="Days to project.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    started = time.perf_counter()
    # A missing checkpoint must not crash the container: /health reports it and
    # the platform's health check can then surface the real reason.
    try:
        model = timesfm.TimesFM_2p5_200M_torch.from_pretrained(MODEL_REPO, torch_compile=False)
        model.compile(
            timesfm.ForecastConfig(
                max_context=MAX_CONTEXT_POINTS,
                max_horizon=MAX_HORIZON,
                # Without this the quantile head is not built and the second
                # return value comes back empty.
                use_continuous_quantile_head=True,
            )
        )
        _STATE["model"] = model
        _STATE["loaded_at"] = time.time()
        _STATE["load_seconds"] = round(time.perf_counter() - started, 2)
    except Exception as error:  # noqa: BLE001
        _STATE["load_error"] = f"{type(error).__name__}: {error}"

    yield
    _STATE["model"] = None


app = FastAPI(
    title="Atelier Predict — TimesFM inference",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
def health() -> dict[str, Any]:
    loaded = _STATE["model"] is not None
    body: dict[str, Any] = {
        "status": "healthy" if loaded else "degraded",
        "model_loaded": loaded,
        "model": MODEL_REPO,
    }
    if loaded:
        body["load_seconds"] = _STATE["load_seconds"]
        body["uptime_seconds"] = round(time.time() - _STATE["loaded_at"], 1)
    else:
        # Expose the reason rather than a bare 503: an App Runner health check
        # only tells you that something is wrong, not what.
        body["error"] = _STATE.get("load_error", "model not loaded")
    return body


@app.get("/")
def index() -> dict[str, Any]:
    return {
        "service": "Atelier Predict — TimesFM inference",
        "status": "operational" if _STATE["model"] is not None else "degraded",
        "model": MODEL_REPO,
        "license": "Apache-2.0 weights; commercial self-hosting permitted (not 3.0)",
        "measured_wape_pct": 5.61,
        "champion_wape_pct": 7.77,
        "endpoints": [
            {"method": "GET", "path": "/health"},
            {"method": "POST", "path": "/forecast", "body": {"history": "list[float]", "horizon": "int"}},
        ],
    }


@app.post("/forecast")
def forecast(request: ForecastRequest) -> dict[str, Any]:
    model = _STATE["model"]
    if model is None:
        raise HTTPException(status_code=503, detail=_STATE.get("load_error", "model not loaded"))

    values = [float(value) for value in request.history]
    if any(value != value for value in values):  # NaN check
        raise HTTPException(status_code=400, detail="history contains NaN")
    if any(value < 0 for value in values):
        raise HTTPException(status_code=400, detail="history contains negative values")

    started = time.perf_counter()
    try:
        # 2.5 always returns (points, quantiles); there is no return_quantiles flag.
        points_raw, quantiles_raw = model.forecast(
            horizon=request.horizon, inputs=[np.asarray(values, dtype=np.float32)]
        )
        points = np.asarray(points_raw).reshape(-1)[: request.horizon]
        quantiles = np.asarray(quantiles_raw)
    except Exception as error:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"inference failed: {error}") from error

    elapsed_ms = round((time.perf_counter() - started) * 1000, 1)

    payload: dict[str, Any] = {
        "model": MODEL_REPO,
        "predictions": [round(float(value), 4) for value in points],
        "horizon": request.horizon,
        "context_points": len(values),
        "inference_ms": elapsed_ms,
    }

    # Observed shape for this checkpoint is (batch, horizon, 10). Index 0 is the
    # median, then deciles p10..p90 follow. The ordering was verified empirically
    # against google/timesfm-2.5-200m-pytorch, not read from docs, so the full
    # array is returned as well and the consumer can re-map it if Google changes it.
    if quantiles.ndim == 3 and quantiles.shape[0] >= 1 and quantiles.shape[2] >= 9:
        series = quantiles[0][: request.horizon]
        payload["lower"] = [round(float(value), 4) for value in series[:, 1]]
        payload["upper"] = [round(float(value), 4) for value in series[:, 8]]
        payload["band"] = "p10-p90"
        payload["quantiles"] = [[round(float(value), 4) for value in row] for row in series]

    return payload
