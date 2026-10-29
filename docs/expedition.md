# Castle expeditions and loot

The castle now has nine connected locations, with branching paths and a finite boss encounter. This is an original game system; it does not execute recovered commercial-game code or use extracted assets.

```text
             Ramparts                         Chapel
            /        \                       /      \
Gatehouse             Armory -- Royal Gallery        Throne Hall -- Daybreak
            \        /                       \      /
             Undercroft                       Treasury
```

Use **M / Map** to inspect the discovered route and choose the next adjacent exit. Clear the room, then walk through its right-hand gate or interact near it. Interact at the left edge of a cleared room to return along your route. Room enemies, opened chests, dropped gear and used shrines retain their state, preventing respawn or loot duplication.

## Loot and progression

- Enemies drop magnetic gold. Elites and the Castellan drop keys. Healing drops restore health only when needed.
- Cleared rooms unlock chests. **E / Interact** opens a nearby chest or swaps a nearby weapon. The comparison panel shows damage difference, reach and strike duration.
- Emberblades are balanced, Violet Pikes reach farther, and Quicksteel strikes faster. Tempered, rare and legendary tiers increase damage. Power scrolls strengthen all weapons for the current run; the third combo strike deals double damage.
- The Armory vitality forge costs 35 gold once per run, adds one maximum health and heals two health. The Chapel restores full health and both flasks once. The Treasury chest consumes one key and awards legendary gear.
- **H / Flask** spends one of two flasks to restore up to three health. Full-health or cooldown attempts do not consume a charge.
- **Q / Rune burst** damages and interrupts nearby enemies, provides brief invulnerability and recharges over five seconds.
- Crypt and treasury ember vents telegraph before erupting. Jump above them or dodge through their active phase. Skirmishers are faster; elites hit harder; the Castellan becomes faster below half health.

Loot and equipment reset on death or a new expedition. Existing version-1 best-score and room-count saves remain compatible. In-progress runs are not serialized across reloads.

## Implementation

The fixed-step rules live in `crates/game-core/src/castle.rs` and the existing movement/combat core. Room generation derives each layout from the immutable castle seed and room ID; route order does not change a room's layout. A bounded nine-room cache retains room state. Core input bits add interact=64, heal=128 and rune=256. Browser controls preserve previous custom bindings while adding these actions.

The browser's `castle.js` defines names, map edges, item crops and displayed weapon comparisons. `expedition.js` renders the route map, loot, chests, shrines, hazards, loadout, comparisons and resource feedback. The WASM adapter exposes these capabilities through additional read-only stats/entities plus validated `choose_exit(index)` and `route(index)` functions. Choosing a map destination never teleports or skips combat.

Additional stat fields: 10 gold, 11 keys, 12 flasks, 13 weapon type, 14 tier, 15 power, 16 maximum health, 17 rune cooldown, 18 room ID, 19 theme, 20 seen rooms, 21 cleared rooms, 22 chest-open flag, 23 shrine-used flag, 24 victory, 25 nearby interaction, 26 loot count, 27 hazard count, 28 exit count, 29 selected exit, 30 damage, 31 strike duration, 32 reach, 33 backtracking availability, 34 nearby weapon type (99 if none), 35 nearby tier. Entity kind 3 exposes drops, kind 4 exposes vents. Actor fields 13/14 expose enemy type and maximum health.

## Validation

The `castle_test()` WASM regression suite covers 24 scenario groups including loot, resources, one-time chests/shrines, swapping, rarity stats, branching, cache preservation, keys, hazards, boss reward and victory. Existing movement/control/save tests still pass. Two additional end-to-end simulation tests play both castle routes using only public gameplay inputs and snapshots, through combat, loot, upgrades and boss victory. Browser verification exercises map selection, magnetic gold, chest opening, power collection, weapon comparison/swap, changing scenery/layouts, rune cooldown and flask consumption.

## New artwork

Built-in ImageGen produced these original project assets:

- `web/assets/undercroft.png`: blue-green rootbound crypts, violet braziers, vaulted masonry and a continuous flat floor; reference was the existing original vault artwork.
- `web/assets/ramparts.png`: moonlit open-air battlements, distant towers, amber braziers and a continuous flat floor; same art direction.
- `web/assets/loot.png`: transparent gold, healing flask, closed/open chests, ember sword, violet spear, power scroll and iron key. Actual source rectangles are measured in `castle.js`; no uniform-cell assumption is used.

The prompts required premium original handpixelart, orthographic side view, no UI/text/characters in backgrounds, and genuine transparency around each loot item. Source raster outputs are preserved; no proprietary payload was added to public packaging.
