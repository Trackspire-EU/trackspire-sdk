import { onLCP, onCLS, onINP, onFCP, onTTFB, type Metric } from "web-vitals";
import { currentConfig } from "./config";
import { track } from "./core";
import { logError } from "./utils";
import type { WebVitalsData } from "./types";

export function initWebVitals(): void {
    if (!currentConfig.enableWebVitals) {
        return;
    }

    const data: WebVitalsData = { lcp: null, cls: null, inp: null, fcp: null, ttfb: null };
    let sent = false;

    const sendData = () => {
        if (sent) return;

        // Nothing measured yet, e.g. a tab that was opened in the background and closed again
        const hasAnyMetric = Object.values(data).some(value => value !== null);
        if (!hasAnyMetric) return;

        sent = true;

        track("performance", { eventName: "web-vitals", webVitals: data });
    };

    const collectMetric = (metric: Metric) => {
        if (sent) return;

        const metricName = metric.name.toLowerCase() as keyof WebVitalsData;
        data[metricName] = metric.value;

        const allCollected = Object.values(data).every(value => value !== null);
        if (allCollected) {
            sendData();
        }
    };

    try {
        onLCP(collectMetric);
        onCLS(collectMetric);
        onINP(collectMetric);
        onFCP(collectMetric);
        onTTFB(collectMetric);

        // LCP, CLS and INP are only final once the page is hidden. The library reports them in its own
        // visibilitychange listeners, which were registered above and therefore run before this one.
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") {
                sendData();
            }
        });

        // Fallback for browsers that unload without a preceding visibilitychange
        window.addEventListener("pagehide", sendData);
    } catch (e) {
        logError("Error initializing web vitals tracking:", e);
    }
}
