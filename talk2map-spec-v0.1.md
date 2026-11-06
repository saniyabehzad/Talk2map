# Talk2Map: Spec v0.1 (Zurich home finder)

*Status: draft · 2026-11-06 · Owner: Saniyabehzad

## 1. Vision

A conversational home finder for Zurich. The user describes the life they want ("max 25 min to both my offices, quiet at night, flat walk to the tram, no flood risk") and Talk2Map finds the **areas** that match, then the **listings** inside them, and explains every match.

Differentiators against the portals (Homegate, ImmoScout24, Flatfox):
- **Personal anchors.** The ranking is about *your* week, not the distance to the city centre.
- **Location intelligence from Swiss open data**: noise, sun, slope, risk, tax and daily life, scored per building.
- **Transparent agent.** It shows its assumptions, data sources and why each listing matched.

Out of scope for v1: view analysis, fibre/5G (near-universal in the area), real listing feeds.

## 2. Scope

- **Area:** City of Zurich plus the first ring of municipalities that border it.
  - Determined in code: municipalities whose boundary touches Zurich's (swissBOUNDARIES3D, `ST_Touches`).
  - Expected list, to verify: Adliswil, Dübendorf, Fällanden, Kilchberg, Maur, Oberengstringen, Opfikon, Regensdorf, Rümlang, Schlieren, Stallikon, Uitikon, Urdorf, Wallisellen, Zollikon.
- **Unit of analysis:** the residential building (EGID), with dwelling-level detail from the building register (GWR).
- **CRS:** LV95 (EPSG:2056) for all storage and metric operations. Convert to WGS84 only for display.

## 3. User profile

| Field | Notes |
|---|---|
| `anchors[1..3]` | Label, type (work / school / family / leisure / other), location (address or map pin) |
| `anchor.trips_per_week` | Used for the weekly time budget |
| `anchor.departure_time` | Default: weekday 07:45 (outbound); return trip assumed at 17:30 |
| `anchor.modes` | Public transport, car, or both |
| `preferences` | Weights or thresholds per score (§4). Set in conversation or as sliders |
| `household` | Optional: pram or reduced mobility (stairs filter), children (school catchment area) |

**Profile setup job:** when anchors are saved, compute personal scores for all buildings in scope. Expect 2–3 minutes, shown as progress in the UI. The result is stored as the user's view (§6). It is recomputed when anchors change or the GTFS feed version changes.

## 4. Scores

### 4.1 Personal scores (per user × building × anchor)

| Score | Method | Unit |
|---|---|---|
| `pt_minutes` | r5py TravelTimeMatrix, Swiss GTFS, median over a 60-min departure window | min |
| `car_minutes` | r5py car mode (OSM speeds, free-flow) × **peak multiplier** (configurable, default 1.3, to calibrate) | min |
| `weekly_travel_minutes` | Σ anchors (trips/week × 2 × chosen-mode minutes) | min/week |
| `walk_max_grade_to_anchor` | Max sustained gradient on the walking legs of the public transport trip (r5py DetailedItineraries). **Shortlist only** (top ~300 buildings), at query time or in a deferred job | % |
| `walk_steps_to_anchor` | Whether the walking legs include `highway=steps` | bool |

### 4.2 Static scores (per building, precomputed offline)

