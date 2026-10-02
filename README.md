# anirudhkowshik / personal site

A static, single-page site with plain HTML, CSS and a small JS file. It has no framework and no build step.

```
website/
  index.html        home page (hero, about, experience, skills, projects, reading, off the clock, contact)
  projects/*.html   case studies and the rack-validation method page (share style.css)
  style.css         dark theme, layout, motion (respects prefers-reduced-motion)
  script.js         hero scope canvas, nav highlight, fallbacks for scroll effects (optional; the page works without it)
  favicon.svg       eye-diagram favicon
  404.html          custom not-found page (root-absolute paths; assumes the user site at /)
  robots.txt, sitemap.xml  crawler hints; add new pages to sitemap.xml
  images/           photos, project screenshots, og.png (social preview), apple-touch-icon.png
  .nojekyll         tells GitHub Pages to serve files as-is
```

## Design notes

- The hero line is "I try to break AI server racks on purpose, so they don't break by accident." It also appears in `og:description`; change both together.
- The hero is led by the full, uncropped portrait (`images/profile-{480,640,800}.webp` with `profile-480.jpg`, `profile-640.jpg` and `profile.jpg` as the JPEG fallback). It is the LCP element, so it has `fetchpriority="high"` and is never lazy-loaded. The sizes were made from `profile.jpg` with Pillow; the source is 800x1000, so nothing larger is generated.
- An **oscilloscope** inset sits over the lower-left of the portrait: a `<canvas>` that draws a simulated PRBS7 eye diagram with persistence (`script.js`). It only animates while it is on screen and the tab is visible, and shows a single static frame under `prefers-reduced-motion`. Pointing at it (or tapping it on touch screens) adds jitter, it gets a little more jittery as it scrolls away, and the eye-height/width readout is measured from the traces actually drawn. Without JS, or if the GPU drops the canvas, a static SVG eye (`images/eye-fallback.svg`) shows instead, so the box is never empty.
- **Scroll motion** is native CSS scroll-driven animation (`animation-timeline: scroll()` / `view()`, Chrome/Edge 115+, Safari 26+): a thin progress line, a nav whose glass firms up as you leave the top, the portrait growing slightly and fading as the hero leaves while the text lags and the scope runs ahead, and sections easing in as they enter. Only `translate`, `scale`, `transform` and `opacity` animate. Browsers without support get a small rAF fallback from `script.js`; `prefers-reduced-motion: reduce` turns all of it off. Page-to-page navigation uses a short cross-document view transition (`@view-transition`).
- **Cache busting:** every page loads `style.css?v=YYYYMMDD` and `script.js?v=YYYYMMDD`. GitHub Pages caches assets for about 10 minutes, so **bump the date on every page whenever you change `style.css` or `script.js`**, or a visitor can get new HTML with an old stylesheet.
- Fonts: Bricolage Grotesque (display headings) with IBM Plex Sans and IBM Plex Mono (body and labels), from Google Fonts. Every page loads the same font URL.
- Placeholders the owner still has to fill in are marked `[TODO Tn: ...]` in text (styled with a dashed amber outline by `.todo`) and `TODO-Tn` in attributes. Search for `TODO` to find them all.
- The About section's "stack" panel is styled as a 6U rack: lit units are where he works today.
- `images/og.png` (1200x630) is the link-preview image. Meta tags point at `https://kowshik-anirudh.github.io/images/og.png`; if the site moves to another URL, update `og:image`, `og:url` and `canonical` in each page.

## Photos

Photos live in `images/` (`profile.jpg` plus its resized copies, `education.jpg`, `hiking.jpg`, `techno.jpg`, `travel.jpg`, `food.jpg`). To replace one, keep the filename.

- **Compress each photo to under ~300 KB** (Squoosh, MozJPEG quality ~70, or `magick in.jpg -resize 800x1000^ -gravity center -extent 800x1000 -quality 72 -strip out.jpg`).
- Strip location metadata (EXIF/GPS); `-strip` does this.
- Captions are the `<figcaption>` elements in `index.html`.

## Preview locally

From the `website/` folder:

```bash
python -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` directly in a browser also works.

## Deploy to GitHub Pages

### Option A: user site at `https://kowshik-anirudh.github.io` (recommended)

1. Create a public repo named exactly **`kowshik-anirudh.github.io`**.
2. Copy the *contents* of `website/` to the repo root, then push:
   ```bash
   cd website
   git init -b main
   git add .
   git commit -m "Personal site"
   git remote add origin https://github.com/kowshik-anirudh/kowshik-anirudh.github.io.git
   git push -u origin main
   ```
3. In the repo, go to **Settings > Pages > Build and deployment**: Source = *Deploy from a branch*, Branch = `main`, folder `/ (root)`.
4. After a minute or two the site is live at `https://kowshik-anirudh.github.io`.

Note: your existing project site `kowshik-anirudh.github.io/ai-stock-storyteller/` keeps working. Project repos are served under the user site path.

### Option B: `docs/` folder in an existing repo

1. Copy the contents of `website/` into a `docs/` folder at the repo root and push.
2. **Settings > Pages**: Branch = `main`, folder = `/docs`.
3. The site is served at `https://kowshik-anirudh.github.io/<repo-name>/`. All paths in this site are relative, so it works under a sub-path.

## Custom domain (later)

1. In **Settings > Pages > Custom domain**, enter your domain (for example `anirudhkowshik.com`) and save. GitHub commits a `CNAME` file to the repo. Keep that file.
2. At your DNS provider:
   - **Apex domain** (`anirudhkowshik.com`): add `A` records to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (and optionally `AAAA` records to `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`).
   - **`www` subdomain**: add a `CNAME` record pointing `www` to `kowshik-anirudh.github.io`.
3. Wait for DNS to propagate, then tick **Enforce HTTPS**.
4. Recommended: verify the domain under your GitHub account (**Settings > Pages > Verified domains**) so no one else can claim it.

Check GitHub's current docs before changing DNS: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site

## Updating content

- **Reading list:** each entry in `#reading` has a title link, source, date and a one-line note. Refresh it every few months so it stays current.
- **Projects:** `#projects` leads with the validation method (`projects/rack-validation-method.html`) and a slot for a public tool, then MarketPulse, then the earlier data-engineering work as a compact `.mini` list. New case studies can copy `projects/marketpulse.html` (`.project`, `.flow`, `.points`).
- **Skills:** the `#skills` section mirrors the skill groups in the resume. Groups marked `primary` (hardware validation, networking) get the accent styling; keep them first.
