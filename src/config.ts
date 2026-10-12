import { log, logError } from "./utils";
import type { InternalTrackspireConfig, TrackspireConfig } from "./types";

// Local-only defaults (not controlled by remote config)
const localDefaults: Required<Omit<TrackspireConfig, "analyticsHost" | "siteId">> = {
    debounceDuration: 500,
    skipPatterns: [],
    maskPatterns: [],
    debug: false,
};

// Remote-controlled defaults (when remote config is disabled or fails)
const remoteDefaults = {
    autoTrackPageview: true,
    autoTrackSpa: true,
    trackQuerystring: true,
    trackOutbound: true,
    enableWebVitals: false,
    trackErrors: false,
    trackButtonClicks: false,
    trackCopy: false,
    trackFormInteractions: false,
};

let internalConfig: InternalTrackspireConfig | null = null;

export const currentConfig: Readonly<InternalTrackspireConfig> = new Proxy(
    {} as InternalTrackspireConfig,
    {
        get: (_, prop: keyof InternalTrackspireConfig) => {
            if (!internalConfig) {
                if (prop !== "debug") {
                    logError(
                        "Trackspire SDK accessed before initialization. Call trackspire.init() first."
                    );
                }
                return (localDefaults[prop as keyof typeof localDefaults] ??
                    remoteDefaults[prop as keyof typeof remoteDefaults] ??
                    undefined);
            }
            return internalConfig[prop];
        },
        set: () => {
            logError("Trackspire config is read-only after initialization.");
            return false;
        },
    }
);

interface RemoteConfig {
    autoTrackPageview: boolean;
    autoTrackSpa: boolean;
    trackQuerystring: boolean;
    trackOutbound: boolean;
    enableWebVitals: boolean;
    trackErrors: boolean;
    trackButtonClicks: boolean;
    trackCopy: boolean;
    trackFormInteractions: boolean;
}

function createVisitorId(): string {
    try {
        if (crypto?.randomUUID) {
            return crypto.randomUUID();
        }
    } catch (e) {
        // crypto may be unavailable in older browsers
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function getOrCreateVisitorId(): string {
    const key = "trackspire-visitor-id";
    try {
        const stored = localStorage.getItem(key);
        if (stored) return stored;
        const id = createVisitorId();
        localStorage.setItem(key, id);
        return id;
    } catch (e) {
        return createVisitorId();
    }
}

async function fetchRemoteConfig(
    analyticsHost: string,
    siteId: string
): Promise<RemoteConfig | null> {
    try {
        log("Fetching remote configuration...");
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(`${analyticsHost}/tracking-config?siteId=${siteId}`, {
            method: "GET",
            credentials: "omit",
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const result = await response.json();
            const apiConfig = result?.data?.config ?? {};
            log("Remote configuration fetched successfully", apiConfig);

            // Map API field names to internal config field names
            return {
                autoTrackPageview: apiConfig.trackInitial ?? remoteDefaults.autoTrackPageview,
                autoTrackSpa: apiConfig.trackSpaNavigation ?? remoteDefaults.autoTrackSpa,
                trackQuerystring: apiConfig.trackUrlParams ?? remoteDefaults.trackQuerystring,
                trackOutbound: apiConfig.trackOutbound ?? remoteDefaults.trackOutbound,
                enableWebVitals: apiConfig.webVitals ?? remoteDefaults.enableWebVitals,
                trackErrors: apiConfig.trackErrors ?? remoteDefaults.trackErrors,
                trackButtonClicks: apiConfig.trackButtonClicks ?? remoteDefaults.trackButtonClicks,
                trackCopy: apiConfig.trackCopy ?? remoteDefaults.trackCopy,
                trackFormInteractions: apiConfig.trackFormInteractions ?? remoteDefaults.trackFormInteractions,
            };
        }

        logError(`Failed to fetch remote config: ${response.status}`);
        return null;
    } catch (error) {
        if ((error as Error).name === "AbortError") {
            logError("Remote config fetch timed out");
        } else {
            logError("Error fetching remote config:", error);
        }
        return null;
    }
}

export async function initializeConfig(options: TrackspireConfig): Promise<boolean> {
    if (internalConfig) {
        logError("Trackspire SDK already initialized.");
        return false;
    }

    if (typeof options !== "object" || options === null) {
        logError(
            "Invalid configuration provided to trackspire.init(). Expected an object."
        );
        return false;
    }

    const analyticsHost = options.analyticsHost;
    if (!analyticsHost || analyticsHost.trim() === "") {
        logError(
            "`analyticsHost` is required in Trackspire config and must be a non-empty string."
        );
        return false;
    }
    const finalAnalyticsHost = analyticsHost.replace(/\/$/, "");

    const siteId = options.siteId;
    if (!siteId || siteId.trim() === "") {
        logError(
            "`siteId` is required in Trackspire config and must be a non-empty string."
        );
        return false;
    }

    const remoteConfig = await fetchRemoteConfig(finalAnalyticsHost, siteId);
    const finalRemoteConfig = remoteConfig || remoteDefaults;

    const validatedSkipPatterns = Array.isArray(options.skipPatterns)
        ? options.skipPatterns
        : localDefaults.skipPatterns;
    const validatedMaskPatterns = Array.isArray(options.maskPatterns)
        ? options.maskPatterns
        : localDefaults.maskPatterns;

    internalConfig = {
        // Required
        analyticsHost: finalAnalyticsHost,
        siteId: siteId,
        visitorId: getOrCreateVisitorId(),

        // Local settings (user can override)
        debounceDuration: Math.max(0, options.debounceDuration ?? localDefaults.debounceDuration),
        skipPatterns: validatedSkipPatterns,
        maskPatterns: validatedMaskPatterns,
        debug: options.debug ?? localDefaults.debug,

        // Remote-controlled settings (from API, not user config)
        autoTrackPageview: finalRemoteConfig.autoTrackPageview,
        autoTrackSpa: finalRemoteConfig.autoTrackSpa,
        trackQuerystring: finalRemoteConfig.trackQuerystring,
        trackOutbound: finalRemoteConfig.trackOutbound,
        enableWebVitals: finalRemoteConfig.enableWebVitals,
        trackErrors: finalRemoteConfig.trackErrors,
        trackButtonClicks: finalRemoteConfig.trackButtonClicks,
        trackCopy: finalRemoteConfig.trackCopy,
        trackFormInteractions: finalRemoteConfig.trackFormInteractions,
    };

    return true;
}
