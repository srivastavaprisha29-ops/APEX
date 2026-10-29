# APEX — F1 Gesture Lab

An interactive Formula One concept-car explorer, circuit comparison viewer, engineering reference and trainable gesture-recognition project.

**Live app:** https://apex-gesture-lab-prisha.saltylake.chatgpt.site

The hosted app is private and requires the owner's ChatGPT sign-in. This repository contains the source and licensed assets; it does not contain hosting credentials, training recordings or trained checkpoints.

## Features

- **Car exploration:** licensed Qvist 2026 concept with 16 selectable assemblies, hover tooltips, pinned technical notes, exploded view, focus/isolation, viewpoints, wireframe and x-ray context.
- **See on Track:** 40 community circuit layouts, all 23 circuit entries in the fetched 2026 API calendar, and a 78-circuit historical catalogue. Orbit, pan, zoom, follow-car, pause and scrub the replay.
- **Recorded comparisons:** RB19/2023, RB20/2024, RB21/2025, RB22/2026 and MCL38/2024. Compare each constructor's best reported fastest race lap, its driver, lap number, event/date and available lap-average speed. Refresh from Jolpica's API.
- **Engineering tools:** component explanations and original SVG schematics; interactive drag, downforce, drag-power, cornering-force and sideslip examples with explicit assumptions and technical reading links.
- **Camera interaction:** local hand landmarks, pinch-to-grab, open-palm rotation, two-hand scaling and two-pinch progressive disassembly. Mouse/touch exploration also works without the camera.
- **ML workflow:** labelled landmark recording, participant-separated splits, PyTorch MLP/LSTM/Transformer baselines, Optuna search/pruning, evaluation, FP32/INT8 validation benchmarking, FastAPI inference and Docker packaging.

## Run the viewer

Requires Python 3.11+ for the static server and a recent desktop browser.

```bash
git clone https://github.com/srivastavaprisha29-ops/APEX.git
cd APEX
python -m http.server 8080 --directory dist
```

Open http://localhost:8080. Internet is needed for pinned Three.js/MediaPipe packages, the landmark model, fonts and API refresh. The bundled circuit/result snapshot remains available without an API call. Camera permission requires localhost or HTTPS. GPU-less browsers use a deliberately simplified silhouette rather than the full-detail asset.

## Project structure

| Path | Purpose |
| --- | --- |
| `dist/` | Static viewer and browser modules |
| `dist/models/` | Full concept asset, software LOD and attribution |
| `dist/data/` | Race snapshot, reference layouts and data licences |
| `dist/parts-data.js`, `dist/schematics.js` | Technical notes and illustrative sections |
| `dist/track.js`, `dist/track-math.js` | Track interaction and result comparison |
| `dist/engineering.js`, `dist/physics.js` | Educational physics tools |
| `ml/` | Training, tuning, evaluation, optimization and inference |
| `scripts/` | Data refresh, model preparation and asset checks |
| `PROJECT_GUIDE.md` | Detailed implementation, collection and experiment guide |

## Validation

Node.js 24 and Python 3.11+:

```bash
node test_track.mjs
node test_inspection.mjs
node test_gestures.mjs
python scripts/test_assets.py
```

These check circuit/path coverage, result isolation, SI scaling, hover-hit mapping, technical entries, manipulation, model groups and attribution. They do not establish ML accuracy or substitute for physical webcam testing. Browser checks have covered hover/pinning, car/circuit switching, API refresh and the interactive calculator.

## Train a custom gesture model

No trained custom recognizer is bundled. Enable the camera, open ML Workspace and collect/export real sequences with participant/session identifiers. The existing four-class training schema is `idle`, `rotate`, `zoom`, `select`; natural grab/explode controls are separate rules. Follow the collection protocol in `PROJECT_GUIDE.md`.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r ml/requirements.txt
python -m pytest ml -q
python ml/train.py train --data data/*.json --architecture lstm --out artifacts/lstm
python ml/train.py tune --data data/*.json --trials 20 --out artifacts/tuned
python ml/train.py evaluate --checkpoint artifacts/tuned/model.pt --data data/*.json --out artifacts/final
MODEL_PATH=artifacts/tuned/model.pt uvicorn serve:app --app-dir ml --host 127.0.0.1 --port 8000
```

Collect at least five participants with every class; eight or more are preferable. Hold out people before tuning and reserve the test set for final evaluation. The inference service is intended for localhost; remote use needs HTTPS, authentication and restricted origins.

## Interpretation limits

- The detailed asset is an independent **Qvist concept**, not Red Bull/McLaren CAD. Car profiles and track markers change reference data/colours, not the underlying chassis. The source has no complete internal power unit; seams and schematics are illustrative.
- Race-lap results depend on driver, tyres, fuel, weather, traffic and layout. They are not a controlled estimate of intrinsic car speed. Missing records remain unavailable; lap-average speed is not top speed.
- Track playback uses uniform distance per second with the recorded lap duration, or a labelled 90-second demo where timing is absent. It is **not telemetry**, a racing-line reconstruction or a physics simulation. Layout versions, origin, road width, elevation and car scale are not exact race-year reconstructions.
- Physics coefficients are user-set examples, not fitted car parameters. The simplified force budget omits important tyre, combined-slip, load-transfer and transient effects.
- The camera is a screen-space overlay, not world-anchored AR. Custom gesture training and end-to-end latency/usability evaluation remain future work.

## Data, assets and licences

- Original application code and educational diagrams: [MIT](LICENSE).
- Qvist_designs' **F1 2026 concept (polygon model)**: CC BY 4.0. Prepared assembly derivative and all modifications are credited in [model attribution](dist/models/ATTRIBUTION.md). Full geometry is gzip-packaged; the separate silhouette LOD loses cavities and small details.
- Tomislav Bacinger's circuit GeoJSON: MIT, with the complete notice in [CIRCUIT-LICENSE.md](dist/data/CIRCUIT-LICENSE.md).
- Jolpica race data and adapted snapshot: **CC BY-NC-SA 4.0**, separate from the code licence. See [data provenance](dist/data/ATTRIBUTION.md). The data is for non-commercial educational use under those terms.
- Third-party packages retain their licences. No endorsement by Formula One, FIA, teams or the asset creators is implied.

Refresh the snapshot with `python scripts/fetch-track-data.py`. For optional model-LOD preparation, install `scripts/requirements-model.txt` and run `python scripts/prepare-model.py`.
