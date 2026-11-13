# APEX — F1 Gesture Lab

An interactive formula-car explorer plus a trainable temporal gesture-recognition pipeline. See Build 002 below for the camera overlay and archive additions.

## Build 002: car archive and camera interaction
- Officially sourced profiles for RB19 (2023), RB20 (2024), RB21 (2025), RB22 (2026) and MCL38 (2024), with source URLs and precise field labels in `dist/cars.js`. Data checked 28 October 2026. Static specifications, not live telemetry. RB23 is not included because an official specification was not verified.
- Each profile uses a shared educational proxy and team-inspired colours, **not** an exact 3D model of that chassis. Profiles do not imply authentic geometry.
- Camera mode composites a mirrored live webcam feed behind the 3D scene and draws optional landmarks over it. This is screen-space interaction, not world-anchored AR: no SLAM, real metric depth, surface anchors or hand occlusion.
- Natural controls: one pinch grabs/moves the car in the camera plane; one open palm moves/turns to rotate/tilt; two open hands change scale; two pinches pulling apart progressively explode the educational assembly, moving together closes it. Hand loss and gesture changes reset anchors to avoid jumps. Rule-based manipulation remains separate from the untrained custom temporal model.
- A local, self-contained static GLB (30 MB maximum) can replace the proxy. Names containing wheel/tyre, suspension/wishbone, engine/powerunit, radiator/cooling or wing/floor are assigned to system groups. This mapping is heuristic. Single-system geometry cannot reveal or explode nonexistent internals. No licensed team assets are bundled. Assets remain local and are not uploaded; software rendering uses simplified flat materials. Skeletal/instanced meshes and external files are not supported.
- `node test_gestures.mjs` verifies grab displacement, scaling, pull-apart direction and loss-of-hand reset. Real webcam interaction still needs device testing.

## What exists now
- Original educational car geometry with six component groups, an exploded view, livery switching, orbit/zoom, and component explanations.
- Three.js WebGL rendering with an SVG software fallback.
- MediaPipe hand landmarks, a landmark overlay, local camera processing, rule-based pinch rotation and two-hand zoom.
- Labelled 32-frame recording and JSON export, with participant/session identifiers.
- PyTorch mean-pooling MLP, two-layer LSTM and temporal Transformer; Optuna tuning with pruning; early stopping; weighted cross-entropy; participant-isolated splits.
- A FastAPI service whose trained predictions gate rotation and zoom. A trained `select` prediction uses the fingertip as a cursor, with a cooldown.
- Validation-only FP32 vs INT8 benchmarking for MLP/LSTM; held-out evaluation of FP32 checkpoints.

## Honest project status
No real gesture dataset or trained checkpoint is bundled. No accuracy or latency result is claimed. Rules are the active controls until a trained service is connected. This is a working research scaffold, not a completed or validated advanced ML system. The bundled car is a simplified concept, not an official F1 team car; car profiles change verified metadata and colours, not chassis geometry. Internals illustrate arrangement, not mechanical CAD.

