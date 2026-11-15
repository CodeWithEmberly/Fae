---
title: Furrow to Skyline: Game Concept
author: 🎯
status: Prototype v0.1
---

# Furrow to Skyline

*A mobile-first city builder in the classic isometric tradition. You start with a riverside farm and grow it into a metropolis. The focus is on the people who live there, the councils that govern it, and the architecture that records its history.*

**Author:** 🎯 · **Status:** playable prototype (v0.1)

---

## 1. Pitch

Spring, 1850. A farmhouse, three wheat fields and a dirt track on a river bend. Over the next century the player turns that homestead into a village, a town, a city, and finally a skyline. Growth follows the way real cities developed: farms first, then a market, brick main streets, rowhouses, apartment blocks and towers.

Most of the city builder genre treats people as a statistic. Here they are the second half of the game: advisors with names and opinions, a Governor who sets goals and sends letters, citizens who post their complaints in the Town Square, and a **Town Council** that has to be persuaded before any policy passes. That includes the building codes that decide what the city looks like.

## 2. Design pillars

| Pillar | What it means in play |
|---|---|
| **Grow like a real city** | Agriculture first. Each era raises the height limit, so density spreads from the center. |
| **People, not just numbers** | Every system has a face: advisors, Governor, council members, residents. |
| **Politics shapes the skyline** | Architectural codes go through council. Buildings keep the style they were built in, so blocks show the city's history. |
| **Built for thumbs** | One finger builds, two fingers pan. Bottom-sheet menus, 44px+ targets, no hover-only UI. |
| **Short sessions, long arc** | One game month passes every 2.4 s at 1x. A full century plays in about 20–30 minutes at speed. |

## 3. Core loop

1. **Plant & zone.** Farms make food and jobs. Residential zones fill with homes on their own.
2. **Listen.** Advisors flag problems. The Town Square shows the mood. Letters bring choices.
3. **Govern.** Each season the council meets. Persuade, deal, and vote on policies.
4. **Grow up.** Hit the population milestone and a new era unlocks buildings, policies and council seats.

## 4. Eras

| Era | Pop. | Max building | New in this era |
|---|---|---|---|
| 🌾 Homestead | 0 | Cottage | Wheat, orchards, pasture, barn, well, dirt roads |
| 🏡 Village | 60 | Family house | Shops, workshops, Farmers' Market, Grain Mill, **Meeting Hall → Town Council (3 seats)**, school, windmills |
| 🏘️ Town | 350 | Rowhouses / Main Street | Paved roads, power plant, police, fire, clinic, Town Hall, 4th council seat |
| 🏙️ City | 1,800 | Apartments / offices | Rail, hospital, university, solar, Grand Park, 5th council seat |
| 🌆 Metropolis | 7,500 | Towers / skyscrapers | Stadium, Harbor Beacon landmark |

Later eras import most food by rail, so farms matter less as a share of the economy but still pay well (Food Processing Plant, Market Day).

## 5. Systems (prototype)

- **Food:** production vs. consumption. Surplus is exported for cash, a deficit is imported at a premium and hurts happiness. Barns boost adjacent farms, mills boost wheat, greenhouses resist drought.
- **Demand (R/C/I):** jobs vs. workers, plus how attractive the city is. Shown as live bars.
- **Organic growth:** a zone grows when there is demand, a road within 2 tiles, enough land value for the next level and (level 3+) power. It declines when demand stays negative.
- **Land value:** distance to the civic center (farmhouse → Meeting Hall → Town Hall), water, parks, services, minus pollution.
- **Coverage:** water, parks, education, safety and health, each phased in by era.
- **Happiness → approval → political capital ⭐**, which is spent to sway the council.

## 6. People

### Advisors
Mabel Thornberry (Agriculture), Desmond Achebe (Treasury), Priya Raman (Planning), Rosa Delgado (Public Safety), Theo Lindqvist (Culture & Heritage). Each one reads the live simulation and gives prioritized advice. A red **!** on the People button means at least one is urgent.