| Group | Score | Method | Unit |
|---|---|---|---|
| Slope | `max_grade_to_nearest_stops` | Walking route to the nearest 3 stops; max sustained gradient | % |
| Slope | `max_grade_300m_network` | Max sustained gradient on the walking network within 300 m of the building, measured along streets | % |
| Slope | `steps_within_300m` | Number of stair segments on the shortest routes to stops | count |
| Noise | `noise_road_day/night` | sonBASE road noise, max at the building facade | dB(A) |
| Noise | `noise_rail_day/night` | sonBASE rail noise | dB(A) |
| Noise | `noise_air_day/night` | sonBASE civil aviation noise | dB(A) |
| Sun | `winter_sun_best_facade` | Sonnenfassade monthly values, December irradiation on the best facade | kWh/m² |
| Tax | `tax_rate_total` | Municipal tax rate (incl. school) + cantonal rate | % of simple tax |
| Daily life | `walk_min_supermarket/pharmacy/gp` | OSM POIs, network walking time | min |
| Daily life | `school_catchment` | City school districts; nearest primary school as fallback in the ring | id / min |
| Daily life | `green_space_min` | Walking time to the nearest park or forest edge (OSM, swissTLM3D) | min |
| Risk | `runoff_depth_t30/t100/t300` | Canton ZH runoff map 2025, max depth at the building footprint | cm |
| Risk | `flood_hazard_level` | Canton ZH hazard map (river and lake) | class |
| Risk | `night_heat_class` | Canton ZH climate model 2024, night analysis map (+ future scenario) | class |
| Risk | `contaminated_site` | Canton ZH register of contaminated sites, plot listed + category | bool / cat |

**Slope definition.** Sample swissALTI3D every 10 m along OSM walking edges. The gradient is computed over a ≥ 20 m moving window, both directions are scored, and the "homeward uphill" value is reported. Stairs are flagged separately and excluded from the gradient.

**Floor adjustment (v1.1).** GWR provides the floor per dwelling. Apply simple corrections to noise and sun for higher floors.

## 5. Data sources and licences

| Dataset | Provider | Use | Licence / status |
|---|---|---|---|
| GTFS timetable 2026 (+2027 when published) | opentransportdata.swiss | Public transport routing | Open, attribution · ✅ |
| OSM Switzerland extract | Geofabrik | Walking and road network, POIs | ODbL · ✅ |
| swissALTI3D (0.5 / 2 m) | swisstopo | Slope | Open, attribution · ✅ |
| swissBUILDINGS3D 3.0 (EGID) | swisstopo | Building footprints/EGID | Open, attribution · ✅ |
| swissBOUNDARIES3D | swisstopo | Municipalities, first ring | Open, attribution · ✅ |
| GWR buildings + dwellings | BFS | Rooms, area, floor, construction year, heating | Open (public extract) · verify fields |
| sonBASE road / rail / aviation | BAFU | Noise | Verify download formats/licence |
| Sonnenfassade (monthly) | BFE | Winter sun | Open, attribution · ✅ |
| Runoff map 2025 | Canton ZH | Risk | OGD, attribution · ✅ |
| Hazard map / water depths | Canton ZH | Risk | OGD · ✅ |
| Climate model 2024 | Canton ZH | Night heat | OGD · ✅ |
| Register of contaminated sites | Canton ZH | Risk | OGD · ✅ |
| Municipal tax rates | Canton ZH statistics | Tax | OGD · verify dataset |
| School districts | City of Zurich | Daily life | Verify availability |
| Rent statistics by neighbourhood | City/Canton ZH statistics | Synthetic price model | Verify |
| Radon map | BAG | (dropped for v1; low variance in scope, licence marked proprietary) | — |

Every score in the UI carries its source and "data as of" date.

## 6. Data model (DuckDB + GeoParquet)

```
building(egid PK, bfs_nr, municipality, geom_footprint, geom_centroid, floors, year_built, heating)
dwelling(ewid PK, egid FK, floor, rooms, area_m2)
static_score(egid FK, <all §4.2 columns>, computed_at, source_versions JSON)
user_profile(user_id PK, household JSON, preferences JSON, created_at)
user_anchor(anchor_id PK, user_id FK, label, type, geom, trips_per_week, departure_time, modes)
user_view(user_id, egid, anchor_id, pt_minutes, car_minutes, walk_max_grade, walk_steps,
          gtfs_version, computed_at)          -- materialised at profile setup
user_view_summary(user_id, egid, weekly_travel_minutes, worst_anchor_minutes)
listing(listing_id PK, ewid FK, egid FK, type rent|buy, price_chf, rooms, area_m2, floor,
        available_from, is_synthetic BOOL)
```

