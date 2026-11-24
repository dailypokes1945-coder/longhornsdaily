# Longhorns Daily
Sister site of Pokes Daily (pokesdaily.com) and Sooners Daily (soonersdaily.com), built from the same code with Texas content and burnt orange & white colors.

A Drudge-style headline site for Texas Longhorns sports at **longhornsdaily.com**.
Hosted free on **Cloudflare Pages**. Stories live in **Cloudflare KV**, and the editor at `/admin` is locked with **Cloudflare Access** so only your email can log in.

```
public/            the website (front page, styles, editor)
  index.html       front page
  app.js           loads headlines from /api/site
  admin/           the editor at longhornsdaily.com/admin
  auto.json        stories + ticker written by the scheduled updates
  history.json     On This Day in Longhorn history
  rundowns.json    one short daily summary per archive page
functions/         small server code Cloudflare runs for /api/*
  api/site.js            public: returns the page content
  admin/api/site.js      editor: load + publish (login required)
  api/live.js            Texas games on ESPN (team 251) for Gamecast links
  _access.js             checks your Cloudflare Access login
  _lib.js                storage + input cleaning
  _seed.js               starter headlines shown before your first publish
  index.js + _render.js  front page with headlines already in the HTML (SEO)
  _archive.js            /archive pages and /sitemap.xml
```

---

## One-time setup (about 30 minutes)

The code is already in your **longhornsdaily** GitHub repo, so you start at step 1 below. Cloudflare moves its buttons around now and then, so labels may differ a little.

### 1. Create the site on Cloudflare Pages
1. In the Cloudflare dashboard, go to **Workers & Pages → Create → Pages → Connect to Git**.
2. Pick the **longhornsdaily** repo. If it isn't listed, click the link to configure the Cloudflare GitHub app and give it access to `longhornsdaily`, the same way you did for soonersdaily.
3. Use these build settings:
   - Project name: `longhornsdaily`
   - Production branch: **main**
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: **public**
4. Click **Save and Deploy**. You'll get a test address like `longhornsdaily.pages.dev` that shows the front page with the starter headlines.

### 2. Add storage for your headlines (KV)
1. Go to **Storage & Databases → KV → Create namespace** and name it `longhornsdaily-site`.
2. Open your Pages project and go to **Settings → Bindings → Add → KV namespace**.
   - Variable name: **SITE** (must be exactly this)
   - Namespace: `longhornsdaily-site`

### 3. Connect longhornsdaily.com
1. In your Pages project, go to **Custom domains → Set up a custom domain** and enter `longhornsdaily.com`.
2. Do the same for `www.longhornsdaily.com`.

If the domain is registered at Cloudflare (like soonersdaily.com), it connects automatically within a few minutes. If it's registered somewhere else, first add it to Cloudflare (**Add a domain**) and change the nameservers at your registrar to the two Cloudflare gives you.

### 4. Lock the editor with Cloudflare Access
You already have a Zero Trust team from Sooners Daily, so you can reuse it.
1. In the dashboard, open **Zero Trust → Access → Applications → Add an application → Self-hosted**.
   - Name: `Longhorns Daily editor`
   - Destination (public hostname): domain `longhornsdaily.com`, path `admin` (this covers the editor and its save API at `/admin/api/*`)
   - Policy: **Allow**, Include **Emails**, enter your email address.
   - Login method: the default **One-time PIN** is fine. Cloudflare emails you a code.
2. Save. Open the application again and copy its **Application Audience (AUD) Tag**. This tag is new for this site; don't reuse the Sooners one.

### 5. Tell the site who's allowed in
In your Pages project, go to **Settings → Variables and Secrets** and add these for **Production**:

| Name | Value |
|---|---|
| `ACCESS_TEAM_DOMAIN` | your existing team domain, e.g. `yourteam.cloudflareaccess.com` (same as on soonersdaily) |
| `ACCESS_AUD` | the AUD tag you copied in step 4 |
| `ADMIN_EMAILS` | your email (comma-separate to add more editors later) |

