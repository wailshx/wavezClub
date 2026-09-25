import pathlib, re

ROOT = pathlib.Path("/home/wail-shx/Documents/elecite-club-hub")
API = ROOT / "src" / "lib" / "admin-admins-api.ts"

# Determine the true repo root from git to be safe (this is the CURRENT actively restored path).
try:
    root = pathlib.Path(
        __import__("subprocess").check_output(
            ["git", "-C", str(ROOT), "rev-parse", "--show-toplevel"]
        ).decode().strip()
    )
except Exception:
    root = ROOT
api = root / "src" / "lib" / "admin-admins-api.ts"

src = api.read_text(encoding="utf-8")

# --- Helper: remove a single whole-line by exact content ---
def remove_linetoken(s: str, token: str) -> tuple[str, bool]:
    lines = s.split("\n")
    out = []
    removed = False
    for ln in lines:
        if ln.strip() == token:
            removed = True
            continue
        out.append(ln)
    return "\n".join(out), removed

# 1) ADMIN_SECTIONS array member: exact standalone token
src, r1 = remove_linetoken(src, '"settings",')

# 2) SECTION_LABELS entry: exact standalone token
src, r2 = remove_linetoken(src, 'settings: "Site Settings",')

# 3) Server-fn block: from `/** Admin ("settings" section): upsert a single key. */` through
#    the `);` that closes getSiteHeroImage (content-anchored, drift-proof).
start_marker = '/** Admin ("settings" section): upsert a single key. */'
end_marker = "return heroRow?.value ?? null;"
i = src.find(start_marker)
removed3 = False
if i != -1:
    tail = src.find(end_marker, i)
    if tail != -1:
        # The block ends at the first `);` on its own line after end_marker's line.
        after = tail + len(end_marker)
        j = src.find("\n);\n", after)
        if j != -1:
            end = j + 4  # include the "\n);\n"
            # also consume a trailing blank line right after, if present
            if src[end : end + 2] == "\n\n":
                end += 1
            src = src[:i] + src[end:]
            removed3 = True

api.write_text(src, encoding="utf-8")
print("removed_member=%s removed_label=%s removed_block=%s" % (r1, r2, removed3))
print("bytes:", len(src))
