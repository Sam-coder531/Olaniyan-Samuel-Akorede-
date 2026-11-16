# Reverse-engineering ChatGPT's web app with REA

**Date:** 2026-11-16 · **Branch:** `arena/b456c74f-olaniyan-samuel-akorede`
**Tool:** [REA — Reverse Engineer Anything](https://github.com/morluto/rea) (`rea-agents` v6.9.0, CLI reports 6.7.0, MIT) · installed here as a devDependency and registered as an MCP server (`.mcp.json`, 207 tools).

---

## 1. What I actually ran

| Step | Command | Result |
|---|---|---|
| Install | `npm install --save-dev rea-agents` | 249 packages, CLI live at `npx rea-agents` |
| Register | `npx rea-agents mcp add --no-global` | wrote `.mcp.json`; `mcp doctor` → **healthy**, 207/207 tools, protocol 2025-11-25 |
| Readiness | `npx rea-agents doctor` | Node 22.22.3 ✅, Debian 12 ✅; Hopper/Ghidra/IDA/jadx ❌ (not needed for web work) |
| Evidence import | `rea import-reference-source /tmp/rea/evidence/zaikun` | `hsm_be31e22d…`, 17 files, 90 160 bytes, git head `b10cee12` |
| JS analysis | `rea analyze-javascript-application /tmp/rea/evidence/opencli/clis/chatgpt` | evidence `ev_b8a35e95…`, root sha256 `4ff04ad2…` |
| JS analysis (2nd pass) | `rea analyze-javascript-application /tmp/rea/evidence/chatgptbox/src/services/apis` | evidence `ev_ec3389af…` — 15 files, 12 130 AST nodes, 178 findings |

REA's own counts for the JavaScript analysis:

- 23 files parsed, 0 skipped, 392 274 bytes read
- **36 405** AST nodes visited, **468** findings
- semantic graph: **23 706** nodes / **25 153** relations
- 10 network-endpoint nodes, 514 graph edges, 649 fingerprints

Reproduce end-to-end with `scripts/rea-chatgpt.sh`.

---

## 2. Important limitation — read this first

**This is not a live capture of chatgpt.com.** This sandbox can only reach `github.com`, `npm` and `PyPI`; `chatgpt.com` is unreachable (connection refused/DNS-blocked), and no Chromium/Playwright browser is installed (browser binaries come from a blocked CDN). REA's capture commands (`capture-web-screenshot`, `analyze-web-bundle`, `observe-web-session`) all require a loopback CDP browser, so they could not run here.

What I did instead — the honest version of the job:

1. Pulled four **third-party clients that speak ChatGPT's private web API** from GitHub (the only reachable mirror of that protocol surface).
2. Ran **REA's static analysis** over them (`analyze-javascript-application`, `import-reference-source`) and mined the resulting evidence graph.

So: **the findings below describe ChatGPT's web protocol as reconstructed from clients, not from packets I captured off OpenAI.** Treat them as a map, and see §6 for how to upgrade this to a real capture.

### Evidence sources

| Repo | Head commit date | Role |
|---|---|---|
| [jackwener/OpenCLI](https://github.com/jackwener/OpenCLI) | 2026-11-08 | modern JS client, current surface — **primary target of REA's JS analysis** |
| [ChatGPTBox-dev/chatGPTBox](https://github.com/ChatGPTBox-dev/chatGPTBox) | 2026-11-13 | browser-extension client, error strings (arkose, custom API paths) |
| [Zai-Kun/reverse-engineered-chatgpt](https://github.com/Zai-Kun/reverse-engineered-chatgpt) | 2024-04-07 | Python client, Sentinel + Arkose headers |
| [acheong08/ChatGPT](https://github.com/acheong08/ChatGPT) | 2023-08-02 | historical v1 client (PUID, moderation) — **stale, for contrast only** |
| [h053698/openai-sentinel-pow-teardown](https://github.com/h053698/openai-sentinel-pow-teardown) | 2026-08-25 | Sentinel PoW teardown — Python reimplementation of an **April 2026** build, self-declared *patched* |

---

## 3. Findings

### 3.1 Two origins, two auth worlds

Everything splits across a public Next.js app and a private backend:

- **`/api/auth/session`** — NextAuth session endpoint. Returns JSON containing `accessToken`. REA resolved this as a literal endpoint node from `opencli/clis/chatgpt/auth.js` and `utils.js` (`mechanism: call:fetch`, `resolution: partial`).
- **`/backend-api/*`** — the private API. Authenticated with `authorization: Bearer <accessToken>` taken from that session call.

`opencli` shows the exact sequence: collect the whole cookie jar, call `/api/auth/session`, pull `session.accessToken`, then build `backend-api` headers. If `accessToken` is absent it reports `missing-access-token` — i.e. **the session cookie alone is not enough for `backend-api`; the bearer token is minted by the session endpoint.**

### 3.2 The conversation endpoint

```
POST   https://chatgpt.com/backend-api/conversation          # send a message, SSE stream back
GET    https://chatgpt.com/backend-api/conversation/{id}      # read history for a thread
GET    https://chatgpt.com/backend-api/conversation/{id}/stream_status
```

REA recovered the first two as template-literal endpoint nodes (`` `${CHATGPT_URL}/backend-api/conversation/${conversationId}` `` — `call:fetch`, `resolution: partial`) out of `clis/chatgpt/utils.js`.

The Python client (`zaikun/re_gpt/async_chatgpt.py`) shows the request shape:

- response is consumed as a **stream of chunks** (`content_callback` per chunk → `AsyncGenerator[bytes, None]`), which is how ChatGPT renders tokens incrementally;
- a **WebSocket variant** exists: the POST returns a `websocket_request_id`, and the client then completes the turn over a socket (`send_websocket_message`), raising `UnexpectedResponseError` if the id is missing.

### 3.3 Model + reasoning-effort control

```
PATCH /backend-api/settings/user_last_used_model_config?model_slug=…&thinking_effort=…
```

Observed live in `opencli`: it `PATCH`es this with `model_slug` and `thinking_effort`, and only accepts `body.success === true`. The current model is read back out of the page's own React state — the client `page.evaluate`s its way into the model-picker entry list rather than calling an endpoint, which is a good reminder that **the UI keeps authoritative state in the client graph, and the "API" is only half the app**.

Older clients show the same idea with different knobs: `zaikun` carries a model table (`gpt-4` → `needs_arkose_token: true`, `gpt-3.5` → `text-davinci-002-render-sha`), `acheong08` has `history_and_training_disabled` and moderation paths.

### 3.4 The anti-automation layer (why cloning this is a dead end)

Three separate gates show up in the evidence:

1. **`openai-sentinel-chat-requirements-token`** — a header fetched before each conversation POST (`zaikun` sets it on every request via `create_chat_requirements_token()`). It is issued after a client-side challenge, and it is what makes naive re-implementations fail.
2. **Arkose** — `arkose_token` is sent in the request body (`zaikun` line ~263/298, `acheong08` `get_arkose_token()`), gated per-model; `chatGPTBox` even ships user-facing strings for "Failed to get arkose token." in 10+ locales.
3. **Device / account identity** — `PUID` cookie (`acheong08`, "You are a Plus user!"), plus the full browser fingerprint surface `opencli` replays: `cookie`, `origin`, `referer`, `accept-language`, `sec-fetch-dest/mode/site`, and a pinned Chrome `user-agent`.

A second pass with REA recovered the **entire** gate — challenge, proof-of-work, and the exact headers — out of `chatGPTBox`'s current client. See **§3.6**.

**Do not treat this section as a how-to.** These controls exist to enforce OpenAI's terms; circumventing them is a terms violation, and a client built on them breaks the next time the challenge rotates. Use the official API (§6).

### 3.5 Other endpoints visible in the evidence

| Endpoint | Meaning |
|---|---|
| `/backend-api/bootstrap` | first-load config bundle |
| `/backend-api/files`, `/backend-api/files/{id}` | uploads |
| `/backend-api/uploaded/{…}`, `/backend-api/generated/{…}` | attachment and generated-image assets |
| `patchUrl` (dynamic) | REA flagged this as a partially-resolved `fetch` target — value built at runtime |

REA also emitted 5 **candidate** endpoint nodes from `opencli`'s command surface — `chatgpt/ask`, `chatgpt/send`, `chatgpt/new`, `chatgpt/deep-research-result`, `chatgpt/project-file-add` — labelled `interpretation: candidate`, `authority: static-relationship-inference`. Those are REA being honest about confidence: they are inferred names in the client, not confirmed URLs. **That confidence labelling is the single most useful thing REA does** — it separates "observed in the AST" from "guessed by inference".

### 3.6 Second pass — the Sentinel gate, end to end

Source: `chatgptbox/src/services/apis/chatgpt-web.mjs` (repo committed 2026-11-13), analysed by REA as evidence `ev_ec3389af…`. This is the current, *live* shape of the handshake.

**Step 1 — pre-flight challenge.** Before a message is sent, four calls fire in parallel:

```
GET  /backend-api/models                              → available model slugs
POST /backend-api/sentinel/chat-requirements          → { token, proofofwork: { seed, difficulty, required }, arkose: { required } }
GET  /backend-api/accounts/check/v4-2023-04-27        → contains "shared_websocket"? then use the socket path
     (arkose endpoint, user-configured URL)           → { token }
```

REA resolved `/sentinel/chat-requirements`, `/models`, `/accounts/check/...`, `/stop_conversation`, `/backend-api/files/{id}/download` and a `wss_url` WebSocket target as endpoint nodes in this pass.

**Step 2 — proof of work.** If `proofofwork.required`, the client brute-forces a nonce:

```
config = [ screen, parseTime, 4294705152, nonce, userAgent,
           "https://tcr9i.chat.openai.com/v2/…/api.js", "dpl=1440a687…",
           "en", "en-US", 4294705152, "plugins−[object PluginArray]",
           reactListeningKey, act ]

for i in 0..200_000:
    config[3] = i
    base = base64(JSON.stringify(config))
    if hex(sha3_512(seed + base))[:len(difficulty)] <= difficulty:
        return "gAAAAAB" + base          # the Openai-Sentinel-Proof-Token
```

Three things stand out:

- **It is SHA3-512 over `seed + base64(fingerprint)`**, compared as a *hex-prefix* against the server's `difficulty` string — a classic hashcash, with the difficulty sent per-request.
- **The fingerprint is the point.** Screen resolution, `Date().toString()`, a fake `plugins` string, React's internal `_reactListening…` key and an event name are all baked into the hashed payload. The PoW is not just "burn CPU" — it binds the solution to a claimed browser environment.
- **There is a hardcoded fallback** (`'gAAAAABwQ8Lk5FbGpA2NcR9dShT6gYjU7VxZ4D' + base64('"seed"')`) when no nonce is found in 200k tries — the client would rather send *something* than fail.

**Step 3 — the request.** Headers on `POST /backend-api/conversation`:

| Header | Value |
|---|---|
| `Authorization` | `Bearer <accessToken>` from `/api/auth/session` |
| `Cookie` | the whole `chatgpt.com` cookie jar |
| `Openai-Sentinel-Chat-Requirements-Token` | `requirements.token` from step 1 |
| `Openai-Sentinel-Proof-Token` | the PoW result, when required |
| `Openai-Sentinel-Arkose-Token` | Arkose token, only when `requirements.arkose.required` |
| `Oai-Device-Id` | value of the `oai-did` cookie |
| `Oai-Language` | `en-US` |

Body: `action: "next"`, `conversation_id`, `messages[{id, author.role, content:{content_type:"text", parts:[…]}}]`, `conversation_mode:{kind:"primary_assistant"}`, `force_paragen`, `force_rate_limit`, `suggestions`, `model`, `parent_message_id`, `timezone_offset_min`, `history_and_training_disabled`, `websocket_request_id`.

**Step 4 — transport.** Either the SSE stream, **or** (when `shared_websocket` is present) `registerWebsocket` → POST returns `websocket_request_id` → the answer arrives as `http.response.body` frames whose `body` is base64. There is also `POST /stop_conversation` to cancel.

**The protocol moves.** The April-2026 teardown repo reconstructs the same algorithm with a *different* shape: an 18-element config, `gAAAAAC` prefix, and no Arkose URL baked in. Today's client uses 13 elements and `gAAAAAB`, with the Arkose script URL and a `dpl` fingerprint in the hashed payload. Same idea, new constants — which is exactly why a client built against this breaks within months. The teardown's own README confirms it: *"2026-04-30 이후 Sentinel PoW 코드/로직 변경으로 미작동"* (patched, no longer works).

This section documents the mechanism for defensive/educational reading. It is not a working bypass, and nothing here should be used to evade an access control you don't own.

---

## 4. What REA is good at, after this run

- ✅ **Static reconstruction at scale** — 23 files → 23k-node semantic graph in ~14 s, with call-flow/boundary/request/literal relation families.
- ✅ **Evidence discipline** — every node carries `authority` (`ast-static-analysis` vs `static-relationship-inference`), `state` (`observed`/`inferred`) and `confidence` (`exact`/`partial`/`candidate`). You can audit a claim instead of trusting it.
- ✅ **Content-addressed provenance** — evidence ids, graph/manifest sha256s, integrity contradictions (0 here).
- ✅ **Breadth** — 207 MCP tools across binaries, Electron, Android, WASM, web, signals, firmware.
- ⚠️ **Needs a real browser for anything web-live**, and providers (Ghidra/Hopper/IDA/jadx) must be supplied by you — REA doesn't download them.

---

## 5. What I did not verify

- No packet was captured from OpenAI; **no header set was confirmed against live traffic**.
- The Sentinel proof-of-work constants in §3.6 come from one third-party client (Nov 2026) and one self-declared-patched teardown (Apr 2026). **They were not confirmed against live traffic, and they rotate by design** — the two sources already disagree (`gAAAAAC`/18 fields vs `gAAAAAB`/13 fields).
- `acheong08`'s v1 surface (moderation endpoint, `PUID` semantics) is from 2023 and is almost certainly retired.
- Anything behind login that these clients don't exercise.

---

## 6. Two ways to make this a real capture

**Option A — you give me the traffic (works today).**
Open chatgpt.com in your browser → DevTools → Network → reload and send one message → right-click → *Save all as HAR*. Drop the `.har` (and optionally "Save page as" HTML) into `evidence/` in this repo and I'll run:

```bash
npx rea-agents inspect-web-network-capture <file.har>   # endpoints, headers, timing — no refetching
npx rea-agents export-web-scripts --…                   # dump scripts for static analysis
npx rea-agents analyze-javascript-application <dir>     # reconstruct the bundle
```

That turns this map into verified ground truth, and `inspect-web-network-capture` explicitly does **not** refetch recorded URLs.

**Option B — build the legitimate thing instead.**
A clean-room chat UI in this Next.js app: streaming responses from the **official** OpenAI API (your key, server-side), with Supabase storing conversations and Vercel deploying it. Same product surface as ChatGPT, none of the circumvention, and it uses the Supabase + Vercel connections you already have on.

---

## 7. Files added here

- `.mcp.json` — REA registered as an MCP server for this project
- `package.json` — `rea-agents` devDependency
- `scripts/rea-chatgpt.sh` — one command to re-collect evidence and re-run every analysis above
- `docs/rea-chatgpt.md` — this report