[Hosted APEX demo (authorized accounts)](https://apex-gesture-lab-prisha.saltylake.chatgpt.site)

## Run the viewer
From the project root, run:

```bash
python -m http.server 8080 --directory dist
```
Open http://localhost:8080 in a recent desktop browser. External internet access is required for pinned Three.js/MediaPipe packages, the hand landmark model and fonts. Webcam access requires localhost or HTTPS and browser permission. On a private hosted Site, open the Site directly if an embedded preview blocks camera access. There is no backend upload of camera frames. Connecting a model sends normalized landmark sequences to the inference URL you choose.

The GitHub checkout includes the lightweight car preview and the track snapshot. To enable the full-detail model, run `python3 scripts/download-model.py` from the repository root. The script downloads a pinned, attributed model, checks its SHA-256, and generates the gzip asset locally. The track and gesture tabs also work with the lightweight model.

## Verification

Run `node --test test_*.mjs` for gesture, inspection, track and physics checks. After downloading the full-detail asset, run `python3 scripts/test_assets.py`.

## First experiment: collect the dataset
1. Explore the car with drag/scroll, the component list and exploded view.
2. Enable camera and try Natural manipulation. For recordings intended for the existing four-class ML pipeline, switch Gesture behaviour to Trained model controls: pinch and move for `rotate`, two open hands for `zoom`, an extended index finger for `select`, and non-command motion for `idle`. Natural grab/explode gestures are not classes in the existing training schema; do not mislabel them as the old commands.
3. Open ML Workspace; assign a pseudonymous participant ID and session ID.
4. Record `idle`, `rotate`, `zoom`, and `select` sequences. Use an extended index finger to point for `select`; hold the gesture through the recording. Idle must include natural non-command hand movement, absent hands and transitions.
5. Record many sequences per gesture, across sessions, distances, lighting and backgrounds. A useful starting collection target is 8–12 people and 30+ sequences per gesture/person, not a guarantee of sufficient data. Obtain consent.
6. Export before closing the tab. Files can be supplied together via `--data data/*.json`.

Schema: `schema_version:1`, `records:[{participant,session,label,frames,timestamp}]`. Each sequence is [32,126]. Per-hand features begin with absolute wrist xyz to preserve translation and relative hand separation. The remaining 20 xyz landmarks are relative to the wrist, divided by wrist-to-middle-MCP Euclidean distance. Slots are fixed Left then Right using MediaPipe handedness, with absent hands zero-filled. Handedness errors can still introduce noise; include hand-crossing and disappearance in evaluation. Recording is about 15 Hz but not a hard real-time sampling contract. A later study should resample using explicit per-frame timestamps.

## Train and tune
Python 3.11 is recommended. Use a virtual environment.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r ml/requirements.txt
python -m pytest ml -q
python ml/train.py train --data data/*.json --architecture mlp --out artifacts/baseline
python ml/train.py train --data data/*.json --architecture lstm --out artifacts/lstm
python ml/train.py train --data data/*.json --architecture transformer --out artifacts/transformer
python ml/train.py tune --data data/*.json --trials 20 --out artifacts/tuned
```

Training requires at least five participants and all four labels in each split. Eight or more participants are preferable. GroupShuffleSplit holds out 20% of people for test and 25% of remaining people for validation. The fixed seed reproduces splits for an unchanged participant set. Keep data immutable after splitting; windows from the same person never cross splits. Validation selects architectures and tuning settings; never use test results to choose them. The current search tunes architecture, hidden width, dropout, learning rate, weight decay and batch size; sequence length is fixed at 32 to match recording/inference.

`validation.json` contains configuration, participant split membership and learning curves. `trials.csv` records tuning trials. Checkpoints include model configuration and split membership. Exact dataset-content hashes and dependency lock files are future reproducibility improvements. Set a fixed hardware/software environment when comparing timings.

## Optimization and final evaluation
```bash
python ml/optimize.py --checkpoint artifacts/lstm/model.pt --data data/*.json --out artifacts/lstm/optimization.json
python ml/train.py evaluate --checkpoint artifacts/tuned/model.pt --data data/*.json --out artifacts/final
```

Optimization compares FP32 and dynamic INT8 on validation only. It does not replace the deployed checkpoint automatically, and INT8 export/deployment is not implemented here. Evaluate once after model/threshold decisions are frozen. The final report contains per-class metrics, confusion matrix, p50/p95 CPU model latency and checkpoint size. Latency excludes landmark extraction, transport and rendering. Add continuous-session testing to measure accidental commands/minute, command detection delay, robustness to hand loss, and confidence calibration before claiming usability. Softmax confidence is not calibrated probability of correctness.

## Serve your trained model
```bash
MODEL_PATH=artifacts/tuned/model.pt uvicorn serve:app --app-dir ml --host 127.0.0.1 --port 8000
```

Run the viewer locally on port 8080, then connect `http://localhost:8000` in ML Workspace. No model means `/health` reports `model_loaded:false` and `/predict` returns 503. Predictions accept exactly [32,126] finite features. Below 0.8 confidence or after stale/failed predictions the learned controller does nothing. This threshold is a starting heuristic; select it on validation streams.

A hosted HTTPS viewer may be blocked from calling a local HTTP API by mixed-content or private-network browser policies. For remote deployment use a trusted HTTPS endpoint, restrict `ALLOWED_ORIGINS` to the exact viewer origin, and add authentication/rate limiting before exposing it. The prototype API has no authentication and is intended for localhost. Do not expose it unchanged to the internet.

```bash
docker build -t apex-inference .
docker run --rm -p 127.0.0.1:8000:8000 -v "$PWD/artifacts:/app/artifacts:ro" -e MODEL_PATH=artifacts/tuned/model.pt apex-inference
```

## Understanding the ML
- **Parameters:** the weights learned by gradient descent.
- **Hyperparameters:** settings chosen outside training, such as hidden width and learning rate.
- **Baseline:** the MLP averages frames; LSTM/Transformer can learn temporal structure. A complex model earns its place only if it improves held-out generalization or a useful tradeoff.
- **Optimization:** INT8 may reduce size; speed depends on hardware and operators. Measure both speed and prediction quality.
- **Deployment:** preserve feature ordering and normalization, load once, validate inputs, measure end-to-end behavior, and retain a fallback.

## Next milestones
1. Collect real data, compare architectures, inspect errors and document findings in a model card.
2. Move hand tracking to a Worker if main-thread contention harms frame rate.
3. Add per-frame timestamps, explicit missing-hand masks and calibrated temporal hysteresis.
4. Add an approved, licensed, component-separated GLB asset for a specific car. Use the local GLB loader for a licensed asset; source a detailed component-separated model for bundled exact-car viewing.
5. Validate quantized export or ONNX, browser inference, model versioning, automated deployment and continuous gesture testing.

## References
- https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js
- https://threejs.org/docs/
- https://docs.pytorch.org/docs/stable/generated/torch.nn.LSTM.html
- https://docs.pytorch.org/docs/stable/generated/torch.nn.TransformerEncoder.html
- https://optuna.readthedocs.io/en/stable/tutorial/10_key_features/003_efficient_optimization_algorithms.html

Original code and educational geometry in this project are MIT licensed (see LICENSE). Third-party dependencies retain their own licenses. No official F1 assets, logos or CAD are included.

## Build 003: detailed licensed concept and immersive garage

The default asset is now Qvist_designs' independent F1 2026 concept (CC BY 4.0), using the prepared sixteen-assembly derivative credited in `dist/models/ATTRIBUTION.md`. This is not a Red Bull model. Red Bull/McLaren selections continue to switch reference metadata, not exact chassis geometry. The model has illustrative bodywork separation seams and no complete internal engine.

WebGL loads the full prepared geometry (1,217,296 triangles), packaged losslessly as gzip and decompressed in-browser. GPU-less SVG mode uses a much lighter convex-envelope silhouette proxy. That proxy intentionally fills cavities and loses small surface details. It is for interaction continuity, not detailed surface inspection. `dist/models/asset.json` records provenance and a full-asset checksum. All model credit, license and modifications are linked in the interface.

New controls: guided six-stop exterior tour; 16 individual selectable assemblies; focus/isolate/show-all; side/top/3D viewpoints; component labels; wireframe and fullscreen. Camera control is reached from the primary camera action and its settings drawer. Webcam verification remains dependent on a secure page and a real camera. The custom temporal model remains untrained.

Run `python scripts/test_assets.py` for model group/attribution/size checks, and `node test_gestures.mjs` for manipulation checks. To rebuild the software LOD, install `scripts/requirements-model.txt`, then run `python scripts/prepare-model.py`. The full source can be read from the gzip asset when no raw GLB is present. The prepared source derivative is credited separately from application code.

## Build 004: cursor inspection and technical reference

Hover the geometry to identify the visible component. A cursor tooltip gives a short function description; the side inspector shows engineering principles, subcomponents to inspect, design tradeoffs, interactions, model scope, and technical reading. Click the car or component list to pin the entry, then move into the inspector to read or follow sources. Hidden assemblies are excluded from ray-hit identification. Tooltips are clamped to the viewport, and raycasts are throttled.

All sixteen concept assemblies have original educational notes in `dist/parts-data.js`. References provide general engineering or current-team context; they do not turn the independent Qvist concept into that team's CAD. Seven original SVG schematic types illustrate wings, wheels, suspension, cooling, floor/diffuser, structural envelopes and exhaust flow. They are not to scale, do not verify manufacturing joints, and do not imply the asset contains missing internals. No forces, pressures, laminate properties or kinematics are inferred numerically from this model.

Engineering finish is now the default: neutral body panels, darker aero surfaces, rubber and metallic structural contrast. Original materials, optional study colours, x-ray context and wireframe remain available. Full-detail geometry is the existing WebGL asset; GPU-less browsers retain the labelled silhouette proxy. This update enriches technical interpretation, not the source CAD topology.

Run `node test_inspection.mjs` for visible-hit mapping, tooltip bounds, the 16-part data schema and schematic coverage. Hover on the actual car and click-to-pin were manually verified in the software-rendered browser preview.

## Build 005: See on Track and engineering tools

### Track mode

- A circuit selector contains the Jolpica historical catalogue (78 entries in the bundled snapshot). A separate 2026 API-calendar filter and a reference-layout filter keep current entries and geometry coverage visible.
- Forty MIT-licensed community reference layouts from Tomislav Bacinger's f1-circuits repository are mapped to catalogue IDs. All 23 circuit entries in the fetched 2026 API calendar have a layout; this is a statement about the fetched API, not a hard-coded claim about the original official season schedule. Historical variants, precise start/finish locations, surveyed racing lines, venue elevation and buildings are not verified or reproduced.
- Drag/orbit, wheel/pinch zoom, pan, overview/top view, follow-car mode, play/pause, replay rate and scrubbing work independently of the webcam. Leaving the camera explorer for Track or Engineering stops the camera.
- A/B selectors compare RB19 (2023), RB20 (2024), RB21 (2025), RB22 (2026) and MCL38 (2024). The recorded metric is the shortest reported fastest race lap by either driver of that constructor in the selected event. Its driver, lap number, date, time and published lap-average speed are retained. This is not qualifying pace or an intrinsic car performance estimate. Event conditions, driver, tyres, fuel and weather remain confounders.
- Refresh calls the public Jolpica result endpoint from the browser. A bounded bundled snapshot remains usable if the service is unavailable; missing results are unavailable. No top speed, throttle trace, braking trace or instantaneous corner speed is invented.
- The animation is explicitly illustrative: uniform path-distance motion using recorded lap duration when present, otherwise a labelled 90-second demo pace. The Qvist concept is reused as a marker; it is not each team's actual chassis. Road width and cars are enlarged for legibility. The path origin is not a verified official start line.

Data fetcher: `python scripts/fetch-track-data.py`. It fetches circuit metadata, the 2026 API calendar, source GeoJSON and constructor-specific result pages for the supported seasons, with pagination. Stored race data are an educational adaptation under CC BY-NC-SA 4.0; geometry has its own MIT licence. Both are attributed in `dist/data/ATTRIBUTION.md` and linked in the UI. The full circuit snapshot contains no driver birth dates or personal biographical fields.

### Engineering tools

Component notes now include an internal link to the Engineering page, alongside primary-source reading. Interactive, user-set SI assumptions demonstrate dynamic pressure, drag, downforce magnitude, drag power, constant-radius lateral acceleration and a simplified whole-car friction budget. A vector illustration distinguishes body sideslip beta from individual tyre slip angle alpha. Coefficients are illustrative, not fitted to the selectable cars; the calculator ignores tyre load sensitivity, combined slip, load transfer, banking and transient aero. It must not be used as a lap-time or spin predictor.

Source references include NASA Glenn's drag/lift explanations, F1 Insights on telemetry-derived tyre/balance analysis, and Jolpica's field documentation. No paid API key or generative chatbot is required.

Verification: `node test_track.mjs` checks all 40 paths, full current API-calendar layout coverage, parsing/formatting, real Monza constructor separation, unavailable-record handling and force/power speed scaling. Existing inspection/gesture/asset checks remain applicable. Browser checks cover track initialization, actual API refresh, selector changes and interactive physics output. No ML recognizer has been trained as part of this update.

## Monza sector timing pilot

This optional Worker adds a same-race comparison for Max Verstappen and Lando Norris at the 2024 Italian Grand Prix. The static viewer still runs independently. The Worker uses D1 with immutable revisions and an active-revision pointer. Lap and sector times are stored as integer milliseconds. Missing, inconsistent and pit-out timings are identified. Cumulative split gaps stop when either driver has a missing sector, while the finish gap uses the reported lap durations.

From the repository root, using Node 24 and Python 3:

```sh
node --test test_*.mjs timing/test_timing.mjs
npx wrangler d1 migrations apply apex-timing --local
python3 timing/import.py --fixture > /tmp/apex-monza.sql
npx wrangler d1 execute apex-timing --local --file /tmp/apex-monza.sql
npx wrangler dev
```

Open the local Worker and select **See on Track**. The sector table labels fixture data as synthetic. For local provider verification, run the importer without `--fixture` and apply its output using the same local command. The importer validates both 53-lap sequences before emitting SQL. Its content hash makes repeated imports idempotent. The import file is applied as one D1 batch. To restore a prior revision, update `timing_active.revision` to its verified ID. Export D1 and test restore before provisioning a public instance.

OpenF1 documents unauthenticated historical access. Public redistribution permission for this dataset has not been established. The repo includes a generated fixture and no provider response payloads. Before using a remote D1 database, replace the local placeholder database ID and confirm the intended data use with the provider. The hosted static Site has no timing database binding.

[OpenF1 documentation](https://openf1.org/docs/) · [D1 Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/d1/)

## Gesture capture and dataset versions

Collect a small pilot before recruiting the larger cohort. Use a pseudonymous participant ID, confirm consent, choose device and lighting, then record each of the four existing labels. Include idle windows with hands absent and with ordinary movement. Keep the consent register separate from the exports and store both privately. The browser exports 32 frames with elapsed milliseconds, hand presence and camera dimensions. Timestamp gaps above 250 ms require a new capture. During training, schema v2 windows are resampled onto an evenly spaced grid using nearest observed frames, preserving missing-hand slots. Existing schema v1 exports retain their original frames.

```sh
python ml/dataset.py data/*.json --out artifacts/dataset-v2.json
python ml/train.py train --data data/*.json --out artifacts/pilot
```

Create the output directory before freezing a manifest. Reordering files or samples preserves the manifest. Changes to any accepted recording or split assignment invalidate evaluation and optimization against an earlier checkpoint. Legacy checkpoints remain loadable by the inference service and require retraining for the new evaluation workflow.

For a withdrawal, remove the participant's private exports and any retained copies according to the consent agreement. Regenerate a new manifest with `--exclude PARTICIPANT_ID` if source files contain mixed participants, pass the same exclusion to training, evaluation and optimization, and retire affected datasets and checkpoints from future use. Do not commit recordings, consent records or private manifests.
