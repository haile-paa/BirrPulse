// Edit this file to update links and download details across the whole site.
export const site = {
  name: "BirrPulse",
  // Public URL of the deployed website (used for the QR code).
  url: "https://birrpulse.vercel.app",
  apk: {
    // Put the file in /public/downloads/ or point this at a GitHub Release / other host.
    url: "https://github.com/haile-paa/BirrPulse/releases/latest/download/birrpulse.apk",
    version: "1.0.0",
    size: "", // e.g. '48 MB' (hidden when empty)
    minAndroid: "", // e.g. 'Android 8.0+' (hidden when empty)
  },
  // Paste your Google Play link here. The Play button only shows when this is set.
  playStoreUrl: "",
  // Banks the parser currently understands. Edit as you add more.
  banks: [
    "Commercial Bank of Ethiopia",
    "Telebirr",
    "Awash Bank",
    "Dashen Bank",
    "Bank of Abyssinia",
  ],
  support: { email: "Haileyesuseyasu@gmail.com" },
  developer: {
    name: "Haileyesus Eyasu",
    portfolio: "https://haileyesus.vercel.app",
  },
};
