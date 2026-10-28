# Browser foundation

The game is an original, dependency-free Rust prototype. No recovered Dead Cells function is executed in the browser. The offline inspection tools are independent of the runtime build.

## Simulation boundary

`rogue-core` advances exactly one 1/60-second frame for each `World::step(input)` call. It has no clock, renderer, filesystem, network, browser or audio dependency. The browser accumulates elapsed time, caps a frame gap at 100 ms, and advances fixed ticks. Pausing discards accumulated time and clears pressed keys. Resuming never simulates the hidden interval.

The input bitfield is left=1, right=2, jump=4, attack=8, dodge=16, down=32. Opposing movement cancels. Jump, attack and dodge start on rising edges; holding attack cannot repeat it. Simultaneous attack/dodge favors dodge. Controllers and keyboard merge into the same bitfield.

Movement uses gravity, horizontal limits, one-way platform tops and six simulation frames of coyote time, a seven-frame jump buffer and ten-frame attack queue. Platforms do not block ascent or horizontal movement. Attacks have wind-up, an active window, and recovery; each enemy can be hit once per strike. Held jumps rise higher than tapped jumps. Three queued strikes form a combo with a stronger finisher. Dodge can cancel strike recovery and applies a fixed movement burst, invulnerability and cooldown. Down + Jump drops through a raised platform. Ground/air acceleration smooths directional changes. Enemies approach, telegraph, lunge and recover. Death freezes simulation. Clearing enemies unlocks the right exit; crossing it increments progression, heals one point and generates the next chamber. These are authored rules, not recovered parity.

Seeded xorshift32 chooses platform coordinates. Zero seeds normalize to one. Rendering particles and synthesized sounds do not affect simulation. Floating-point behavior is repeatable in this tested WASM build, but cross-platform bit-identical simulation is not claimed.

## Browser ABI

`reset(seed,best,cleared)` starts a run. `release_input()` clears held-input history and buffered actions without advancing simulation, so pausing does not create stuck inputs. `tick(input)` advances one frame. `entity(kind,index,field)` exposes rendering data; `kind=0` is the hero, `1` is an enemy and `2` is a platform. Actor fields are x/y/width/height/facing/hp/attack-ticks/dodge-ticks/invulnerability-ticks/vx, indexed 0–9. Platforms use fields 0–3. Invalid selectors return zero.

`stat(field)` exposes these integer fields:

| Index | Value |
| --- | --- |
| 0–2 | Hero health, score, room number |
| 3–4 | Enemy count, platform count |
| 5 | Events for the most recent tick |
| 6–7 | Best score, total cleared chambers |
| 8–9 | Room clear flag, dodge cooldown ticks |

Event bits are jump=1, attack=2, dodge=4, hit=8, kill=16, damage=32, death=64, room transition=128. Consume events after every tick, including catch-up ticks. A dead world's next tick clears events. `self_test()` runs the shared regression assertions and returns 14 on success; WASM traps indicate failure.

## Persistence and failures

IndexedDB database `ember-vault`, store `progress`, key `profile` holds `{version:1,best,cleared}` with unsigned 32-bit integer values. Version zero migrates best score and defaults cleared chambers to zero. Unknown versions or invalid records disable writes for that session. They are not erased. Database errors leave the run playable. Writes serialize and report transaction failure; saves occur on kills, death, room transitions and pause. Mid-run state is not persisted.

AudioContext is created/resumed after a click. Failure leaves silent gameplay. WASM download, status, validation and instantiation errors display a reload action. IndexedDB errors display a session-only status. Physical controller verification remains a separate manual check; automated tests simulate the Gamepad API.

## Packaging

`scripts/build.py` builds the locked WASM crate and copies the explicit `scripts/web-files.json` allowlist of browser modules and original art plus the WASM file into `dist`. It refuses unexpected existing distribution entries. `.vercelignore` excludes all research and installation content. The static Vercel configuration serves `dist`; the intended deployment is local build followed by CLI deployment, not a remote Rust build.

Asset-copy tooling validates the original archive SHA, reads only exact selected catalog entries, checks PNG/WAV/Ogg signatures and writes to ignored private research. It does not decode binary atlases/TMX, execute Haxe, or publish copied content.
