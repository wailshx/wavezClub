import pathlib

ROOT = pathlib.Path("/home/wail-shx/Documents/elecite-club-hub")
api = ROOT / "src" / "lib" / "admin-admins-api.ts"
src = api.read_text(encoding="utf-8")
lines = src.split("\n")

report = {"sections_member": False, "labels_entry": False, "block": False}

# 1) ADMIN_SECTIONS array member: a standalone line `  "settings",`
i = 0
out = []
while i < len(lines):
    if lines[i].strip() == '"settings",':
        report["sections_member"] = True
        i += 1
        continue
    out.append(lines[i])
    i += 1
lines = out

# 2) SECTION_LABELS entry: a standalone line `  settings: "Site Settings",`
i = 0
out = []
while i < len(lines):
    if lines[i].strip() == 'settings: "Site Settings",':
        report["labels_entry"] = True
        i += 1
        continue
    out.append(lines[i])
    i += 1
lines = out

# 3) Server fn block: from the fence-comment that immediately precedes
#    `export const saveSiteSetting` through the `);` that closes getSiteHeroImage.
#    Anchor on content only; assert exact block membership so we never mis-cut.

# find start: the line containing 'Admin ("settings" section): upsert a single key'
start = None
for k, ln in enumerate(lines):
    if 'Admin ("settings" section): upsert a single key' in ln:
        start = k
        break
assert start is not None, "block start fence not found"

# find the line just above start that belongs to the block head? The fence comment
# `/** Admin ("settings" section): upsert a single key. */` IS the block head.
# Now find end = first `);` on its own line AFTER the last fn (getSiteHeroImage).
fn_start = next(k for k, ln in enumerate(lines) if ln.strip() == 'export const getSiteHeroImage = createServerFn({ method: "GET" }).handler(')
end = None
for k in range(fn_start, len(lines)):
    if lines[k].strip() == ");":
        end = k
        break
assert end is not None, "block end `);` not found after getSiteHeroImage"

# sanity: the block must contain the settings-only identifiers
block = lines[start : end + 1]
for ident in ("siteSettingsTable", "SiteSettingRow", "saveSiteSetting", "resetSiteSetting", "getSiteHeroImage"):
    assert any(ident in b for b in block), f"block does not contain {ident}"

report["block"] = True
del lines[start : end + 1]

api.write_text("\n".join(lines))
print("removed:", report)
print("old_lines=%d new_lines=%d" % (len(src.split("\n")), len(lines)))
