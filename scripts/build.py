"""Build a standalone WASM distribution; never packages private research assets."""
from pathlib import Path
import os
import json
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
env = os.environ.copy()
local = ROOT/'.tools/cargo/bin/cargo.exe'
if local.exists():
    env['CARGO_HOME'] = str(ROOT/'.tools/cargo')
    env['RUSTUP_HOME'] = str(ROOT/'.tools/rustup')
cargo = str(local) if local.exists() else shutil.which('cargo')
if not cargo:
    raise SystemExit('Install Rust and run: rustup target add wasm32-unknown-unknown')
subprocess.run([cargo, 'build', '--locked', '--release', '--target', 'wasm32-unknown-unknown', '-p', 'rogue-web'], cwd=ROOT, env=env, check=True)
dist = ROOT/'dist'
dist.mkdir(exist_ok=True)
allowed = json.loads((ROOT/'scripts/web-files.json').read_text(encoding='utf-8'))
unexpected = [p.relative_to(dist).as_posix() for p in dist.rglob('*') if p.is_file() and p.relative_to(dist).as_posix() not in allowed + ['rogue_web.wasm']]
if unexpected:
    raise SystemExit(f'Unexpected distribution files; inspect before publishing: {unexpected}')
for name in allowed:
    (dist/name).parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(ROOT/'web'/name, dist/name)
shutil.copyfile(ROOT/'target/wasm32-unknown-unknown/release/rogue_web.wasm', dist/'rogue_web.wasm')
print(f'Built {sum(p.stat().st_size for p in dist.rglob("*") if p.is_file())} bytes in {dist}')
