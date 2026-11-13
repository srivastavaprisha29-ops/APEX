# Data provenance and licences

## Race results and circuit catalogue

Source: Jolpica-F1 API, https://api.jolpi.ca/ergast/f1/
Documentation: https://github.com/jolpica/jolpica-f1/tree/main/docs
Data terms: https://github.com/jolpica/jolpica-f1/blob/main/TERMS.md
Data licence: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International,
https://creativecommons.org/licenses/by-nc-sa/4.0/

The bundled `racing-snapshot.json` is a non-commercial educational adaptation of the Jolpica data and is distributed under CC BY-NC-SA 4.0. Changes: selected constructor/season results, retained racing fields, omitted unrelated driver biographical fields, and combined circuit and calendar records. Fetch timestamp and source endpoint are recorded in the file. This data licence is separate from the application's MIT code licence.

## Reference circuit layouts

Source: https://github.com/bacinger/f1-circuits
Creator: Tomislav Bacinger
Licence: MIT; complete notice retained in CIRCUIT-LICENSE.md.
The source GeoJSON is bundled unchanged as `circuit-layouts.geojson`.
The application projects its coordinates to a local flat view, normalizes display scale, adds an illustrative road ribbon and uniform-pace concept-car markers. Layout versions and metadata may differ from the circuit used in a particular race year. No surveyed racing line, elevation or venue buildings are included. No F1, FIA or team endorsement is implied.
