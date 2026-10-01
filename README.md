# anirudhkowshik / personal site

A static, single-page site with plain HTML, CSS and a small JS file. It has no framework and no build step.

```
website/
  index.html   page content
  style.css    dark theme, layout, motion
  script.js    scroll reveal + nav highlight (optional; page works without it)
  images/      photos for the "Beyond work" section
  .nojekyll    tells GitHub Pages to serve files as-is
```

## Adding photos

The "Beyond work" tiles show a dark gradient placeholder until these files exist:

| File                 | Section |
|----------------------|---------|
| `images/hiking.jpg`  | Hiking  |
| `images/techno.jpg`  | Techno  |
| `images/travel.jpg`  | Travel  |
| `images/food.jpg`    | Food    |

- Use a **4:5 portrait** crop (for example 800x1000 px). Other ratios still work but get center-cropped.
- **Compress each photo to under ~300 KB.** Use [Squoosh](https://squoosh.app) (MozJPEG, quality ~70), or `magick in.jpg -resize 800x1000^ -gravity center -extent 800x1000 -quality 72 -strip images/hiking.jpg`.
- Remove location metadata (EXIF/GPS). The `-strip` flag above does this.
- Edit the captions in `index.html` (`<figcaption>`) to make them your own.

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
- **Projects:** add an `<article class="card">` in `#projects`. The grid adapts automatically.
