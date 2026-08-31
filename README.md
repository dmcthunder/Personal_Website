# diogomaiacaetano.com

Hand-built static site for **Diogo Maia Caetano**, rebuilt from the Figma
source (`Diogo — Portfolio website`, node `29:34369`). It replaces the earlier
capture of the published Figma Sites page: the markup, styles and assets here
are plain HTML/CSS with no runtime, no build step and no JavaScript.

## Structure

```
index.html          Feed (home): hero statement + six work images
about/index.html    About: intro, portraits, bio, work experience
assets/css/site.css Single stylesheet (design tokens at the top)
assets/fonts/       Inter and Montserrat variable woff2, self-hosted
assets/img/         Images (WebP for photography, PNG for logos)
CNAME               Custom domain for GitHub Pages
.github/workflows/  Deploys the repository root to GitHub Pages on push to main
```

## Design mapping

Values in `site.css` come from the Figma file rather than from eyeballing:

| Token | Value |
| --- | --- |
| Ink / muted / body copy | `#111111` / `#d0d3d6` / `#939899` |
| Pill fill (hover) / accent | `#ededed` / `#ffd454` |
| Type | Inter (400/500/700), Montserrat 500 for the email CTA |
| Line height | 100% of the font size — `1.2102` Inter, `1.219` Montserrat |
| Breakpoints | mobile `< 800px`, tablet `800–1279px`, desktop `>= 1280px` |
| Hero size | 24 / 48 / 64 px |
| Feed image height | 603 / 1267 / 980 px |

Interactions are the ones defined in the file: nav and footer pills fill on
hover, the email button turns yellow while the address slides up into view, and
the "Next." card drops its 40% overlay.

## Deviations from the published page

* Photography is re-encoded to WebP (~28 MB of PNG → ~3 MB) and images are
  lazy-loaded. The desktop framing is pixel-identical.
* The mobile footer renders the email button and the social links, which the
  design includes but the published page dropped; link padding tightens so the
  row fits instead of overflowing the viewport.
* On screens under 360px the "Contact" label is hidden (the icon and its
  accessible name remain) so the header stays on one line.

## Local preview

```
python3 -m http.server 8000
```

Then open <http://localhost:8000/>.
