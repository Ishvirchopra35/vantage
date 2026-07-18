// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://347e69e3099305bfc1d9bb6531d9a359@o4511745659961344.ingest.us.sentry.io/4511745665138688",

  // Add optional integrations for additional features
  integrations: [Sentry.replayIntegration()],

  // Full tracing in dev; 10% in production so real traffic doesn't burn the
  // free-plan transaction quota. Errors are always captured regardless.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1,

  // Noise thrown by scripts that in-app browsers (Instagram/Facebook iOS
  // WebView) inject into every page — not Vantage code.
  ignoreErrors: [
    "window.webkit.messageHandlers",
    "_AutofillCallbackHandler",
    "instantSearchSDKJSBridgeClearHighlight",
  ],
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