### The Governor
Gov. Eleanor Castellane sets a chain of directives (feed the frontier, incorporate, pass an architectural code, found a university, build a skyline) with state grants as rewards.

### Letters (events with choices)
State Fair, drought, a developer offering to buy a farm near downtown, the railroad, an industrialist, petitions, newcomers arriving by ship, harvest festival, highway funds, heat wave. Each choice has tradeoffs and changes how council members feel about you.

### Town Square
A feed of resident posts generated from real conditions, a breakdown of what is driving the mood, and a **Town Forum** (once a year) that raises approval and names the top concern.

### Inspecting a home
Tap any building to meet a resident, see their job, and hear their opinion of the neighborhood.

## 7. Town Council

- Five factions, seated as eras unlock: **Farmers' Grange, Merchants' Chamber, Heritage Society, Workers' Union, Green Futures.**
- Each session draws a 3-item agenda from citizen petitions, advisors and council members, weighted toward the city's current problems. Enacted policies can come back up for repeal. The mayor may add one **Mayor's motion**.
- Each member shows 👍 / 👎 / 🤔 based on their faction's interests, their relationship with you, and lobbying.
- Tools: **Make the case** (spend ⭐1 to sway undecided members), **Strike a deal** (cash, targeted at one member), **Call the vote**, **Table it**.
- Undecided members swing with your approval rating. Members who lose a vote hold a grudge.

### Architectural codes (policies that change the look)
| Code | Look | Effect |
|---|---|---|
| Vernacular Timber (default) | Clapboard, gables, porches | — |
| Brownstone Heritage | Red-brown brick, stoops, cornices, rowhouse terraces | + residential land value |
| Art Deco Revival | Limestone and brass, setbacks, spires | + commercial demand |
| Garden City | Pale stucco, planted roofs, rooftop trees | + happiness, small cost |
| Glass & Steel | Curtain walls, mullions, reflections | faster tall growth, heritage grumbles |

New and upgraded buildings use the current code. Existing ones only change through occasional renovation. A city that went Brownstone, then Deco, then Glass shows all three eras side by side.

## 8. Fly-over (first step toward street roaming)

Tap 🚁 to pilot a news helicopter: virtual joystick, climb/descend, terrain-aware altitude ("Pull up!"). Fly low over homes and farms to **overhear residents**. This is the base for the planned street-level mode.

## 9. Mobile UX

- Bottom toolbar with categories, plus a tray of item cards showing cost and lock state.
- Build gestures: tap for single buildings (slide to adjust before release), drag a line for roads, drag a rectangle for zones and farms. A live preview shows cost and valid tiles.
- Two-finger pan and pinch from any tool. The 👆 Look tool pans with one finger.
- Bottom sheets for all menus (centered dialogs on tablets/desktop), with safe-area insets and haptic ticks.
- Installable as a PWA (manifest + icon). Autosaves to the device yearly and when the app goes to background.

## 10. Roadmap

**Next up**
- Street-level roaming: walk or drive a car through the grid, enter shops, talk to residents face to face.
- Helicopter missions (traffic reports, rescues, fire-spotting) tied to new disasters.
- Neighborhood districts with names, and per-district policies (e.g., Heritage District).
- Council members with personal storylines, elections, and a challenger for mayor.
- Day/night cycle with lit windows. Seasonal weather.

**Later**
- Multi-tile landmarks, transit lines, waterfront and harbor.
- Native wrapper (Capacitor) for App Store / Play Store. Cloud saves.
- Sound and music that change by era.

## 11. Tech notes

- Plain HTML/CSS/JS, no build step, no dependencies, no image assets. All art is procedural canvas drawing.
- `js/sim.js`, `js/people.js` and `js/council.js` have no DOM dependency, so balance can be tested headless: `node tools/bot.js 60` plays 60 years with a scripted mayor.
- Reference run with the bot: Village in about 1.5 years, Town about 5, City about 12, Metropolis about 35–50.
