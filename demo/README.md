# Kivo showcase site

A premium, show-don't-tell landing page whose centerpiece is the **real Kivo app**.

## How it works

- `app.html` boots the genuine app (`../src/App.tsx`, the same components, tokens and font) in a browser tab.
- The app already knows how to talk to a cashier PC over `/api/lan/*`. `src/mock/host.ts` answers those requests from memory (`src/mock/seed.ts` is a pharmacy-minimart with 30 days of generated sales), so nothing needs a backend, an install or an account. Sales, customers and stock changes made in the demo are real within the session.
- `src/app/scenes.ts` are scripted walkthroughs that drive the real DOM with a visible pointer. The marketing page (`index.html`) embeds the app in device frames and tells each frame which scene to play with `postMessage`.
- The Android screens (connect, update sheet, customer form) run by presenting the app as the Android client (`?device=android`) with a stubbed native bridge.

## Develop

Everything builds from the repository root so React, Tailwind and the design tokens are the exact copies the app uses:

```bash
npm ci
npm run demo:dev      # http://localhost:1430
npm run demo:build    # type-check + build into demo/dist
```

Useful URLs while developing:

- `/app.html?device=desktop&theme=dark&scene=pos` the app alone, playing the `pos` scene
- `/app.html?device=android&scene=p-customer` the Android app

## Release and deploy

`.github/workflows/demo.yml` publishes `demo/dist` to GitHub Pages. The release workflow dispatches it after a release is published, so the site always matches the newest version; it also runs on pushes to `main` that touch `src/` or `demo/`. The download section additionally asks the GitHub API for the latest release at runtime.

One-time setup: **Settings -> Pages -> Build and deployment -> Source: GitHub Actions**.

## Add a scene

1. Write it in `src/app/scenes.ts` (use `c.click`, `c.type`, `c.navigate`, text matches the Indonesian UI).
2. Give it a duration in `src/site/sceneTimes.ts` if it is used in a loop.
3. Reference it from a section in `src/site/sections/`.
