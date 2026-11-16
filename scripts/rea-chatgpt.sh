#!/usr/bin/env bash
# Re-run the REA reverse-engineering pass over ChatGPT's web surface.
#
# Evidence is cloned to /tmp (not committed) because REA's JavaScript evidence
# graph for this corpus is ~43 MB. Edit EVIDENCE if you want it kept elsewhere.
#
# Requires: npm (rea-agents is a devDependency of this repo), git, python3
#
#   bash scripts/rea-chatgpt.sh
#
set -euo pipefail

EVIDENCE="${EVIDENCE:-/tmp/rea/evidence}"
OUT="${OUT:-/tmp/rea/out}"
REA=(npx --no-install rea-agents)

mkdir -p "$EVIDENCE" "$OUT"

clone() { # repo dir
  if [ ! -d "$EVIDENCE/$2/.git" ]; then
    echo "→ cloning $1"
    git clone --depth 1 -q "https://github.com/$1.git" "$EVIDENCE/$2"
  else
    echo "→ $2 already present"
  fi
}

clone jackwener/OpenCLI                        opencli     # modern JS client (updated 2026-11)
clone ChatGPTBox-dev/chatGPTBox                chatgptbox  # extension client
clone Zai-Kun/reverse-engineered-chatgpt       zaikun      # python, Sentinel + Arkose headers
clone acheong08/ChatGPT                        acheong08   # historical v1 client (2023)
clone h053698/openai-sentinel-pow-teardown    pow-teardown # Sentinel PoW teardown (Apr 2026 build, patched)

echo "→ importing source reference"
"${REA[@]}" import-reference-source "$EVIDENCE/zaikun" \
  --detail summary --outline-depth 2 --format json \
  > "$OUT/zaikun.json"

echo "→ static JavaScript analysis (this is the slow one)"
"${REA[@]}" analyze-javascript-application "$EVIDENCE/opencli/clis/chatgpt" \
  --format json --analysis-timeout-ms 120000 \
  > "$OUT/opencli-chatgpt.json"

echo "→ static JavaScript analysis, second pass (Sentinel/PoW client)"
"${REA[@]}" analyze-javascript-application "$EVIDENCE/chatgptbox/src/services/apis" \
  --format json --analysis-timeout-ms 180000 \
  > "$OUT/chatgptbox-apis.json"

echo "→ summarising"
python3 - "$OUT/opencli-chatgpt.json" <<'PY'
import json, sys, collections
d = json.load(open(sys.argv[1]))
nr = d["normalized_result"]
s = nr["statistics"]
g = nr["graph"]
print(f"evidence_id : {d['evidence_id']}")
print(f"root sha256 : {nr['root_artifact_sha256']}")
print(f"files       : {s['parsed_javascript_files']} parsed / {s['skipped_javascript_files']} skipped")
print(f"ast nodes   : {s['visited_ast_nodes']}   findings: {s['findings']}")
print(f"semantic    : {len(nr['semantic_graph']['nodes'])} nodes / "
      f"{len(nr['semantic_graph']['relations'])} relations")
print("endpoints:")
for n in g["nodes"]:
    if n.get("kind") != "endpoint":
        continue
    for o in n.get("observations", [])[:1]:
        p = o.get("properties", {})
        print(f"  - {p.get('value')}  [{p.get('resolution') or p.get('interpretation')}] "
              f"via {p.get('mechanism')}")
PY

echo
echo "Done. Evidence in $OUT — see docs/rea-chatgpt.md for the write-up."
