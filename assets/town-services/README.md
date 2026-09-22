# Komachi town services

Five original low-poly GLB assets matching the existing Komachi palette and landmark set.
Standalone models only. These assets are not registered with the game, and the kōban remains unchanged.

| File | Width × height × depth | Details |
| --- | --- | --- |
| `komachi-town-hall.glb` | 1.900 × 1.200 × 0.900 | Two-cell town hall, front clock, municipal flagpole, sheltered porch, bench and planter |
| `komachi-clinic.glb` | 0.940 × 0.857 × 0.940 | One-cell clinic, green plus, awning, sliding-door panels, waiting bench and rooftop air conditioner |
| `komachi-fire-station.glb` | 0.960 × 0.941 × 0.960 | One-cell fire station, hollow open bay, parked kei truck, service door, hose cabinet and roof siren |
| `komachi-kei-fire-truck.glb` | 0.310 × 0.310 × 0.518 | Separate dusty-red kei truck, pump locker, hose reel, ladder, mirrors and roof light bar |
| `komachi-community-centre.glb` | 0.960 × 0.837 × 0.940 | Optional one-cell centre, sage roof, entrance canopy, bench and wall-mounted town chronicle case |

All models use Y-up, +Z front, ground at Y=0 and game units. Town hall bounds include the flagpole and porch.
Materials are matte vertex colours, using the existing palette (the fire truck uses its muted rose-red).
Signs, clock markings, emblem and chronicle sheets are geometry. There are no texture dependencies.
Chronicle sheets have abstract lines and a book pictogram, not readable story text.
`manifest.json` records exact bounds, triangle counts and metadata.

## Named parts and future attachment points

- Town hall root extras: `entrance: [0, 0.1, 0.25]`, `newcomerStop: [0, 0.1, 0.35]` on the porch. The folder/person is not baked into the building.
- Clinic meshes `Clinic_Sliding_Door_Left` and `Clinic_Sliding_Door_Right`: translate each by its `userData.openOffset` to open. A dark entrance recess sits behind them; the building has no furnished interior.
- Fire station group `Parked_Kei_Fire_Truck`: a removable child, using the same model as the separate truck GLB. Its local parked position is `[-0.122, 0.058, -0.03]`. Remove it when substituting a moving truck to avoid a duplicate. Root extras include `vehicleExit` and `entrance`.
- Truck meshes `Wheel_Left_Front`, `Wheel_Right_Front`, `Wheel_Left_Rear`, `Wheel_Right_Rear` have local axle-centred origins. Rotate around local X to roll. The root's `wheelRadius` is 0.047.
- Community centre root extras include `entrance` and `chroniclePoint`; its display mesh is named `Town_Chronicle_Case`.

No simulation, resident visits, driving logic, animation clips, collision meshes or light effects are included.
Doors and wheels are prepared as separate parts for later animation. Buildings are exterior models, except for the simple open garage bay.

## Source and inspection

- Source: `src/town-services-kit.js`, exporting `TOWN_SERVICE_KINDS` and `createTownService(kind)`.
- Re-export: `node scripts/build-town-services.mjs`.
- Validate GLB loading, finite geometry, bounds, grounding, metadata and named parts; generate front/rear/detail renders: `node scripts/preview-town-services.mjs`.
- Interactive viewer: run `npm run dev` and open `/docs/town-services-preview.html`.
- Renders and validation report: `docs/town-services/`.

The viewer includes door-opening and empty-bay inspection controls. Gallery models share the same scale; single-model views are enlarged to show detail.
