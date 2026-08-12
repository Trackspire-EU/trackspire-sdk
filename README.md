# @trackspire/sdk

Official JavaScript/TypeScript SDK for [Trackspire](https://trackspire.io).

## Installation

```bash
npm install @trackspire/sdk
# or
bun add @trackspire/sdk
```

## Usage

```ts
import trackspire from "@trackspire/sdk";

trackspire.init({
  analyticsHost: "https://track.example.com",
  siteId: "your-site-id",
});
```

That's it — pageviews, SPA/hash-route navigation, outbound links, and any feature enabled on the site (button clicks, copy, form interactions, error tracking, Core Web Vitals) start tracking automatically. Feature flags are resolved remotely per site, not passed in config.

### API

```ts
trackspire.pageview(path?);                 // manual/virtual pageview
trackspire.event(name, properties?);         // custom event
trackspire.trackOutbound(url, text?, target?);
trackspire.identify(userId);
trackspire.clearUserId();
trackspire.getUserId();
trackspire.error(error, context?);           // manual error capture
trackspire.onPageChange(callback);           // returns unsubscribe fn
trackspire.cleanup();                        // remove all listeners
```

### Config

```ts
interface TrackspireConfig {
  analyticsHost: string;      // required
  siteId: string;              // required
  debounceDuration?: number;   // default 500ms
  skipPatterns?: string[];     // paths to exclude, e.g. ["/admin/**"]
  maskPatterns?: string[];     // paths to anonymize, e.g. ["/users/*"]
  debug?: boolean;
}
```

### Opt-out

Respects `localStorage.getItem("disable-trackspire")` and `window.__TRACKSPIRE_OPTOUT__` — set either before `init()` runs to disable tracking entirely.
