export interface TrackspireConfig {
    // Required
    analyticsHost: string;
    siteId: string;

    // Local settings (not controlled by remote config)
    debounceDuration?: number;
    skipPatterns?: string[];
    maskPatterns?: string[];
    debug?: boolean;
}

// Internal config that includes remote-controlled settings
export interface InternalTrackspireConfig {
    analyticsHost: string;
    siteId: string;
    visitorId: string;

    debounceDuration: number;
    skipPatterns: string[];
    maskPatterns: string[];
    debug: boolean;

    // Remote-controlled settings (fetched from API)
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

export type EventType =
    | "pageview"
    | "custom_event"
    | "outbound"
    | "performance"
    | "error"
    | "button_click"
    | "copy"
    | "form_submit"
    | "input_change";

export type PropertyValue = string | number | boolean;

export interface TrackProperties {
    [key: string]: PropertyValue | PropertyValue[] | undefined;
}

export interface OutboundLinkProperties extends TrackProperties {
    url: string;
    text: string;
    target: string;
}

export interface ButtonClickProperties extends TrackProperties {
    text?: string;
}

export interface CopyProperties extends TrackProperties {
    text: string;
    textLength?: number;
    sourceElement: string;
}

export interface FormSubmitProperties extends TrackProperties {
    formId: string;
    formName: string;
    formAction: string;
    method: string;
    fieldCount: number;
    ariaLabel?: string;
}

export interface InputChangeProperties extends TrackProperties {
    element: string;
    inputType?: string;
    inputName: string;
    formId?: string;
    formName?: string;
}

export type PageChangeCallback = (pathname: string, previousPathname: string) => void;

export interface WebVitalsData {
    lcp: number | null;
    cls: number | null;
    inp: number | null;
    fcp: number | null;
    ttfb: number | null;
}

export interface BasePayload {
    siteId: string;
    visitorId: string;
    hostname: string;
    pathname: string;
    querystring: string;
    screenWidth: number;
    screenHeight: number;
    language: string;
    pageTitle: string;
    referrer: string;
    userId?: string;
    _bs: number;
    _bsm: number;
}

export interface TrackPayload extends BasePayload {
    type: EventType;
    eventName?: string;
    properties?: string;
    lcp?: number | null;
    cls?: number | null;
    inp?: number | null;
    fcp?: number | null;
    ttfb?: number | null;
}

export interface TrackspireApi {
    init: (config: TrackspireConfig) => Promise<void>;
    pageview: (path?: string) => void;
    event: (name: string, properties?: TrackProperties) => void;
    trackOutbound: (url: string, text?: string, target?: string) => void;
    identify: (userId: string) => void;
    clearUserId: () => void;
    getUserId: () => string | null;
    cleanup: () => void;
    error: (error: Error | ErrorEvent, context?: TrackProperties) => void;
    onPageChange: (callback: PageChangeCallback) => () => void;
}
