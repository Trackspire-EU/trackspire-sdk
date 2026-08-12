import { currentConfig } from "./config";
import { track } from "./core";
import { log, logError } from "./utils";
import type { TrackProperties } from "./types";

let errorListener: ((event: ErrorEvent) => void) | null = null;
let rejectionListener: ((event: PromiseRejectionEvent) => void) | null = null;

const errorDedupeCache = new Map<string, number>();
let errorDedupeLastCleanup = 0;

export function setupErrorTracking(): void {
    if (!currentConfig.trackErrors) {
        return;
    }

    log("Setting up error tracking");

    errorListener = (event: ErrorEvent) => {
        handleError(event);
    };

    rejectionListener = (event: PromiseRejectionEvent) => {
        handleRejection(event);
    };

    window.addEventListener("error", errorListener);
    window.addEventListener("unhandledrejection", rejectionListener);
}

export function cleanupErrorTracking(): void {
    if (errorListener) {
        window.removeEventListener("error", errorListener);
        errorListener = null;
    }
    if (rejectionListener) {
        window.removeEventListener("unhandledrejection", rejectionListener);
        rejectionListener = null;
    }
    errorDedupeCache.clear();
    log("Error tracking cleaned up");
}

function handleError(event: ErrorEvent): void {
    trackError(event.error || new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
    });
}

function handleRejection(event: PromiseRejectionEvent): void {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    trackError(error, { type: "unhandledrejection" });
}

function trackError(error: Error, additionalInfo: TrackProperties = {}): void {
    // Filter known browser-generated noise errors that are not actionable
    const message = error?.message || "";
    if (
        message.includes("ResizeObserver loop completed with undelivered notifications") ||
        message.includes("ResizeObserver loop limit exceeded")
    ) {
        return;
    }

    // Industry-standard filtering: only track errors from the same origin to avoid noise from third-party scripts
    const currentOrigin = window.location.origin;
    const filename = (additionalInfo.filename as string) || "";
    const errorStack = error.stack || "";

    if (filename) {
        try {
            const fileUrl = new URL(filename);
            if (fileUrl.origin !== currentOrigin) {
                return; // Skip third-party script errors
            }
        } catch (e) {
            // Not a valid URL — might be relative or browser-generated, fall through to stack check
        }
    } else if (errorStack) {
        if (!errorStack.includes(currentOrigin)) {
            return; // Skip third-party script errors
        }
    }

    // Dedupe identical errors within 60 seconds to prevent spam
    const dedupeKey = [
        error.name || "Error",
        message,
        additionalInfo.filename || "",
        additionalInfo.lineno ?? "",
        additionalInfo.colno ?? "",
    ].join("|");
    const now = Date.now();
    const dedupeWindowMs = 60_000;
    const lastSeen = errorDedupeCache.get(dedupeKey);
    if (lastSeen && now - lastSeen < dedupeWindowMs) {
        return;
    }
    errorDedupeCache.set(dedupeKey, now);

    // Periodically prune old keys to prevent unbounded growth
    if (now - errorDedupeLastCleanup > dedupeWindowMs) {
        for (const [key, ts] of errorDedupeCache.entries()) {
            if (now - ts > 10 * 60_000) {
                errorDedupeCache.delete(key);
            }
        }
        errorDedupeLastCleanup = now;
    }

    const errorProperties: TrackProperties = {
        message: message.substring(0, 500) || "Unknown error",
        stack: errorStack.substring(0, 2000) || "",
    };

    if (filename) {
        errorProperties.fileName = filename;
    }

    const lineno = additionalInfo.lineno;
    if (lineno) {
        const lineNum = typeof lineno === "string" ? parseInt(lineno, 10) : lineno;
        if (lineNum) {
            errorProperties.lineNumber = lineNum;
        }
    }

    const colno = additionalInfo.colno;
    if (colno) {
        const colNum = typeof colno === "string" ? parseInt(colno, 10) : colno;
        if (colNum) {
            errorProperties.columnNumber = colNum;
        }
    }

    for (const key in additionalInfo) {
        if (!["filename", "lineno", "colno"].includes(key) && additionalInfo[key] !== undefined) {
            errorProperties[key] = additionalInfo[key];
        }
    }

    track("error", { eventName: error.name || "Error", properties: errorProperties });
}

export function captureError(error: Error | ErrorEvent, context: TrackProperties = {}): void {
    if (!currentConfig.trackErrors) {
        logError("Error tracking is not enabled. Enable it via remote config.");
        return;
    }

    if (error instanceof ErrorEvent) {
        trackError(error.error || new Error(error.message), {
            ...context,
            filename: error.filename,
            lineno: error.lineno,
            colno: error.colno,
        });
    } else {
        trackError(error, context);
    }
}
