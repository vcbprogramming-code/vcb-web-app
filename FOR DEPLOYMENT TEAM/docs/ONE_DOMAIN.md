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
separate origins. **Theme, language and session do not carry between them in the
preview, and that is expected.** It is a limitation of running eight dev servers
side by side, not a bug in the apps, and it disappears once they are served from
one domain.

Do not "fix" it by writing the theme to a cookie or a query parameter. That
would add a mechanism that exists only to paper over the preview, and it would
still be there after the real deployment made it pointless.

---

## Checking it worked

After deploying, from one browser:

1. Set the portal to dark, and to Thai.
2. Open HR from a tile. It should be dark and Thai, without being asked to sign
   in.
3. `DevTools → Application → Local Storage` should show **one** origin,
   `vcb-connect.com`, holding `vcb_theme`, `vcb_lang` and `vcb_token`.

Two origins listed there means the rewrites are not in place.
