# diogomaiacaetano.com

Static site built from the Figma design file `9kiJXVlILNN8RrkUuTrEnY`
(“🎼 JamAlong”), section `15226:2689` — frames **Desktop** `15226:1740`,
**Tablet** `15226:1958` and **Mobile** `15226:2176`. One page, plain HTML and
CSS, no build step and no JavaScript.

```
index.html          The whole site
assets/css/site.css Single stylesheet (design tokens at the top)
assets/fonts/       Montserrat variable woff2, self-hosted
assets/img/         Images — see ASSETS.md, currently placeholders
ASSETS.md           Which export goes in which file
CNAME               Custom domain for GitHub Pages
.github/workflows/  Deploys the repository root to Pages on push to main
```

## Sections

Navigation (Portfolio, Contact) · hero with a project rail · about (portrait,
capabilities, company types, industries) · “Worked with” logo rail ·
“In their words” testimonials · email CTA · footer.

## Design mapping

Values come from the Figma frame, not from eyeballing:

| Token | Value |
| --- | --- |
| Page / ink / muted | `#ffffff` / `#111111` / `#666666` |
| Surface (cards, pills) | `#ededed` |
| Rules and link dividers | `#d0d3d6` |
| Email button hover | `#ffd454` |
| Type | Montserrat 400/500/700 |
| Gutters | 80px desktop · 40px tablet (≥800) · 16px mobile |
| Rhythm | 48px gaps, 80px section padding, 160px above the hero |
| Sizes | h1 48/48/32 · h2 32/32/24 · chips 20 · email CTA 48/32 |

Interactions from the design: nav and footer pills fill on hover, the email
button turns yellow and rotates while the address slides up into view.

## Known gaps

* **Images are placeholders.** The environment cannot reach `www.figma.com`, so
  the bitmaps could not be downloaded. See `ASSETS.md` for the export list.
* **Two deliberate departures from the frames.** The mobile frame hides the
  email CTA and the social links, and places the nav below the hero; both read
  as unfinished rather than intended, so the footer keeps its content on mobile
  and the nav stays at the top.
* **Rails scroll.** The project row (1400px) and the logo row (2116px) are wider
  than the 1120px content column. The design clips them; here they scroll, so
  the content past the edge stays reachable.
* **“Wed Design”** in the Capabilities chips is shipped as “Web Design”.

## Local preview

```
python3 -m http.server 8000
```
