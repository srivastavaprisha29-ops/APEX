# APEX — F1 Gesture Lab

**Explore a Formula One concept car, inspect its engineering, and interact through hand gestures.**

APEX is an interactive browser-based project combining 3D car exploration, circuit visualisation, educational engineering tools, and a custom gesture-recognition workflow.

[Open the hosted app](https://apex-gesture-lab-prisha.saltylake.chatgpt.site) · [GitHub repository](https://github.com/srivastavaprisha29-ops/APEX)

> The hosted app is documented as private and may require the owner's ChatGPT sign-in. The feature descriptions below reflect the existing project documentation; they are not an independent runtime verification.

## Experience

| Area | Capabilities described in the project documentation |
| --- | --- |
| **3D car inspection** | Select assemblies, view component notes, explore exploded views, isolate parts, and switch viewpoints, wireframe, or x-ray context. |
| **Gesture interaction** | Use hand landmarks for pinch-to-grab, open-palm rotation, two-hand scaling, and progressive disassembly. Mouse and touch controls are also supported. |
| **See on Track** | Explore circuit layouts, switch car profiles, compare recorded lap results, and orbit, pan, zoom, pause, or scrub the playback. |
| **Engineering tools** | Explore drag, downforce, drag power, cornering force, and sideslip through interactive examples and component schematics. |
| **ML workspace** | Record labelled landmark sequences for a custom gesture-recognition pipeline, with participant-separated evaluation. |

## How to explore

1. Open the hosted app using an authorised account.
2. Inspect the concept car and select components to read their technical notes.
3. Enable the camera to try gesture controls, or use mouse/touch interaction.
4. Open **See on Track** to explore circuits and recorded comparisons.
5. Use the engineering tools to inspect how changing an input affects the illustrative calculations.

Camera access requires browser permission and a secure context such as HTTPS or localhost. Internet access is needed for externally loaded dependencies and live data refreshes.

## Technical overview

The existing documentation identifies the following technologies:

| Layer | Technologies and role |
| --- | --- |
| Browser visualisation | Three.js for the interactive 3D experience |
| Hand tracking | MediaPipe hand landmarks and rule-based manipulation controls |
| Race information | Jolpica API and a bundled result snapshot |
| Circuit geometry | Community circuit GeoJSON |
| Custom ML workflow | Python, PyTorch MLP/LSTM/Transformer baselines, Optuna tuning, and FP32/INT8 benchmarking |
| Optional inference service | FastAPI, Uvicorn, and Docker packaging |

The custom recognizer is separate from the rule-based browser controls. No trained custom checkpoint or measured recognition accuracy is established by the available documentation.

## Source availability and local setup

The repository's existing README references a static viewer in `dist/`, an ML pipeline in `ml/`, and a detailed `PROJECT_GUIDE.md`. During preparation of this README, GitHub returned **404** for:

- `dist/index.html`
- `ml/requirements.txt`
- `PROJECT_GUIDE.md`

Local installation and training commands therefore remain unverified. Restore or publish the corresponding source files before documenting a reproducible setup. The hosted application and the repository may represent different source states.

## Understanding the results

- **Concept model:** The documented car asset is an independent Qvist 2026 concept. Switching constructor profiles changes reference information and colours; it does not load authentic team CAD.
- **Lap comparisons:** Recorded race laps reflect drivers, tyres, fuel, weather, traffic, and circuit conditions. They do not isolate intrinsic car performance. Lap-average speed is different from top speed.
- **Track playback:** Playback is described as uniform-distance animation using a recorded lap duration, with a labelled demo duration where timing is absent. It is not telemetry or a vehicle-dynamics simulation.
- **Engineering calculations:** Coefficients and assumptions are educational inputs, rather than validated parameters for a particular F1 car.
- **Camera interaction:** The camera view is a screen-space overlay. World-anchored augmented reality is not established.
- **ML evaluation:** Custom-model accuracy, end-to-end latency, and physical webcam usability require measured evaluation on collected data.

## Data and attribution

The existing project documentation specifies these licensing terms. Preserve the complete notices with any distributed source or assets.

| Material | Documented licence / attribution |
| --- | --- |
| Original application code and educational diagrams | MIT |
| Qvist_designs' *F1 2026 concept (polygon model)* | CC BY 4.0; attribution and derivative changes must be retained |
| Tomislav Bacinger's circuit GeoJSON | MIT; retain the original notice |
| Jolpica race data and adapted snapshot | CC BY-NC-SA 4.0; separate from the application code licence |
| Third-party dependencies | Their respective licences |

Verify that the corresponding licence and attribution files are present before redistributing the project. Formula One, FIA, teams, and asset creators do not endorse this project.

## Author

**Prisha Srivastava** · [GitHub](https://github.com/srivastavaprisha29-ops)
