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
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const sendData = () => {
        if (sent) return;
        sent = true;

        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }

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

        // Send metrics even if not all are collected within a reasonable time.
        timeoutId = setTimeout(sendData, 20000);

        window.addEventListener("beforeunload", sendData);
    } catch (e) {
        logError("Error initializing web vitals tracking:", e);
    }
}
