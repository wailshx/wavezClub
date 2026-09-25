import sys, pathlib

# THE ONLY truth: the path passed on the command line. No pwd, no git discovery.
repo = pathlib.Path(sys.argv[1]).resolve()
api = repo / "src" / "lib" / "admin-admins-api.ts"
print(f"operating on: {api}  exists={api.exists()}")

src = api.read_text(encoding="utf-8")
old_lines = src.count("\n") + 1
report = {"sections_member": False, "labels_entry": False, "fn_block": False}

lines = src.split("\n")

# 1) ADMIN_SECTIONS array member `"settings",` (must be its own line)
out = []
for i, ln in enumerate(lines):
    if ln.strip() == '"settings",':
        report["sections_member"] = True
        continue
    out.append(ln)
lines = out

# 2) SECTION_LABELS entry `settings: "Site Settings",` (must be its own line)
out = []
for i, ln in enumerate(lines):
    if ln.strip() == 'settings: "Site Settings",':
        report["labels_entry"] = True
        continue
    out.append(ln)
lines = out

# 3) The server fns block: fence comment -> closing `);` of getSiteHeroImage.
try:
    start = next(i for i, ln in enumerate(lines) if ln.strip() == '/** Admin ("settings" section): upsert a single key. */')
    # locate the "single key" comment head inside block too (drift-proof)
    assert 'upsert a single key' in lines[start]
    # find the end: the `);` that closes getSiteHeroImage (line whose stripped == ');'
    # AND immediately follows the handler tail 'return heroRow?.value ?? null;'
    # Robust: scan from start to EOF, track the hero-image tail then the `);`
    hero_tail = None
    for i, ln in enumerate(lines):
        if 'return heroRow?.value ?? null;' in ln or 'return heroRow?.value' in ln or 'heroRow?.value' in ln:
            hero_tail = i
    assert hero_tail is not None, "hero tail not found"
    end = hero_tail + 1
    while end < len(lines) and lines[end].strip() != ');':
        end += 1
    assert end < len(lines), "block close `);` not found"
    report["fn_block"] = True
    lines = lines[:start] + lines[end + 1 :]
except StopIteration:
    report["fn_block"] = False

new_src = "\n".join(lines)
api.write_text(new_src, encoding="utf-8")
new_lines = new_src.count("\n") + 1
print(f"removals: {report}")
print(f"old_lines={old_lines} new_lines={new_lines}")
