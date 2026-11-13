"""Fetch the pinned CC BY 4.0 concept model used by APEX."""
import gzip
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

models = Path(__file__).resolve().parents[1] / "dist" / "models"
metadata = json.loads((models / "asset.json").read_text())
source = (
    "https://raw.githubusercontent.com/filan214/F1---2026-Car-Details/"
    "71fafa72b34bfbed07a01d8bc93b969246e7b4e2/dist/models/qvist-2026-assemblies.glb"
)

with urlopen(source, timeout=60) as response:
    model = response.read()
if hashlib.sha256(model).hexdigest() != metadata["full_glb_sha256"]:
    raise SystemExit("The downloaded model failed SHA-256 verification.")

destination = models / metadata["full_asset"]
temporary = destination.with_suffix(".tmp")
temporary.write_bytes(gzip.compress(model, mtime=0))
temporary.replace(destination)
print(f"Installed {destination.name}. See dist/models/ATTRIBUTION.md for credits.")
