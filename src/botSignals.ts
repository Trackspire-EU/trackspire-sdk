export interface BotSignalResult {
    score: number;
    mask: number;
}

let cachedResult: BotSignalResult | null = null;

/** Detect automation signals client-side. Result cached for page lifetime. */
export function computeBotSignals(): BotSignalResult {
    if (cachedResult !== null) {
        return cachedResult;
    }

    let score = 0;
    let mask = 0;

    const ua = navigator.userAgent.toLowerCase();
    const isChromeLike = /chrome|chromium/.test(ua) && !/edge|opr|firefox/.test(ua);
    const isMobile = /mobile|android|iphone|ipad/.test(ua);

    // Bit 0 (weight 3): webdriver flag or automation globals
    if (
        navigator.webdriver === true ||
        "__webdriver_evaluate" in window ||
        "__selenium_evaluate" in window ||
        "_phantom" in window ||
        "__nightmare" in window ||
        "domAutomation" in window
    ) {
        score += 3;
        mask |= 1 << 0;
    }

    // Bit 1 (weight 2): zero outer dimensions (headless default)
    if (window.outerWidth === 0 && window.outerHeight === 0) {
        score += 2;
        mask |= 1 << 1;
    }

    // Bit 2 (weight 1): window.chrome absent on Chrome UA
    if (isChromeLike && !("chrome" in window)) {
        score += 1;
        mask |= 1 << 2;
    }

    // Bit 3 (weight 1): SwiftShader / software renderer (Puppeteer/Playwright default)
    try {
        const canvas = document.createElement("canvas");
        const gl = (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
        if (gl) {
            const dbg = gl.getExtension("WEBGL_debug_renderer_info");
            if (dbg) {
                const renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) as string;
                if (/swiftshader|llvmpipe|virtualbox|vmware/i.test(renderer)) {
                    score += 1;
                    mask |= 1 << 3;
                }
            }
        }
    } catch {
        // WebGL unavailable — not a bot signal
    }

    // Bit 4 (weight 1): empty plugin list on Chrome (real browsers have plugins)
    if (isChromeLike && navigator.plugins.length === 0) {
        score += 1;
        mask |= 1 << 4;
    }

    // Bit 5 (weight 3): 800×600 default headless viewport on non-mobile UA
    if (!isMobile && screen.width === 800 && screen.height === 600) {
        score += 3;
        mask |= 1 << 5;
    }

    // Bit 6 (weight 3): 1024×768 default headless viewport on non-mobile UA
    if (!isMobile && screen.width === 1024 && screen.height === 768) {
        score += 3;
        mask |= 1 << 6;
    }

    // Bit 7 (weight 3): impossible screen dimensions
    if (screen.width <= 0 || screen.height <= 0 || screen.width > 100_000 || screen.height > 100_000) {
        score += 3;
        mask |= 1 << 7;
    }

    // Bit 8 (weight 2): outer < inner dimension mismatch (automation artifact)
    if (window.outerWidth > 0 && window.outerWidth < window.innerWidth - 8) {
        score += 2;
        mask |= 1 << 8;
    }

    cachedResult = { score: Math.min(score, 10), mask };
    return cachedResult;
}
