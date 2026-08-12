import { initializeConfig, currentConfig } from "./config";
import { track, identify as identifyUser, clearUserId as clearStoredUserId, getUserId as getStoredUserId } from "./core";
import { setupAutoTracking, cleanupAutoTracking, setupDataAttributeTracking, addPageChangeCallback } from "./listeners";
import { initWebVitals } from "./webvitals";
import { setupErrorTracking, cleanupErrorTracking, captureError as captureErrorInternal } from "./errorTracking";
import { setupClickTracking, cleanupClickTracking } from "./clickTracking";
import { setupCopyTracking, cleanupCopyTracking } from "./copyTracking";
import { setupFormTracking, cleanupFormTracking } from "./formTracking";
import { log, logError } from "./utils";
import type { PageChangeCallback, TrackProperties, TrackspireApi, TrackspireConfig } from "./types";

let isInitialized = false;

const trackspire: TrackspireApi = {
    /**
     * Initializes the Trackspire SDK. Must be called before any other tracking methods.
     *
     * @param config - Configuration object.
     */
    init: async (config: TrackspireConfig) => {
        if (isInitialized) {
            logError("Trackspire SDK already initialized. Call init() only once.");
            return;
        }

        const initSuccess = await initializeConfig(config);
        if (!initSuccess) {
            return;
        }

        isInitialized = true;
        log("Config:", { ...currentConfig });

        setupAutoTracking();
        setupDataAttributeTracking();
        initWebVitals();

        setupErrorTracking();
        setupClickTracking();
        setupCopyTracking();
        setupFormTracking();
    },

    /**
     * Tracks a pageview event.
     *
     * Automatically called on initial load and SPA navigation if autoTrackPageviews is enabled.
     * Can be called manually for more control or to override the path.
     *
     * @param path - Optional. Override the detected path (and query string). Useful for virtual pageviews.
     */
    pageview: (path?: string) => {
        if (!isInitialized) {
            logError("Trackspire SDK not initialized. Call trackspire.init() first.");
            return;
        }
        track("pageview", { pathOverride: path });
    },

    /**
     * Tracks a custom event.
     *
     * @param name - The name of the custom event.
     * @param properties - Optional. An object containing additional data about the event.
     */
    event: (name: string, properties?: TrackProperties) => {
        if (!isInitialized) {
            logError("Trackspire SDK not initialized. Call trackspire.init() first.");
            return;
        }
        if (!name) {
            logError("Event name is required and must be a string.");
            return;
        }
        track("custom_event", { eventName: name, properties: properties });
    },

    /**
     * Manually tracks an outbound link click.
     *
     * Useful if automatic tracking is disabled or for links generated dynamically after load.
     *
     * @param url - The destination URL of the link.
     * @param text - Optional. The text content of the link.
     * @param target - Optional. The target attribute of the link.
     */
    trackOutbound: (
        url: string,
        text: string = "",
        target: string = "_self"
    ) => {
        if (!isInitialized) {
            logError("Trackspire SDK not initialized. Call trackspire.init() first.");
            return;
        }
        if (!url) {
            logError("Outbound link URL is required and must be a string.");
            return;
        }
        track("outbound", { properties: { url, text, target } });
    },

    /**
     * Identifies a user with a custom user ID.
     *
     * @param userId - The user ID to associate with tracking events.
     */
    identify: (userId: string) => {
        if (!isInitialized) {
            logError("Trackspire SDK not initialized. Call trackspire.init() first.");
            return;
        }
        identifyUser(userId);
    },

    /**
     * Clears the current user ID.
     */
    clearUserId: () => {
        if (!isInitialized) {
            logError("Trackspire SDK not initialized. Call trackspire.init() first.");
            return;
        }
        clearStoredUserId();
    },

    /**
     * Gets the current user ID.
     *
     * @returns The current user ID or null if not set.
     */
    getUserId: () => {
        if (!isInitialized) {
            logError("Trackspire SDK not initialized. Call trackspire.init() first.");
            return null;
        }
        return getStoredUserId();
    },

    /**
     * Manually captures an error for tracking.
     *
     * @param error - The error to capture (Error or ErrorEvent).
     * @param context - Optional. Additional context about the error.
     */
    error: (error: Error | ErrorEvent, context?: TrackProperties) => {
        if (!isInitialized) {
            logError("Trackspire SDK not initialized. Call trackspire.init() first.");
            return;
        }
        captureErrorInternal(error, context);
    },

    /**
     * Registers a callback to be called when the page/route changes.
     *
     * @param callback - Function to call on page change. Receives (newPath, previousPath).
     * @returns A function to unsubscribe the callback.
     */
    onPageChange: (callback: PageChangeCallback) => {
        if (!isInitialized) {
            logError("Trackspire SDK not initialized. Call trackspire.init() first.");
            return () => {};
        }
        return addPageChangeCallback(callback);
    },

    /**
     * Cleans up event listeners set up by the SDK.
     *
     * Useful in SPA environments where the SDK might be re-initialized or removed.
     */
    cleanup: () => {
        cleanupAutoTracking();
        cleanupErrorTracking();
        cleanupClickTracking();
        cleanupCopyTracking();
        cleanupFormTracking();
        isInitialized = false;
    }
};

export default trackspire;
