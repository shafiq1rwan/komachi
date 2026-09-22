# Komachi street-furniture kit

Seven original low-poly models to complement the town's Kenney characters. These are original
Komachi assets, not a copy of Kenney's City Kit Roads or Commercial packs. Since 2026-09-22 the town draws
its plaza furniture, bike racks, traffic lights and stop signs from this kit; simulation behaviour is unchanged.

| Model | Features | Triangles |
| --- | --- | ---: |
| `komachi-vending-machine.glb` | Twelve visible drinks, selection buttons, payment slot, pickup hatch and rear vents | 1,248 |
| `komachi-bench.glb` | Timber slats, metal frame, armrests, two seating positions | 308 |
| `komachi-bus-stop.glb` | Shelter, opaque frosted back panel, bench, timetable and bus sign | 690 |
| `komachi-traffic-light.glb` | Horizontal signal, separate coloured lenses, pedestrian indicators | 284 |
| `komachi-street-signs.glb` | Two direction boards and inverted triangular sign | 123 |
| `komachi-planter.glb` | Raised rim, recessed soil, stems, leaves and five flowers | 1,140 |
| `komachi-bike-rack.glb` | Three inverted-U hoops, footplates and connecting bar | 708 |

Self-contained GLBs with matte vertex colours and no textures. Y-up, front +Z, ground at Y=0.
All are static props. No vending, traffic-light sequencing, bus arrivals or seating behaviour is added.
Traffic lenses are named `Green_Lens`, `Amber_Lens` and `Red_Lens`; clone their shared material
before assigning independent light states. The preview shows the lens colours, not an active signal.

Scale is in game units: vending machine 0.4125 high, bench 0.46 wide, shelter 1.051 wide × 0.629 high,
signal 0.769 high, planter 0.378 wide, rack 0.44 wide. Bench seat surface is Y=0.114; shelter seat
surface is Y=0.139. Root extras provide `seats`, `bays`, `interactionPoint` or `pickupPoint` where relevant.

Source: `src/street-furniture.js`, exporting `createStreetFurniture(kind, optionalColor)`.
Export: `node scripts/build-street-furniture.mjs`.
GLB checks and front/rear renders: `node scripts/preview-street-furniture.mjs`.
Interactive preview: `docs/street-furniture-preview.html`, served through Vite.