Then go to **Deployments** and use **Retry deployment** on the latest one so the settings take effect.

### 6. Optional: free visitor stats
In the dashboard, go to **Analytics & Logs → Web Analytics → Add a site**, enter `longhornsdaily.com`, and pick the automatic setup for Pages.

### 7. Use it
- Go to **longhornsdaily.com/admin**, enter your email, and type in the code Cloudflare sends you.
- Add stories, rearrange them, and click **Publish**. The front page updates within about 30 seconds. Your first publish replaces the starter banner and top links.
- In the editor, drag the **+ Longhorns Daily** button to your bookmarks bar. On any Texas article, click it to open the editor with that story already filled in.

The editor fails closed: if any setting in step 4 or 5 is missing, it refuses to save rather than letting anyone in.

---

## Money features (already built, switched off)

These live in the editor. Each one has a **Show on site** checkbox:
- **Sponsor**: shows "PRESENTED BY ___" under the logo.
- **Shop box**: affiliate links, with the required disclosure added to the footer automatically.
- **Ticket links**: paste your StubHub affiliate link (with `{url}` where the game's StubHub page goes). The morning update finds the StubHub page for each game in the automatic ticker (`tickerItems` in `auto.json`), and the ticker shows a 🎟 TICKETS* link after those games, with the footer disclosure.
- **Newsletter box**: links to your sign-up page (Beehiiv, Substack, etc.).
- **Podcast box**: links to your latest episode.

---

## Notes for Claude (handoff)

Context for a new Claude session picking this up (moving to a new Claude account? see HANDOFF.md):
- The owner runs Longhorns Daily as a personal side business: a Texas Longhorns sports headline aggregator in the style of the Drudge Report. Headlines are rewritten in the owner's words and every one links out to its original source. Don't copy article text or images, and **don't use UT logos, the longhorn silhouette or other university trademarks** (no "Hook 'em" slogans, Bevo artwork, etc.). The footer and About page say the site is not affiliated with UT.
- The GitHub repo is `dailypokes1945-coder/longhornsdaily` (private). Same stack as Sooners Daily: static files in `public/` plus Cloudflare Pages Functions in `functions/`. KV binding `SITE` holds one JSON doc under the key `site`. `/admin*` sits behind Cloudflare Access, and `functions/_access.js` also verifies the `Cf-Access-Jwt-Assertion` RS256 JWT (signature, exp, aud, email allowlist).
- `functions/index.js` + `_render.js` serve `/` with the headlines already in the HTML; if you change the front page markup in `index.html` or the rendering in `app.js`, keep `_render.js` in step.
- Colors: burnt orange `#BF5700` (CSS variable `--orange`) on white. Columns: `left` = GRIDIRON (football), `center` = THE WIRE (recruiting, program news, opponents), `right` = HOOPS · NET · DIAMOND (basketball, volleyball, baseball, softball and other sports).
- X handle: @dailylonghorns (twitter:site meta tags, the JSON-LD `sameAs` in `index.html`, and the About page).
- Gameday look: add football game dates to `GAMEDAYS` in `public/app.js` to turn the whole page burnt orange. Preview with `?theme=gameday`.

---

## Scheduled updates (automatic)

Two scheduled Claude tasks keep the front page current (their prompts are in HANDOFF.md):
- **Morning** (about 5:20 AM Central): the full daily rebuild. Sets the ticker to the next 3 Texas events, expires previews of games already played, adds fresh stories to each column in `public/auto.json`, keeps `public/history.json` (On This Day) filled for the coming week, and writes the day's rundown in `public/rundowns.json`.
- **Midday + evening** (about noon and 7 PM Central): a lighter refresh of `public/auto.json` only.

They never touch the feature spot or top links, which stay in the owner's editor. The morning update does set a daily banner (an automatic story with slot "banner" and a photo): while it shows, the owner's own banner drops into the column named in its "dropTo". Hide it in the editor to bring your banner back, or click "edit" to make it your own banner. The editor has an "Added automatically this morning" section where the owner can hide any automatic story.
