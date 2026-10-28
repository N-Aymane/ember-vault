# Ember Vault

A small browser action platformer with a Rust/WebAssembly simulation, original pixel-art characters, and an overgrown cathedral to fight through.

## Play

- **A / D or arrows:** move
- **Space:** jump; hold for height, tap for a short hop
- **J / left click:** strike; tap near recovery to queue a three-hit combo
- **K / Shift / right click:** dodge; cancels strike recovery
- **S / Down + Jump:** drop through a raised platform
- **Escape:** pause

Keyboard bindings, reduced motion and sound volume are available in **Controls**. Settings and high scores stay on your device. Touch controls and the standard Gamepad API are supported: stick/D-pad, A jump, X strike, B dodge, Start pause.

Defeat the sentries and reach the right-hand gate. New chambers add enemies. Death permits an immediate restart.

## Run locally

The checked-in `dist` directory is ready to serve:

```sh
python -m http.server 4173 --directory dist
```

Open `http://localhost:4173`. A static server is required; opening HTML directly from disk will not load WASM.

## Build from Rust source

Requires Rust with the `wasm32-unknown-unknown` target, Python 3.11+ and Node 20+. There are no Cargo or npm runtime dependencies.

```sh
rustup target add wasm32-unknown-unknown
python scripts/build.py
node --test tests/*.test.js
```

The simulation updates at 60 Hz. It includes coyote time, jump/attack buffering, variable jumps, acceleration, melee hit windows, dodge invulnerability, seeded platforms, room progression and versioned saves. Rendering, input, Web Audio and IndexedDB are browser adapters. See [architecture](docs/architecture.md).

## Deploy to Vercel

Import this repository into Vercel with Framework **Other**, no build command, and output directory **dist**. `vercel.json` already provides these settings. The repository includes the compiled WASM and approved original artwork, so Vercel does not need a Rust toolchain.

After source changes, run the build/tests and commit the updated `dist` files before pushing. Only the allowlisted static distribution is deployed; there are no server functions, secrets or cloud databases.

## Art and license

The environment and character artwork was generated specifically for Ember Vault. Sprite metadata uses individually measured crops and foot anchors; no proprietary game art is included. Bootstrap Icons retain their MIT license under `web/assets/icons/LICENSE`. Project code is MIT licensed.

This is an original combat prototype, not a full Dead Cells port. No original game installation, extracted assets, recovered bytecode, or private reverse-engineering reports are included in this public repository.
