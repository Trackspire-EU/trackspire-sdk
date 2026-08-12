import { currentConfig } from "./config";
import { computeBotSignals } from "./botSignals";
import { findMatchingPattern, log, logError, getPathname } from "./utils";
import type { EventType, TrackPayload, TrackProperties, WebVitalsData } from "./types";

let customUserId: string | null = null;
let isOptedOut = false;

try {
    const storedUserId = localStorage.getItem("trackspire-user-id");
    if (storedUserId) {
        customUserId = storedUserId;
    }

    if (localStorage.getItem("disable-trackspire") !== null) {
        isOptedOut = true;
    }
} catch (e) {
    logError("localStorage unavailable");
}

if (typeof window !== "undefined" && (window as any).__TRACKSPIRE_OPTOUT__) {
    isOptedOut = true;
}

export function track(
    eventType: EventType,
    eventData: {
        eventName?: string;
        properties?: TrackProperties;
        pathOverride?: string;
        webVitals?: WebVitalsData;
    } = {}
): void {
    if (isOptedOut) {
        log("Opted out of tracking.");
        return;
    }

    if (!currentConfig || !currentConfig.analyticsHost || !currentConfig.siteId) {
        logError("Trackspire config not available. Ensure trackspire.init() was called successfully.");
        return;
    }

    const { eventName, properties, pathOverride, webVitals } = eventData;

    if (eventType === "custom_event" && !eventName) {
        logError("Event name is required and must be a string for custom events.");
        return;
    }

    try {
        const url = new URL(window.location.href);
        let pathForTracking: string;
        let searchForTracking = "";

        if (eventType === "pageview" && typeof pathOverride === "string" && pathOverride.trim()) {
            log(`Using path override: ${pathOverride}`);
            try {
                if (!/^\//.test(pathOverride.trim()) && !/^https?:\/\//.test(pathOverride.trim())) {
                    throw new Error("pathOverride must start with /");
                }
                const overrideUrl = new URL(pathOverride.trim(), "http://dummybase");
                pathForTracking = overrideUrl.pathname;
                searchForTracking = overrideUrl.search || "";
            } catch (e) {
                logError(`Invalid pathOverride format: ${pathOverride}. Using window location.`);
                pathForTracking = getPathname();
                searchForTracking = currentConfig.trackQuerystring ? url.search : "";
            }
        } else {
            pathForTracking = getPathname();
            searchForTracking = currentConfig.trackQuerystring ? url.search : "";
        }

        if (eventType !== "performance" && findMatchingPattern(pathForTracking, currentConfig.skipPatterns)) {
            log(`Skipping track for path: ${pathForTracking}`);
            return;
        }

        const maskMatch = findMatchingPattern(pathForTracking, currentConfig.maskPatterns);
        if (maskMatch && eventType !== "performance") {
            log(`Masking path ${pathForTracking} as ${maskMatch}`);
            pathForTracking = maskMatch;
            searchForTracking = "";
        }

        const { score: _bs, mask: _bsm } = computeBotSignals();

        const typesWithProperties: EventType[] = [
            "custom_event",
            "outbound",
            "error",
            "button_click",
            "copy",
            "form_submit",
            "input_change",
        ];

        const payload: TrackPayload = {
            siteId: currentConfig.siteId,
            visitorId: currentConfig.visitorId,
            hostname: url.hostname,
            pathname: pathForTracking,
            querystring: searchForTracking,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            language: navigator.language,
            pageTitle: document.title,
            referrer: document.referrer,
            type: eventType,
            _bs,
            _bsm,
            ...(eventName && { eventName }),
            ...(typesWithProperties.includes(eventType) && { properties: JSON.stringify(properties ?? {}) }),
            ...(eventType === "performance" && webVitals && { ...webVitals }),
            ...(customUserId && { userId: customUserId }),
        };

        log("Sending track event:", payload);

        sendTrackingData(payload);
    } catch (error) {
        logError("Error during tracking:", error);
    }
}

function sendTrackingData(payload: TrackPayload): void {
    const data = JSON.stringify(payload);
    const endpoint = `${currentConfig.analyticsHost}/track`;

    if (navigator.sendBeacon) {
        const sent = navigator.sendBeacon(endpoint, new Blob([data], { type: "application/json" }));
        if (!sent) {
            logError("sendBeacon failed, falling back to fetch.");
            sendWithFetch(endpoint, data);
        }
    } else {
        sendWithFetch(endpoint, data);
    }
}

function sendWithFetch(endpoint: string, data: string): void {
    fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: data,
        mode: "cors",
        keepalive: true,
    }).catch(error => {
        logError("Fetch request failed:", error);
    });
}

async function sendIdentifyEvent(userId: string, isNewIdentify: boolean = true): Promise<void> {
    if (!currentConfig || !currentConfig.analyticsHost || !currentConfig.siteId) {
        logError("Trackspire config not available. Ensure trackspire.init() was called successfully.");
        return;
    }

    try {
        await fetch(`${currentConfig.analyticsHost}/identify`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                siteId: currentConfig.siteId,
                visitorId: currentConfig.visitorId,
                userId: userId,
                isNewIdentified: isNewIdentify,
            }),
            mode: "cors",
            keepalive: true,
        });
        log("Identify event sent:", { userId, isNewIdentify });
    } catch (error) {
        logError("Failed to send identify event:", error);
    }
}

export function identify(userId: string): void {
    if (typeof userId !== "string" || userId.trim() === "") {
        logError("User ID must be a non-empty string");
        return;
    }

    customUserId = userId.trim();
    try {
        localStorage.setItem("trackspire-user-id", customUserId);
        log("User identified:", customUserId);
    } catch (e) {
        logError("Could not persist user ID to localStorage");
    }

    sendIdentifyEvent(customUserId, true);
}

export function clearUserId(): void {
    customUserId = null;
    try {
        localStorage.removeItem("trackspire-user-id");
        log("User ID cleared");
    } catch (e) {
        logError("Could not remove user ID from localStorage");
    }
}

export function getUserId(): string | null {
    return customUserId;
}
