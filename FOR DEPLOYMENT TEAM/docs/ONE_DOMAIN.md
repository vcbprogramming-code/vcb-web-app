# One domain, paths not subdomains

*Why every module must be served from the same origin, and what silently breaks
if they are not.*

---

## The requirement

```
vcb-connect.com/          portal
vcb-connect.com/hr        HR Work Log
vcb-connect.com/credit    Credit Facility
vcb-connect.com/sop       SOP
vcb-connect.com/minutes   Meeting Minutes
vcb-connect.com/map       System Map
vcb-connect.com/onboard   Onboarding
vcb-connect.com/ememo     E-Memo
```

**Not** `hr.vcb-connect.com`, and **not** separate Vercel project URLs.

---

## Why

Three pieces of state live in `localStorage`, and **`localStorage` is scoped to
an origin** — scheme + host + port. Nothing is shared across two different
hosts, and a subdomain is a different host.

| Key | Holds | Breaks as separate origins |
|---|---|---|
| `vcb_theme` | light / dark / auto | Portal set to dark, HR opens light |
| `vcb_lang` | th / en | Portal in Thai, Credit in English |
| `vcb_token` | the session | Signed in at the portal, asked to sign in again by every app |

`shared/src/theme.jsx` and `shared/src/i18n.jsx` already read and write one key
each. The mechanism is correct; only the deployment can break it.

The sign-in one is the serious case. The portal authenticates and every module
reads the token it left behind. On separate origins each module finds no token
— and because the modules are deliberately not gated, they render an empty
shell rather than a sign-in prompt, which looks like a data outage rather than a
configuration mistake.

---

## How, on Vercel

Each module stays its own Vercel project, built from its own folder — the
`vercel.json` files already do this. They are joined at the edge, not merged
into one build:

1. Point the domain at the **portal** project.
2. In the portal's `vercel.json`, rewrite each path prefix to the corresponding
   deployment:

```json
{
  "rewrites": [
    { "source": "/hr/:path*",      "destination": "https://vcb-hr.vercel.app/:path*" },
    { "source": "/credit/:path*",  "destination": "https://vcb-credit.vercel.app/:path*" },
    { "source": "/sop/:path*",     "destination": "https://vcb-sop.vercel.app/:path*" },
    { "source": "/minutes/:path*", "destination": "https://vcb-minutes.vercel.app/:path*" },
    { "source": "/map/:path*",     "destination": "https://vcb-map.vercel.app/:path*" },
    { "source": "/onboard/:path*", "destination": "https://vcb-onboard.vercel.app/:path*" },
    { "source": "/ememo/:path*",   "destination": "https://vcb-ememo.vercel.app/:path*" }
  ]
}
```

A rewrite, not a redirect. A redirect changes the address bar and the browser
lands on the other origin — which is the problem this exists to avoid.

3. Set each module's Vite `base` to its path (`base: '/hr/'`) so its asset URLs
   resolve under the prefix.
4. Set `portal.apps.url` to the **path** (`/hr`), not the Vercel URL. That table
   is what the tiles link to.

---

## The preview is not like this

Locally each module runs on its own port — 5180, 5181, 5182 … — which are
separate origins, and `localStorage` is per-origin. A module on 5185 cannot
read what the portal wrote on 5180.

**This has a real fix, already in the code, not a preview-only workaround:**
every module link carries `?theme=` and `?lang=` (see `appLink()` in
portal/src/data.js), and the shared providers read and persist them on arrival.
A module that skips this — E-Memo, being outside `@vcb/shared` — has to read
the same two parameters itself in its own pre-paint bootstrap. This is the
actual cross-origin mechanism, in production as much as locally; on one domain
it simply has nothing to do, because there is only one origin to carry state
between.

Two environment variables the checked-in `.env.example` files do not set,
because they are correctly empty in production (one domain, so a relative
`/api/...` and a relative portal link both resolve). Locally they do not
resolve, and skipping this is why a page can render its shell with no data —
"Failed to load data" — while the banner looks perfect. Add a gitignored
`.env.local` per module:

```
VITE_PORTAL_URL=http://localhost:5180
VITE_API_URL=http://localhost:3000
```

See `docs/CHROME.md` for the rest of what these carry across origins.

---

## Checking it worked

After deploying, from one browser:

1. Set the portal to dark, and to Thai.
2. Open HR from a tile. It should be dark and Thai, without being asked to sign
   in.
3. `DevTools → Application → Local Storage` should show **one** origin,
   `vcb-connect.com`, holding `vcb_theme`, `vcb_lang` and `vcb_token`.

Two origins listed there means the rewrites are not in place.
