"""Live smoke test for the TimesFM service.

Exercises the real FastAPI app with the model resident, so it verifies the same
code path App Runner will serve. Run from the project root:

    .venv-tfm\\Scripts\\python.exe services/timesfm/smoke_test.py

Uses the committed benchmark dataset as input, so the output can be compared
against benchmarks/out/results.json: the numbers must match.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "services" / "timesfm"))

from fastapi.testclient import TestClient  # noqa: E402

import main as service  # noqa: E402

DATASET = ROOT / "benchmarks" / "out" / "dataset.json"
EXPECTED = ROOT / "benchmarks" / "out" / "results.json"

failures: list[str] = []


def check(label: str, ok: bool, detail: str = "") -> None:
    print(f"  {'ok  ' if ok else 'FAIL'}  {label}{'' if ok else f' -> {detail}'}")
    if not ok:
        failures.append(label)


def main() -> int:
    dataset = json.loads(DATASET.read_text(encoding="utf-8"))
    train = dataset["series"]["train"]

    # TestClient drives the lifespan, so the model is loaded exactly as in production.
    with TestClient(service.app) as client:
        print("TimesFM service smoke test\n")

        health = client.get("/health")
        check("GET /health -> 200", health.status_code == 200, str(health.status_code))
        body = health.json()
        check("model resident", body.get("model_loaded") is True, json.dumps(body)[:200])

        index = client.get("/")
        check("GET / -> 200", index.status_code == 200)
        check("index reports measured WAPE", index.json().get("measured_wape_pct") == 5.61)

        response = client.post("/forecast", json={"history": train, "horizon": 14})
        check("POST /forecast -> 200", response.status_code == 200, response.text[:200])
        forecast = response.json()

        predictions = forecast.get("predictions", [])
        check("returns 14 points", len(predictions) == 14, str(len(predictions)))
        check("all finite and positive", all(isinstance(v, (int, float)) and v > 0 for v in predictions))
        check("confidence band present", "lower" in forecast and "upper" in forecast)
        check(
            "band brackets the point forecast",
            all(lo <= point <= hi for lo, point, hi in zip(forecast.get("lower", []), predictions, forecast.get("upper", []))),
        )
        check("reports inference latency", isinstance(forecast.get("inference_ms"), (int, float)))

        # The whole point of the nightly job: it must reproduce the committed
        # benchmark, otherwise the served forecast would disagree with the README.
        if EXPECTED.exists():
            expected = json.loads(EXPECTED.read_text(encoding="utf-8"))["challenger"]["predictions"]
            drift = max(abs(a - b) for a, b in zip(predictions, expected))
            check(
                f"reproduces the committed benchmark (max drift {drift:.3f})",
                drift < 1.0,
                f"max drift {drift:.3f} exceeds 1.0",
            )

        print("\nValidation paths")
        short = client.post("/forecast", json={"history": [1.0] * 10, "horizon": 14})
        check("rejects a series shorter than 32 points", short.status_code == 422, str(short.status_code))

        bad_horizon = client.post("/forecast", json={"history": train, "horizon": 999})
        check("rejects an out-of-range horizon", bad_horizon.status_code == 422, str(bad_horizon.status_code))

        negative = client.post("/forecast", json={"history": [-5.0] * 40, "horizon": 7})
        check("rejects negative values", negative.status_code == 400, str(negative.status_code))

        malformed = client.post("/forecast", json={"history": "not-a-list", "horizon": 7})
        check("rejects a malformed payload", malformed.status_code == 422, str(malformed.status_code))

        empty = client.post("/forecast", json={})
        check("rejects a missing history", empty.status_code == 422, str(empty.status_code))

    print()
    if failures:
        print(f"{len(failures)} check(s) failed: {', '.join(failures)}")
        return 1
    print("All service checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
