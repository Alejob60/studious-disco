# syntax=docker/dockerfile:1
#
# Atelier Predict — TimesFM 2.5 inference service.
#
# Build:
#   docker build -t atelier-predict-timesfm:1.0.0 -f services/timesfm/Dockerfile .
#
# Multi-stage on purpose:
#   builder  installs the CPU wheels and downloads the weights into the image
#   runtime  carries only what is needed to serve, as a non-root user
#
# The weights are baked in rather than fetched at startup so the container starts
# offline: no Hugging Face dependency at runtime, and no surprise failure if
# egress is blocked.

# ───────────────────────────── builder ─────────────────────────────
# 3.12 is the floor: numpy 2.5.x, which the pinned requirements need, requires
# Python >= 3.12. The service was exercised locally on 3.14.3 (see
# services/timesfm/smoke_test.py), so this is a slightly older interpreter than
# the one the benchmark ran on.
ARG PYTHON_VERSION=3.12
FROM python:${PYTHON_VERSION}-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HOME=/opt/hf

WORKDIR /build

# CPU-only torch. The default PyPI wheel pulls ~2 GB of CUDA libraries this
# service never uses.
RUN pip install torch==2.14.1 --index-url https://download.pytorch.org/whl/cpu

COPY services/timesfm/requirements.txt .
RUN pip install -r requirements.txt

# Bake the checkpoint in. google/timesfm-2.5-200m-pytorch is Apache-2.0, the
# newest release whose weights permit commercial self-hosting; 3.0 does not.
#
# The destination must be $HF_HOME/hub, not $HF_HOME. from_pretrained(repo_id)
# resolves through the standard hub cache layout, so downloading anywhere else
# leaves the weights where the offline lookup never looks.
ARG TIMESFM_REPO=google/timesfm-2.5-200m-pytorch
RUN python -c "\
from huggingface_hub import snapshot_download; \
snapshot_download('${TIMESFM_REPO}', cache_dir='/opt/hf/hub')"

# ───────────────────────────── runtime ─────────────────────────────
FROM python:${PYTHON_VERSION}-slim AS runtime

# Required so ${PYTHON_VERSION} resolves inside this stage. A global ARG is only
# usable in FROM lines; without this re-declaration the COPY below expands to an
# empty path and the build fails.
ARG PYTHON_VERSION

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HF_HOME=/opt/hf \
    # The checkpoint is on disk; never reach for the hub at runtime.
    HF_HUB_OFFLINE=1 \
    OMP_NUM_THREADS=1 \
    TIMESFM_REPO=google/timesfm-2.5-200m-pytorch

# curl is only here for the container healthcheck.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /usr/local/lib/python${PYTHON_VERSION}/site-packages /usr/local/lib/python${PYTHON_VERSION}/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --from=builder /opt/hf /opt/hf

COPY services/timesfm/main.py ./main.py

# Never run as root.
RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app /opt/hf
USER appuser

EXPOSE 8080

# App Runner sets PORT; default to 8080 for local docker run.
ENV PORT=8080

# One worker on purpose: the model is resident in memory, so a second worker
# would load a second copy for no throughput gain. Scale with instances instead.
HEALTHCHECK --interval=30s --timeout=5s --start-period=240s --retries=3 \
    CMD curl -fsS "http://localhost:${PORT}/health" || exit 1

CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT} --workers 1 --timeout-keep-alive 75"]
