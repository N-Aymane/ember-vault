"""Create a minimal, placeholder-only static deployment archive."""
import hashlib
import json
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
names = json.loads((root/'scripts/web-files.json').read_text(encoding='utf-8')) + ['rogue_web.wasm']
dist = root/'dist'
if sorted(p.relative_to(dist).as_posix() for p in dist.rglob('*') if p.is_file()) != sorted(names):
    raise SystemExit('Distribution differs from the approved static file allowlist')
wasm = (dist/'rogue_web.wasm').read_bytes()
if not wasm.startswith(b'\0asm\x01\0\0\0'):
    raise SystemExit('Invalid WebAssembly module')
artifacts = root/'artifacts'
artifacts.mkdir(exist_ok=True)
with zipfile.ZipFile(artifacts/'ember-vault-web.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in names:
        archive.write(dist/name, 'dist/'+name)
    archive.write(root/'vercel.json', 'vercel.json')
    archive.write(root/'.vercelignore', '.vercelignore')
manifest = {name: dict(bytes=(dist/name).stat().st_size, sha256=hashlib.sha256((dist/name).read_bytes()).hexdigest()) for name in names}
(artifacts/'distribution.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print(f'Packaged {sum(item["bytes"] for item in manifest.values())} static bytes; no installation payloads included')
