# anirudhkowshik / personal site

A static, single-page site with plain HTML, CSS and two small JS files. It has no framework and no build step.

```
website/
  index.html        home page (hero, test line, quick facts, about, experience, skills, projects, reading, off the clock, contact)
  projects/*.html   case studies and the rack-validation method page (share style.css)
  style.css         dark theme, layout, motion (respects prefers-reduced-motion)
  script.js         hero scope canvas, nav highlight, fallbacks for scroll effects (optional; the page works without it)
  line.js           the interactive test line in the home page's #test-line section (optional; without it the stations read as plain text)
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
- **Test line** (`#test-line`, "Here's what I do"): the first section after the hero and the centrepiece of the page, so it drops the label column and runs wider than the text sections. Seven `.stage` sections inside `<div class="line" data-line>`, each with its console lines in `data-log` (and `data-fail-log` on the station that fails in "Show a failure" mode). `line.js` turns them into a piece of test equipment: a floor of seven bays with a rack that moves between them and a repair loop overhead, a status strip (state in words, one sentence, the controls), a log, and one station's detail at a time. Without JS the stations read as plain sections. The six-step failure walk-through (`.story`, a numbered rail) follows, then a link to the method page, which keeps the longer prose and points back here instead of repeating the line. Program names stay out of this section and the hero.
  - **Entrance and autoplay:** the panel powers on when its floor scrolls into view (`.pre` then `.is-on`), then runs once on its own at a quicker pace with the failure switched on: three passes, the failure at Network blade, the rack up into the repair loop and back in at Pretest, then through to Ship. The first click or key press on its controls means the visitor is driving: autoplay never starts after that, and it never restarts a run they paused or a station they picked. Runs the visitor starts use the slower reading pace.
  - **Holds:** a run only advances while the floor is on screen and the tab is visible; CSS animation inside it pauses too (`.is-off`, `.is-paused`, `.tab-hidden`).
  - **No layout shift:** the status sentence, the log window and (on wide screens) the station detail have reserved sizes, the log rolls with a transform, and the rack and rail move with transforms.
  - **Not colour alone:** each station carries a text tag (`testing`, `pass`, `fail`, `retest`) and a tick or cross; the status strip says the state in words. The one `aria-live="polite"` sentence changes a handful of times per run; the log itself is `aria-hidden`.
  - **Reduced motion:** no entrance, no autoplay, no typing or gliding. The resting frame is the failed one (three passes, one fail), and Run the line still steps through.
- **Hero teaser** (`.teaser`): a link under the hero buttons that scrolls to `#test-line`. A small rack steps along seven dots, which light up in order until the fourth (Network blade) turns red; the line under the cue names the failure, and the outcome is left for the section below. It is CSS only (opacity and transform), its resting state is the failed frame (which is what reduced motion shows), and `script.js` pauses it when the hero is off screen, its text has faded out, or the tab is hidden. It shares the pinned stage with the rest of the hero text: if that text grows taller than one screen, `script.js` drops the pinned-hero effect, so keep the hero copy short.
- **Scroll motion** is native CSS scroll-driven animation (`animation-timeline: scroll()` / `view()`, Chrome/Edge 115+, Safari 26+): a thin progress line, a nav whose glass firms up as you leave the top, the portrait growing slightly and fading as the hero leaves while the text lags and the scope runs ahead, and sections easing in as they enter. Only `translate`, `scale`, `transform` and `opacity` animate. Browsers without support get a small rAF fallback from `script.js`; `prefers-reduced-motion: reduce` turns all of it off. Page-to-page navigation uses a short cross-document view transition (`@view-transition`).
- **Cache busting:** every page loads `style.css?v=YYYYMMDD` and `script.js?v=YYYYMMDD` (the home page also loads `line.js?v=YYYYMMDD`). GitHub Pages caches assets for about 10 minutes, so **bump the date on every page whenever you change `style.css`, `script.js` or `line.js`**, or a visitor can get new HTML with an old stylesheet. For a second change on the same day, add a letter (`20261003b`).
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
- **Projects:** `#projects` leads with the validation method (`projects/rack-validation-method.html`, the longer read behind the home page's test line) and a slot for a public tool, then MarketPulse, then the earlier data-engineering work as a compact `.mini` list. New case studies can copy `projects/marketpulse.html` (`.project`, `.flow`, `.points`).
- **Skills:** the `#skills` section mirrors the skill groups in the resume. Groups marked `primary` (hardware validation, networking) get the accent styling; keep them first.
