// Pre-launch check for the SRK site. Run with: npm run ship-check
//
// Builds the site, then checks dist/ and src/ against the rules in CLAUDE.md.
// Prints one table and exits with code 1 if any check FAILs (WARN is fine).
//
// Plain Node, no dependencies. HTML is read with simple regular expressions,
// which works on Astro's tidy output but is not a full HTML parser.
//
// Options (for testing the script itself; normal use needs none):
//   --dist <dir>    check this folder instead of dist/
//   --src <dir>     check this folder instead of src/
//   --skip-build    don't run "npm run build" first

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAX_PAGE_BYTES = 1024 * 1024; // 1 MB

const args = process.argv.slice(2);
function option(name, fallback) {
  const i = args.indexOf(name);
  return i === -1 ? fallback : path.resolve(args[i + 1]);
}
const DIST = option("--dist", path.join(ROOT, "dist"));
const SRC = option("--src", path.join(ROOT, "src"));
const SKIP_BUILD = args.includes("--skip-build");

const rows = []; // { check, result: "PASS" | "WARN" | "FAIL", details: [] }

// ---------- Helpers ----------

// Every file under a folder, as absolute paths.
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

// Path with forward slashes, relative to a base folder (for printing).
function rel(base, file) {
  return path.relative(base, file).split(path.sep).join("/");
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

// All opening tags of one kind, e.g. tags(html, "img") -> ['<img src="..." alt="...">', ...]
function tags(html, name) {
  return html.match(new RegExp(`<${name}\\b[^>]*>`, "gi")) ?? [];
}

// The value of one attribute in a tag, or null if it's not there.
function attr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  if (!m) return null;
  return (m[1] ?? m[2] ?? m[3]).replace(/&amp;/g, "&");
}

// True if the tag has the attribute at all (even with no value, like <img alt>).
function hasAttr(tag, name) {
  return new RegExp(`\\s${name}(\\s|=|/|>)`, "i").test(tag);
}

// Remove <script> and <style> contents, which aren't visible text.
function stripCode(html) {
  return html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
}

// Links we don't check: other websites, email, phone, data: and so on.
function isExternal(url) {
  return /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//");
}

// Turn a local URL into a file path in dist/. "fromDir" is the folder of the
// file that contains the URL (for relative links like "img/logo.webp").
function toDistPath(url, fromDir) {
  let clean = url.split("#")[0].split("?")[0];
  try {
    clean = decodeURIComponent(clean);
  } catch {
    // leave it as written
  }
  return clean.startsWith("/") ? path.join(DIST, clean) : path.resolve(fromDir, clean);
}

// Find the file a link points to: the file itself, folder/index.html, or name.html.
function findTarget(file) {
  const candidates = [file, path.join(file, "index.html"), `${file}.html`];
  return candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile()) ?? null;
}

// URLs inside CSS: url(...) and @import "...".
function cssUrls(css) {
  const urls = [];
  for (const m of css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)) urls.push(m[2].trim());
  for (const m of css.matchAll(/@import\s+['"]([^'"]+)['"]/gi)) urls.push(m[1]);
  return urls.filter((u) => !u.startsWith("data:")); // data: is already inside the file
}

