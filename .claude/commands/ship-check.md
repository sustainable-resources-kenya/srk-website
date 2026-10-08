---
description: Pre-launch check. Runs npm run ship-check, then Lighthouse (mobile, slow 4G), and says READY TO SHIP or NOT READY.
---

Run the SRK pre-launch check. Follow these steps in order. Explain the results in plain language: the people reading this are new to web development.

## 1. Site rules check

Run `npm run ship-check` and show the table exactly as printed. Note its exit code (0 = no FAIL, 1 = at least one FAIL).

If the **Build** row is FAIL, skip steps 2 to 5 (there is nothing to test) and go to step 6.

## 2. Start the preview server on port 4399

Use port **4399**. Never 4321: that's the port `npm run dev` uses, and someone may be working in it.

First check the port is free:

```bash
lsof -nP -iTCP:4399 -sTCP:LISTEN
```

If this prints anything, **stop here**. Tell the user which process holds port 4399 (command and PID from the output), and **do not kill it**. Skip to step 6 with the reason "port 4399 busy".

If the port is free, start the preview in the background and save the process ID of the server we started.

Astro 7's `astro preview` runs the server in the background by itself: `npm` exits right away, and the log says `Preview server running at http://localhost:4399 (pid 12345)`. So we take the PID from that log line. With an older Astro that stays in the foreground, there's no such line, and we keep npm's PID instead.

```bash
LOG="${TMPDIR:-/tmp}/srk-preview.log"; PID_FILE="${TMPDIR:-/tmp}/srk-preview.pid"
nohup npm run preview -- --port 4399 > "$LOG" 2>&1 &
NPM_PID=$!
for i in $(seq 1 30); do curl -s -o /dev/null http://localhost:4399/ && echo ready && break; sleep 1; done
SERVER_PID=$(grep -o 'pid [0-9]*' "$LOG" | head -1 | cut -d' ' -f2)
echo "${SERVER_PID:-$NPM_PID}" > "$PID_FILE"
echo "preview server pid: $(cat "$PID_FILE")"
```

If it never says `ready`, show the log (`${TMPDIR:-/tmp}/srk-preview.log`), do step 4 (stop the server), and go to step 6 with the reason "preview server didn't start".

## 3. Run Lighthouse

These settings are Lighthouse's **"slow 4G" mobile profile** (the same profile was formerly called "fast 3G"): 150 ms round trip, about 1.6 Mbps, CPU slowed 4×. Keep them exactly as written so results can be compared over time.

```bash
npx --yes lighthouse http://localhost:4399/ \
  --form-factor=mobile --screenEmulation.mobile \
  --throttling-method=simulate \
  --throttling.rttMs=150 --throttling.throughputKbps=1638.4 \
  --throttling.cpuSlowdownMultiplier=4 \
  --only-categories=performance,accessibility \
  --chrome-flags="--headless=new" --quiet \
  --output=json --output-path="${TMPDIR:-/tmp}/srk-lighthouse.json"
```

`npx` downloads Lighthouse into a cache; it is not added to package.json. If Lighthouse fails, still do step 4, then go to step 6 with the reason "Lighthouse couldn't run".

## 4. Stop the preview server (always)

Always run this, even if Lighthouse failed. It stops **only the process this command started**: the PID saved in step 2, plus its child processes. Never kill by port, and never use `astro preview stop`, which could stop a preview someone else started.

```bash
PID_FILE="${TMPDIR:-/tmp}/srk-preview.pid"
kill_tree() { for c in $(pgrep -P "$1"); do kill_tree "$c"; done; kill -TERM "$1" 2>/dev/null; }
[ -f "$PID_FILE" ] && kill_tree "$(cat "$PID_FILE")" && rm "$PID_FILE"
sleep 1; lsof -nP -iTCP:4399 -sTCP:LISTEN || echo "port 4399 free"
```

If something is still listening on 4399, tell the user what it is. Don't kill it.

## 5. Read the results

```bash
node -e '
const r = require(process.argv[1]);
const score = (c) => Math.round(r.categories[c].score * 100);
console.log("Performance:", score("performance"));
console.log("Accessibility:", score("accessibility"));
console.log("LCP (s):", (r.audits["largest-contentful-paint"].numericValue / 1000).toFixed(2));
const issues = [];
for (const c of ["performance", "accessibility"]) {
  for (const ref of r.categories[c].auditRefs) {
    const a = r.audits[ref.id];
    if (a.score === null || a.score >= 0.9) continue;
    if (["manual", "notApplicable"].includes(a.scoreDisplayMode)) continue;
    issues.push({ c, weight: ref.weight, savings: a.metricSavings ? Math.max(0, ...Object.values(a.metricSavings)) : 0, title: a.title, value: a.displayValue ?? "" });
  }
}
issues.sort((x, y) => y.weight - x.weight || y.savings - x.savings);
issues.slice(0, 3).forEach((i, n) => console.log(`${n + 1}. [${i.c}] ${i.title} ${i.value}`));
' "${TMPDIR:-/tmp}/srk-lighthouse.json"
```

Report:
- **Performance** and **Accessibility** scores (0 to 100)
- **Largest Contentful Paint (LCP)**: the time in seconds until the biggest thing on the screen (usually the main heading or hero image) has loaded
- **Top 3 issues**, each with one plain-language sentence on what it means and where to look. If there are none, say so.

## 6. Verdict

End with exactly one line:

- `READY TO SHIP`, only if **all** of these are true:
  - `npm run ship-check` exited 0
  - Performance ≥ 90
  - Accessibility ≥ 90
  - LCP ≤ 3.0 s
- Otherwise `NOT READY: <reasons>`, listing every failed condition, e.g. `NOT READY: Page weight FAIL; LCP 3.6 s`.

WARN rows (like leftover TODOs) don't block shipping, but mention them in the summary above the verdict.
