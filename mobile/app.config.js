const fs = require("fs");

/**
 * Extends app.json. Push notifications need Firebase: download google-services.json from your Firebase project
 * (Project settings > Your apps > Android, package com.birrpulse.app) and place it next to this file.
 * Without the file the app still builds; only remote push is unavailable.
 */
module.exports = ({ config }) => {
  const hasFirebase = fs.existsSync("./google-services.json");
  return {
    ...config,
    name: config.name || "BirrPulse",
    slug: config.slug || "birrpulse",
    android: {
      ...config.android,
      ...(hasFirebase ? { googleServicesFile: "./google-services.json" } : {}),
    },
  };
};
