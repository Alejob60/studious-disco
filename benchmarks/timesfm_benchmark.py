"""Champion-challenger benchmark: TimesFM 2.5 vs our Holt-Winters champion.

Run inside the project virtualenv:

    .venv-tfm\\Scripts\\python.exe benchmarks/timesfm_benchmark.py

Why this file exists in Python at all
-------------------------------------
TimesFM is a PyTorch model, so it cannot run inside the Node Lambda. Rather than
assume it is better, this script scores it on the exact holdout the champion was
scored on. The dataset is exported from Node (scripts/export-benchmark-dataset.mjs)
so both models see byte-identical inputs; a fair comparison requires that.

API note
--------
The PyPI package `timesfm==2.0.2` ships the **2.5** code path, which differs from
the 2.0 API that most blog posts still show:

    2.0:  tfm = timesfm.TimesFm(context_len=..., num_layers=..., model_dims=...)
          tfm.forecast([series], freq="D")

    2.5:  tfm = timesfm.TimesFM_2p5_200M_torch.from_pretrained(repo_id)
          tfm.forecast(horizon=14, inputs=[series])      # no `freq`

TimesFM 2.5 removed the frequency indicator, so the widely copied 2.0 snippet
raises TypeError against this package.

Licensing: TimesFM weights up to 2.5 are Apache-2.0 and permit commercial
self-hosting. TimesFM 3.0 weights are NOT, and are deliberately not used here.
See https://github.com/google-research/timesfm for the licence notice.

Acceptance rule: the challenger replaces the champion only on a strict win. A tie
would add a 200M-parameter dependency, an App Runner service and PyTorch cold
starts for no measured gain.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DATASET = REPO_ROOT / "benchmarks" / "out" / "dataset.json"
RESULTS = REPO_ROOT / "benchmarks" / "out" / "results.json"

# 2.5 weights are Apache-2.0, so commercial self-hosting is permitted.
MODEL_LABEL = "timesfm-2.5-200m-pytorch (Apache-2.0 weights)"


def wape(actual: list[float], predicted: list[float]) -> float:
    """Weighted absolute percentage error, identical to the JS implementation."""
    denominator = sum(actual)
    if denominator == 0:
        return 0.0
    numerator = sum(abs(a - p) for a, p in zip(actual, predicted))
    return numerator / denominator


def mae(actual: list[float], predicted: list[float]) -> float:
    return sum(abs(a - p) for a, p in zip(actual, predicted)) / len(actual)


def main() -> int:
    if not DATASET.exists():
        print(f"Dataset missing. Run: node scripts/export-benchmark-dataset.mjs", file=sys.stderr)
        return 2

    dataset = json.loads(DATASET.read_text(encoding="utf-8"))
    train = dataset["series"]["train"]
    test = dataset["series"]["test"]
    holdout = dataset["split"]["holdoutPoints"]

    print("Champion-challenger benchmark")
    print(f"  dataset      {len(dataset['series']['history'])} points, seed {dataset['provenance']['seed']}")
    print(f"  split        train {len(train)} / test {len(test)}")
    print(f"  metric       {dataset['metric']}")
    print(f"  champion     {dataset['champion']['name']}  WAPE {dataset['champion']['wapePct']}%")
    print(f"  baseline     {dataset['baseline']['name']}  WAPE {dataset['baseline']['wapePct']}%")
    print()

    try:
        import numpy as np
        import timesfm
    except ImportError as error:
        print(f"Cannot import TimesFM: {error}", file=sys.stderr)
        print("Run: .venv-tfm\\Scripts\\python.exe -m pip install timesfm==2.0.2 torch", file=sys.stderr)
        return 3

    model_cls = getattr(timesfm, "TimesFM_2p5_200M_torch", None)
    if model_cls is None:
        print(
            f"timesfm {getattr(timesfm, '__version__', '?')} does not expose "
            "TimesFM_2p5_200M_torch. Pin timesfm==2.0.2, which ships the 2.5 code path.",
            file=sys.stderr,
        )
        return 4

    repo_id = model_cls.DEFAULT_REPO_ID
    print(f"Loading {MODEL_LABEL} on CPU. First run downloads the checkpoint...")
    load_started = time.perf_counter()

    # 2.5 API: build from a pretrained repo, no manual layer/dim configuration.
    # torch_compile is disabled because it adds a long first-call compile cost
    # that would distort the latency we are trying to measure.
    tfm = model_cls.from_pretrained(repo_id, torch_compile=False)

    load_seconds = time.perf_counter() - load_started
    print(f"  checkpoint: {repo_id}")
    print(f"  model loaded in {load_seconds:.1f}s")
    print()

    # 2.5 splits setup into two phases: compile() prepares the decode path and is
    # required before forecast(), even when torch_compile is disabled.
    compile_started = time.perf_counter()
    tfm.compile(timesfm.ForecastConfig(max_context=1024, max_horizon=holdout))
    compile_seconds = time.perf_counter() - compile_started
    print(f"  compiled in {compile_seconds:.1f}s")
    print()

    # Zero-shot forecasting on the training portion only. The holdout is never
    # shown to the model, which is what makes the comparison fair.
    forecast_started = time.perf_counter()
    raw_forecast, _ = tfm.forecast(horizon=holdout, inputs=[np.asarray(train, dtype=np.float32)])
    forecast_seconds = time.perf_counter() - forecast_started

    predicted = [float(value) for value in np.asarray(raw_forecast).reshape(-1)[:holdout]]
    actual = [float(value) for value in test]

    if len(predicted) < holdout:
        print(f"TimesFM returned {len(predicted)} points, expected {holdout}.", file=sys.stderr)
        return 5

    challenger_wape = wape(actual, predicted) * 100
    challenger_mae = mae(actual, predicted)

    champion_wape = dataset["champion"]["wapePct"]
    baseline_wape = dataset["baseline"]["wapePct"]
    qualifies = challenger_wape < champion_wape

    print("Results on the 14-day holdout")
    print(f"  {'model':<26}{'WAPE':>9}{'MAE':>11}")
    print(f"  {'seasonal-naive':<26}{baseline_wape:>8.2f}%{'n/a':>11}")
    print(f"  {'holt-winters (champion)':<26}{champion_wape:>8.2f}%{dataset['champion']['maeUnits']:>11.2f}")
    print(f"  {'timesfm 2.5 (challenger)':<26}{challenger_wape:>8.2f}%{challenger_mae:>11.2f}")
    print()

    verdict = (
        f"TimesFM wins by {champion_wape - challenger_wape:.2f} points of WAPE."
        if qualifies
        else f"Holt-Winters wins by {challenger_wape - champion_wape:.2f} points of WAPE."
    )
    print(f"Verdict: {verdict}")

    if not qualifies:
        print(
            "Decision: keep Holt-Winters. Adopting the challenger would add a "
            "200M-parameter dependency, an App Runner service and PyTorch cold "
            "starts for no measured accuracy gain."
        )
    else:
        print(
            "Decision: the challenger qualifies on accuracy. Before adopting it, "
            "re-check cold-start latency and running cost against the champion, "
            "which are not captured by WAPE."
        )

    print()
    print(f"  model load   {load_seconds:.1f}s")
    print(f"  inference    {forecast_seconds * 1000:.0f} ms for one {len(train)}-point series")

    RESULTS.parent.mkdir(parents=True, exist_ok=True)
    RESULTS.write_text(
        json.dumps(
            {
                "generatedAt": dataset["generatedAt"],
                "challenger": {
                    "model": repo_id,
                    "license": "Apache-2.0 weights (commercial self-hosting permitted)",
                    "wapePct": round(challenger_wape, 4),
                    "maeUnits": round(challenger_mae, 4),
                    "modelLoadSeconds": round(load_seconds, 2),
                    "inferenceMs": round(forecast_seconds * 1000, 1),
                    "predictions": [round(value, 4) for value in predicted],
                },
                "champion": dataset["champion"],
                "baseline": dataset["baseline"],
                "actual": test,
                "verdict": {
                    "qualifies": qualifies,
                    "wapeDeltaPoints": round(champion_wape - challenger_wape, 4),
                    "decision": "adopt challenger" if qualifies else "keep champion",
                },
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"\nResults written to {RESULTS}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

