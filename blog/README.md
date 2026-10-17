# BirrPulse website

Landing page + blog for the BirrPulse money-tracking app.
React 19, Vite, Tailwind CSS 4, Three.js (react-three-fiber + drei), Framer Motion, React Router.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in /dist
```

## Before you launch

1. **Add your APK**: copy it to `public/downloads/birrpulse.apk`
   (or host it elsewhere, e.g. a GitHub Release, and paste the URL into `src/config.js`).
2. **Edit `src/config.js`**: site URL (used by the QR code), version/size, Google Play link (the Play button appears only when set), the list of supported banks, support email.
3. **Check the screenshots for private data.** Names of people, the email on the profile screen and the transaction reference are already blurred. Amounts and the balance are not. If they are real, replace them with demo data and retake the screenshots.
4. **Have the Amharic reviewed.** Feature names come from the app's own Amharic text. The rest was written for the site and should be checked by a native speaker.

## Where things are

| Want to change | Edit |
| --- | --- |
| Screenshot captions and tabs | `src/data/shots.js` and `public/shots/` (b1 to b9) |
| Blog posts | `src/data/posts.js` (add an object at the top of the array) |
| English / Amharic text | `src/i18n.jsx` |
| FAQ | `faqs` in `src/sections/Faq.jsx` |
| Feature tiles | `tiles` in `src/sections/Features.jsx` |
| Colors and fonts | `@theme` block in `src/index.css` |
| The 3D hero (BirrPulse mark, coins and SMS bubbles) | `src/components/three/HeroScene.jsx` |
| The instant SVG version of the hero | `src/components/HeroVisual.jsx` |
| The 3D phone in the download section | `src/components/three/PhoneScene.jsx` |

## How the hero loads fast

The SVG mark paints immediately. The 3D scene loads when the browser is idle, renders its first frames, then fades in over the SVG. With reduced motion, Data Saver or no WebGL, the SVG stays and Three.js is never downloaded.

## Deploy

Vercel: import the repo, framework "Vite". `vercel.json` handles page refreshes on `/blog/...`.
Netlify: `public/_redirects` is included.
A single static file on Vercel is limited to 100 MB, so host a very large APK on a GitHub Release.