// The candidates in a srcset: "a.webp 400w, b.webp 800w" -> ["a.webp", "b.webp"]
function srcsetUrls(srcset) {
  return srcset
    .split(",")
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function addRow(check, result, details) {
  rows.push({ check, result, details });
}

// ---------- Step 0: build ----------

if (!SKIP_BUILD) {
  const build = spawnSync("npm", ["run", "build"], {
    cwd: ROOT,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (build.status !== 0) {
    console.log(build.stdout ?? "");
    console.error(build.stderr ?? "");
    addRow("Build", "FAIL", ["npm run build failed (log above)"]);
    printTable();
    process.exit(1);
  }
  addRow("Build", "PASS", ["npm run build"]);
}

const files = walk(DIST);
const pages = files.filter((f) => f.endsWith(".html"));
const htmlCache = new Map();
function readHtml(file) {
  if (!htmlCache.has(file)) htmlCache.set(file, fs.readFileSync(file, "utf8"));
  return htmlCache.get(file);
}

if (pages.length === 0) {
  addRow("Pages", "FAIL", [`no HTML pages found in ${rel(ROOT, DIST) || DIST}`]);
}

// ---------- Check 1: page weight ----------
// HTML + every CSS, JS, font and image the page loads. Sizes are the files
// in dist/ before compression, so this is the worst case.

{
  const details = [];
  const missing = [];
  const external = new Set();
  let fail = false;

  for (const page of pages) {
    const html = readHtml(page);
    const pageDir = path.dirname(page);
    const counted = new Set([page]);

    // Add one file (and, for CSS, everything it loads).
    function count(url, fromDir) {
      if (isExternal(url)) {
        if (/^https?:|^\/\//i.test(url)) external.add(url);
        return;
      }
      const file = findTarget(toDistPath(url, fromDir));
      if (!file) {
        missing.push(`missing: ${url} (on ${rel(DIST, page)})`);
        return;
      }
      if (counted.has(file)) return;
      counted.add(file);
      if (file.endsWith(".css")) {
        for (const u of cssUrls(fs.readFileSync(file, "utf8"))) count(u, path.dirname(file));
      }
    }

    // Count the biggest of several choices (src vs srcset candidates):
    // the browser only downloads one of them.
    function countLargest(urls) {
      const sized = urls.map((u) => {
        const file = isExternal(u) ? null : findTarget(toDistPath(u, pageDir));
        return { u, size: file ? fs.statSync(file).size : -1 };
      });
      sized.sort((a, b) => b.size - a.size);
      if (sized.length) count(sized[0].u, pageDir);
    }

    // <link> that the browser downloads (not canonical, alternate, etc.)
    const loadedRels = ["stylesheet", "preload", "modulepreload", "icon", "apple-touch-icon"];
    for (const tag of tags(html, "link")) {
      const relTokens = (attr(tag, "rel") ?? "").toLowerCase().split(/\s+/);
      const href = attr(tag, "href");
      if (href && relTokens.some((r) => loadedRels.includes(r))) count(href, pageDir);
    }
    for (const tag of tags(html, "script")) {
      const src = attr(tag, "src");
      if (src) count(src, pageDir);
    }
    for (const tag of [...tags(html, "img"), ...tags(html, "source")]) {
      const choices = [attr(tag, "src"), ...srcsetUrls(attr(tag, "srcset") ?? "")].filter(Boolean);
      countLargest(choices);
    }
    for (const tag of tags(html, "video")) {
      const poster = attr(tag, "poster");
      if (poster) count(poster, pageDir);
    }
    // Inline CSS: <style> blocks and style="" attributes. Astro puts our
    // tokens.css here, so this is where the font files are found.
    for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
      for (const u of cssUrls(m[1])) count(u, pageDir);
    }
    for (const m of html.matchAll(/\sstyle\s*=\s*"([^"]*)"/gi)) {
      for (const u of cssUrls(m[1])) count(u, pageDir);
    }

    const total = [...counted].reduce((sum, f) => sum + fs.statSync(f).size, 0);
    const over = total > MAX_PAGE_BYTES;
    if (over) fail = true;
    details.push(`${rel(DIST, page)}: ${kb(total)}${over ? " (over 1 MB)" : ""}`);
  }

  if (missing.length) fail = true;
  details.push(...missing);
  for (const url of external) details.push(`not measured (external): ${url}`);
  addRow("Page weight", fail ? "FAIL" : "PASS", details);
}

// ---------- Check 2: internal links ----------

{
  const idCache = new Map();
  function idsOn(file) {
    if (!idCache.has(file)) {
      const ids = new Set();
      for (const m of readHtml(file).matchAll(/\sid\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
        ids.add(m[1] ?? m[2] ?? m[3]);
      }
      idCache.set(file, ids);
    }
    return idCache.get(file);
  }

  const broken = [];
  let checked = 0;
  for (const page of pages) {
    const html = stripCode(readHtml(page));
    const hrefTags = [...tags(html, "a"), ...tags(html, "area"), ...tags(html, "link")];
    for (const tag of hrefTags) {
      const href = attr(tag, "href");
      if (href === null || href === "" || href === "#" || isExternal(href)) continue;
      checked++;

      const [pathPart, hash] = href.split("#");
      const target = pathPart.split("?")[0] === "" ? page : findTarget(toDistPath(pathPart, path.dirname(page)));
      if (!target) {
        broken.push(`${rel(DIST, page)} -> ${href} (no such page or file)`);
        continue;
      }
      // "#top" always works in browsers, even without an element with that id.
      if (hash && hash !== "top" && target.endsWith(".html")) {
        let id = hash;
        try {
          id = decodeURIComponent(hash);
        } catch {
          // compare as written
        }
        if (!idsOn(target).has(id)) {
          broken.push(`${rel(DIST, page)} -> ${href} (no id="${id}" on ${rel(DIST, target)})`);
        }
      }
    }
  }
  addRow("Internal links", broken.length ? "FAIL" : "PASS", broken.length ? broken : [`${checked} checked, 0 broken`]);
}

// ---------- Check 3: placeholders (WARN only) ----------

{
  const patterns = [/\bTODO\b/gi, /to be provided/gi, /SRK to provide/gi, /\blorem\b/gi];
  const found = [];
  for (const page of pages) {
    // Visible text plus attribute values (like alt="TODO"), without the tags.
    const text = stripCode(readHtml(page)).replace(/<[^>]*>/g, (tag) =>
      [...tag.matchAll(/=\s*(?:"([^"]*)"|'([^']*)')/g)].map((m) => ` ${m[1] ?? m[2]} `).join("") || " ",
    );
    for (const pattern of patterns) {
      for (const m of text.matchAll(pattern)) {
        const start = Math.max(0, m.index - 30);
        const snippet = text.slice(start, m.index + m[0].length + 30).replace(/\s+/g, " ").trim();
        found.push(`${rel(DIST, page)}: "...${snippet}..."`);
      }
    }
  }
  addRow("Placeholders", found.length ? "WARN" : "PASS", found.length ? found : ["none found"]);
}

// ---------- Check 4: images need alt ----------
// alt="" is allowed: it is the correct way to mark a decorative image.

{
  const noAlt = [];
  let total = 0;
  for (const page of pages) {
    for (const tag of tags(stripCode(readHtml(page)), "img")) {
      total++;
      if (!hasAttr(tag, "alt")) noAlt.push(`${rel(DIST, page)}: <img src="${attr(tag, "src") ?? "?"}"> has no alt`);
    }
  }
  addRow("Image alt text", noAlt.length ? "FAIL" : "PASS", noAlt.length ? noAlt : [`${total} images, all have alt`]);
}

// ---------- Check 5: no Google Fonts ----------
// Fonts must be self-hosted (CLAUDE.md), so nothing may load them from Google.

{
  const textFile = /\.(html|css|js|mjs|cjs|json|xml|txt|svg|webmanifest|astro|ts|tsx|jsx|md|mdx)$/i;
  const hits = [];
  for (const [base, label] of [[DIST, "dist"], [SRC, "src"]]) {
    for (const file of walk(base).filter((f) => textFile.test(f))) {
      const lines = fs.readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        const m = line.match(/fonts\.(googleapis|gstatic)\.com/i);
        if (m) hits.push(`${label}/${rel(base, file)}:${i + 1}: ${m[0]}`);
      });
    }
  }
  addRow("Fonts", hits.length ? "FAIL" : "PASS", hits.length ? hits : ["no Google Fonts references"]);
}

// ---------- Check 6: hex colors only in tokens.css ----------
// Not flagged: link fragments (href="#add"), HTML entities (&#123;),
// JS private fields and methods (this.#add, #add()), Markdown and .svg files.

{
  const codeFile = /\.(css|astro|js|mjs|ts|jsx|tsx)$/i;
  const tokens = path.join(SRC, "styles", "tokens.css");
  const hex = /(?<![&\w.])#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w(-])/gi;
  const hits = [];
  for (const file of walk(SRC).filter((f) => codeFile.test(f) && f !== tokens)) {
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const m of line.matchAll(hex)) {
        const before = line.slice(0, m.index);
        if (/href\s*=\s*["'{`]?[^"'\s>]*$/i.test(before)) continue; // a link like href="#add"
        hits.push(`src/${rel(SRC, file)}:${i + 1}: ${m[0]}`);
      }
    });
  }
  addRow("Colors", hits.length ? "FAIL" : "PASS", hits.length ? hits : ["hex colors only in src/styles/tokens.css"]);
}

// ---------- Output ----------

function printTable() {
  const header = { check: "Check", result: "Result", details: ["Details"] };
  const all = [header, ...rows];
  const w1 = Math.max(...all.map((r) => r.check.length));
  const w2 = Math.max(...all.map((r) => r.result.length));
  const line = (a, b, c) => `${a.padEnd(w1)}  ${b.padEnd(w2)}  ${c}`.trimEnd();

  console.log("");
  console.log(line("Check", "Result", "Details"));
  console.log(line("-".repeat(w1), "-".repeat(w2), "-".repeat(30)));
  for (const row of rows) {
    const [first = "", ...rest] = row.details;
    console.log(line(row.check, row.result, first));
    for (const more of rest) console.log(line("", "", more));
  }
  console.log("");
}

printTable();
const failed = rows.filter((r) => r.result === "FAIL").map((r) => r.check);
if (failed.length) {
  console.log(`FAIL: ${failed.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log("All checks passed.");
}