## 7. Pipelines

1. **Offline static build** (run per data release)
   - ingest → clip to scope → LV95 → walking graph with gradients → per-building static scores
   - written to `static_score.parquet`
2. **Profile setup job** (per user, ~2–3 min)
   - r5py matrix (all buildings → 3 anchors, public transport + car)
   - writes `user_view` and `user_view_summary`
3. **Shortlist enrichment** (per query, on demand)
   - detailed itineraries for the top ~300 buildings → walking slope and stairs to each anchor
   - cached in `user_view`
4. **Refresh triggers:** anchor edit, new GTFS version, new static data release

## 8. Agents

| Agent | Responsibility | Tools |
|---|---|---|
| Orchestrator / planner | Breaks the request into steps, routes it; fast path for simple queries | — |
| Intent agent | Turns vague words into explicit, editable criteria and shows them ("quiet" → road night ≤ 45 dB, to verify against LSV ES II values) | Criteria vocabulary |
| Place resolver | Multilingual geocoding (Zürich/Zurich/Zurigo), anchors, neighbourhoods | geo.admin search API |
| Spatial SQL agent | Filters and ranks over `static_score` ⨝ `user_view` ⨝ `listing` | DuckDB (read-only) |
| Routing agent | Shortlist enrichment, ad-hoc travel times | r5py |
| Critic | Empty or absurd results, CRS/unit errors, aggregation level; proposes relaxations ("+42 if 30 min") | Dry-run SQL, sanity rules |
| Explainer | Map layers, per-listing "why it matched" cards, risk profile always shown, sources | Map renderer |

Guardrails: read-only SQL, result limits, every threshold shown to the user, risk is indicative only ("see official source"), and synthetic listings are always labelled.

## 9. Example flow

> "3.5 rooms to rent under 3,800, max 25 min to both offices, quiet at night, no steep walk to the tram, low flood risk."

1. Intent: rooms ≥ 3.5, rent ≤ 3800, pt_minutes ≤ 25 for anchors A and B, road+rail night ≤ 45 dB, `max_grade_to_nearest_stops` ≤ 6 %, runoff_t100 = 0 and hazard = none. All shown to the user.
2. SQL over `user_view` ⨝ `static_score` → N buildings → join listings.
3. Critic: if fewer than 5 results, proposes the cheapest relaxation.
4. Shortlist enrichment: slope on the actual walk to each anchor.
5. Explainer: heat map of matching areas, listing pins, cards (e.g. "A 18 min · B 22 min · 41 dB night · max 4 % to tram · no flood risk · tax rate 119 %").

## 10. Stack

Python 3.12 · DuckDB + spatial · GeoPandas/Shapely · rasterio · OSMnx/NetworkX · r5py (Java 21) · H3 (aggregation for area maps) · LangGraph · Streamlit or FastAPI + deck.gl/MapLibre · pytest.

## 11. Milestones

- **M1: Data foundation.** Scope polygon, buildings + GWR, walking graph with gradients, noise ×3, winter sun, risk, tax → `static_score`.
- **M2: Profiles.** Anchor setup, r5py public transport + car matrix, `user_view`, weekly travel budget.
- **M3: Agent loop.** Intent → SQL → critic → explainer, with a map UI.
- **M4: Listings.** Synthetic listings on real GWR dwellings with a price model.
- **M5: Enrichment and polish.** Shortlist walking slope, stairs, daily life, floor adjustment.
- **M6: Evaluation.** 50–100 benchmark questions with reference answers; ablation with and without the critic.

## 12. Risks and open questions

- Calibrate the car peak multiplier (compare against published peak travel times for a sample of routes).
- sonBASE download formats and licence: confirm.
- School district data for first-ring municipalities may be missing: fall back to the nearest school.
- r5py memory needs for the GTFS extract: clip the feed to the scope area plus a buffer.
- Legal wording for the risk layer (indicative, not an assessment).
- Synthetic price model realism: validate against published rent statistics.
