# diogomaiacaetano.com

Static site built from the Figma design file `9kiJXVlILNN8RrkUuTrEnY`
(“🎼 JamAlong”), frame **Desktop** `15224:1424`. One page, plain HTML and CSS,
no build step and no JavaScript.

```
index.html          The whole site
assets/css/site.css Single stylesheet (design tokens at the top)
assets/fonts/       Montserrat and Inter variable woff2, self-hosted
assets/img/         Images — see ASSETS.md, currently placeholders
ASSETS.md           Which export goes in which file
CNAME               Custom domain for GitHub Pages
.github/workflows/  Deploys the repository root to Pages on push to main
```

## Sections

Navigation · hero with a project rail · about (portrait, capabilities,
company types, industries) · “Worked with” logo rail · “In their words”
testimonials · timeline with a segmented filter · email CTA · footer.

## Design mapping

Values come from the Figma frame, not from eyeballing:

| Token | Value |
| --- | --- |
| Page / ink / muted | `#fafafa` / `#111111` / `#666666` |
| Surface (cards, pills) | `#ededed` |
| Rules / entry borders | `#d0d3d6` / `#cacaca` |
| Email button hover | `#ffd454` |
| Type | Montserrat 400/500/700; Inter 400 for the footer name and copyright |
| Grid | 1280px frame, 80px gutters, 48px gaps, 80px section padding |
| Sizes | h1 48 · h2 32 · chips 20 · years 64 · email CTA 48 |

Interactions from the design: nav and footer pills fill on hover, the email
button turns yellow and rotates while the address slides up into view.

## Known gaps

* **Images are placeholders.** The environment cannot reach `www.figma.com`, so
  the bitmaps could not be downloaded. See `ASSETS.md` for the export list.
* **Responsive behaviour is inferred.** Only the Desktop frame was read; the
  breakpoints here (600 / 900 / 1280) are a sensible reflow, not the design's
  own Tablet and Mobile frames.
* **The timeline filter is inert.** “All / Designer / Entrepreneur / Freelancer”
  renders as designed but filters nothing — the design does not say which entry
  belongs to which category.
* **The footer “Twitter” link points at `mailto:`** because that is the href in
  the design. It needs a real handle.
* **Rails scroll.** The project row (1400px) and the logo row (2116px) are wider
  than the 1120px content column in the design, so both scroll horizontally.

## Local preview

```
python3 -m http.server 8000
```
