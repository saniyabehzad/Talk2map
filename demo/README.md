# Talk2Map: Zurich demo

An interactive demo of the Talk2Map home finder. All data is synthetic and the map is schematic; nothing here comes from real datasets yet.

## Run it

No build step and no dependencies. Open `index.html` in a browser, or serve the folder:

```bash
cd demo
python3 -m http.server 8000
# open http://localhost:8000
```

Fonts load from Google Fonts; without a connection the page falls back to system fonts.

## Files

| File | What it does |
|---|---|
| `index.html` | Layout and styles (light and dark theme) |
| `model.js` | Synthetic world: schematic Zurich geometry, anchors, per-area scores (travel, noise, slope, sun, risk, tax), listings and the evaluation logic |
| `pictures.js` | Procedural illustrations per listing: building facade (with the listing's floor marked), living room, floor plan |
| `app.js` | UI: chat parsing, criteria sliders, agent trace and SQL preview, canvas map with layers, results list and detail view |

## What the demo shows

- Three personal places (Work A, Work B, Grandparents) with trips per week, ranked by **weekly travel time**
- A conversational request turned into explicit, editable criteria
- Agent steps: intent → place resolver → spatial SQL → critic → explainer, with the generated SQL
- A critic that proposes the cheapest relaxation when results are few
- Map layers: matches, weekly travel, night noise, slope, night heat, flood risk
- Per-listing breakdown: your week, quiet and sun, walking, risk, money

## Next steps

Replace `model.js` with real data from the pipeline described in `talk2map-spec-v0.1.md`: GTFS + r5py travel times, sonBASE noise, Sonnenfassade, swissALTI3D slope and canton Zurich hazard maps.
