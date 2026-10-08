# srk-website

## Pre-launch check

Before a change goes live, run:

```bash
npm run ship-check
```

It builds the site, then checks the finished pages in `dist/` and the code in `src/`, and prints a table:

| Check | What it looks for |
|---|---|
| Build | `npm run build` works |
| Page weight | Each page, plus all the CSS, JS, fonts and images it loads, is under 1 MB |
| Internal links | Every link to a page or file on our site exists, and every `#section` link points to a real `id` |
| Placeholders | Leftover `TODO`, "to be provided", "SRK to provide" or "lorem" text |
| Image alt text | Every `<img>` has an `alt` attribute (`alt=""` is fine for decorative images) |
| Fonts | Nothing loads Google Fonts (our fonts are self-hosted) |
| Colors | No hex colors like `#1B6B35` in `src/` outside `src/styles/tokens.css` |

Results:

- **PASS**: all good.
- **WARN**: worth a look, but doesn't block launch (used for placeholders).
- **FAIL**: must be fixed. The command exits with code 1, so it can stop an automated build (CI) later.

The script uses simple text matching rather than a full HTML parser, which works on the HTML Astro produces.

### Speed and accessibility (Lighthouse)

In Claude Code, `/ship-check` runs the table above plus Lighthouse and ends with READY TO SHIP or NOT READY. To run Lighthouse yourself:

1. `npm run build`, then `npm run preview -- --port 4399`. In Astro 7 the preview runs in the background.
2. Run Lighthouse on mobile with the "slow 4G" profile (formerly called "fast 3G"). It needs Google Chrome installed:

   ```bash
   npx --yes lighthouse http://localhost:4399/ \
     --form-factor=mobile --screenEmulation.mobile \
     --throttling-method=simulate \
     --throttling.rttMs=150 --throttling.throughputKbps=1638.4 \
     --throttling.cpuSlowdownMultiplier=4 \
     --only-categories=performance,accessibility \
     --view
   ```

   `--view` opens the report in your browser.
3. Stop the preview with `npx astro preview stop`.

We ship when Performance and Accessibility are both 90 or more and Largest Contentful Paint (LCP) is 3.0 s or less.
