# Working in this repo

## Deploys

The live site is **diogomaiacaetano.net**, served by **Cloudflare Workers**
from `main` (`wrangler.jsonc`). Cloudflare uploads the repo root as static
assets, minus the paths in `.assetsignore`. There is no build step.

- Nothing is live until it is on `main`. A branch or a PR deploys nothing.
- Not GitHub Pages, and not `diogomaiacaetano.com`. There is deliberately no
  `CNAME` file — it was removed in `e402cc7`. Do not add one back.
- `.github/workflows/deploy-pages.yml` still runs on every push to `main` and
  publishes a redundant copy to `dmcthunder.github.io/Personal_Website`. It is
  not the live site.

## Before building on top of something

`main` moves quickly. Check it (`git fetch origin main`, `git log --oneline
origin/main`) before starting work or describing what is deployed — long-lived
branches here have gone stale enough to be superseded entirely.
