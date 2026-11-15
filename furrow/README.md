# Furrow to Skyline

A mobile-first isometric city builder. You start with a riverside homestead in 1850 and grow it into a metropolis, working with advisors, the Governor, citizens and a Town Council that votes on everything, including what your buildings look like.

**Play:** open `index.html` in any modern browser (phone or desktop). No build step and no dependencies.

```sh
cd furrow
python3 -m http.server 8000   # then visit http://localhost:8000 (or your LAN IP from a phone)
```

On a phone, use "Add to Home Screen" to run it fullscreen like an app.

## Controls
- **Build:** pick a category at the bottom, then an item. Tap to place. Drag for roads, zones and fields.
- **Pan / zoom:** two fingers (or the 👆 Look tool with one finger). Mouse: right-drag + wheel.
- **Right-side buttons:** 👥 People · 🏛️ Council · ✉️ Letters · 🗺️ Map views · 🚁 Fly-over · ☰ Menu

## Files
| Path | What |
|---|---|
| `js/data.js` | Eras, buildings, zones, architectural styles, policies, council, advisors |
| `js/state.js` | Map generation, save/load |
| `js/sim.js` | Monthly simulation (food, demand, growth, land value, money, happiness) |
| `js/people.js` | Advisors, Governor missions, letters/events, citizen voices |
| `js/council.js` | Agendas, stances, lobbying, votes |
| `js/render.js` | Procedural isometric renderer (style-aware buildings, traffic) |
| `js/fly.js` | Helicopter fly-over mode |
| `js/input.js`, `js/ui.js`, `js/main.js` | Touch input, UI sheets, game loop |
| `tools/bot.js` | Headless balance test: `node tools/bot.js 60` |
| `CONCEPT.md` | Design document and roadmap |
