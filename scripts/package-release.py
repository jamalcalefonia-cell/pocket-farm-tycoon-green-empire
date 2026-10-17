"""Package editable source, landed assets, docs, test evidence and static dist without secrets."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib

root = Path(__file__).resolve().parent.parent
out = Path('/home/ubuntu/output')
out.mkdir(parents=True, exist_ok=True)
archive = out / 'pocket-farm-tycoon-green-empire-source.zip'
blocked_dirs = {'.git', 'node_modules', '.manus-webdev', '.cache', '.pnpm-store'}
blocked_files = {'.env', '.env.local', '.env.production', '.env.development', '.env.test'}
with ZipFile(archive, 'w', ZIP_DEFLATED, compresslevel=6) as bundle:
    for p in sorted(root.rglob('*')):
        rel = p.relative_to(root)
        if any(part in blocked_dirs for part in rel.parts):
            continue
        if p.is_symlink() or not p.is_file():
            continue
        if p.name in blocked_files or (p.name.startswith('.env.') and p.name != '.env.example'):
            continue
        if p.suffix in {'.log', '.zip'}:
            continue
        bundle.write(p, Path('pocket-farm-tycoon-green-empire') / rel)
with ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    names = bundle.namelist()
    for essential in ['src/main.ts', 'src/farm/engine.ts', 'src/farm/scene.ts', 'assets/farm/buildings/FBX__Barn.fbx', 'assets/share/icon.png', 'dist/index.html', 'dist/sw.js', 'README.md', 'TEST_RESULTS.md', 'package.json', 'pnpm-lock.yaml']:
        assert 'pocket-farm-tycoon-green-empire/' + essential in names, essential
    assert not any('/node_modules/' in n or '/.git/' in n or '/.env' in n for n in names)
print(archive)
print(f'{archive.stat().st_size} bytes; SHA256 {hashlib.sha256(archive.read_bytes()).hexdigest()}')
