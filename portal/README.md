# TabPlugins website

This static catalog links the two official product websites. It has no checkout or account system. The existing GA4 website tag measures catalog visits; it is not part of either extension. Deployment uses the checked-in Cloudflare Worker config.

## 2026-10-17 button visibility fix

The `.vault a` link color overrode the generic button text color, making the TabVault button text match its green background. `.vault .button` now explicitly sets white text. Product links and the existing GA4 tag are preserved. Verified at 360, 768, 1440 and 2048px on both the apex and www domains.
