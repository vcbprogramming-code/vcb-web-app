# GlobeHero

Pure-CSS 3D rotating globe (wireframe sphere, two orbiting rings, radar scan
sweep). Added alongside the existing `GlowOrb.jsx` / `GlobeMark.jsx` — nothing
existing was changed or removed. Use this to **replace** the globe currently
shown on the Portal hero / Login, or run it side by side to compare.

## To use it

```jsx
import GlobeHero from './components/GlobeHero';
import './components/GlobeHero.css';

// wherever <GlowOrb /> is currently rendered:
<GlobeHero />
```

## To get the intro "power-up" animation

The core-ignite / wireframe-draw-in / shockwave-pulse sequence is gated
behind a `.js` class on `<html>`. Add once, e.g. in `main.jsx`:

```js
document.documentElement.classList.add('js');
```

Without it, the globe still renders and spins continuously — it just skips
the one-time intro choreography.

## To fully replace GlowOrb

1. Import `GlobeHero` + `GlobeHero.css` wherever `GlowOrb` is currently
   imported (likely the Portal header/hero and Login page — search for
   `GlowOrb` usages).
2. Swap `<GlowOrb size={340} />` → `<GlobeHero />`.
3. `GlobeHero` has a fixed internal size (280px sphere in a 380px stage) with
   responsive breakpoints already built in (`@media` rules at the bottom of
   `GlobeHero.css`), rather than a `size` prop — adjust `--globe-scale` on
   `.globe-stage` if you need a specific pixel size to match a layout slot.
4. Once confirmed working, `GlowOrb.jsx`/`GlobeMark.jsx` can be deleted if no
   longer referenced anywhere.
