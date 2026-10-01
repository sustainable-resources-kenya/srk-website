# SRK website
Website for Sustainable Resources of Kenya, an NGO in Bondo, Siaya County.
Built with Astro and plain CSS. Hosted on Cloudflare Pages.
The people working on this are students new to web development:
explain changes in plain language.

## Rules
- Never invent facts about SRK (names, numbers, dates, projects, quotes).
  Only use text in src/content or text we paste in. If unknown, leave a visible TODO.
- No AI-generated images of people or communities. Placeholders are grey boxes with a caption.
- Each page under 1MB. No client-side JavaScript unless we ask for it.
- Use tokens from src/styles/tokens.css only. No raw colors or pixel sizes in components.
- One font family, two weights, self-hosted in the repo.
- Accessibility: semantic HTML, alt text comes from us, WCAG AA contrast.
- Contact form uses Formspree. No server code.

## Workflow
- Never commit to main. One branch per task: feat/, fix/, content/.
- Run /ship-check before saying a task is done.
- Commands: npm run dev, npm run build, npm run preview.
