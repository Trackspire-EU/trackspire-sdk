import { currentConfig } from "./config";
import { track } from "./core";
import { log } from "./utils";
import type { ButtonClickProperties } from "./types";

let clickListener: ((event: MouseEvent) => void) | null = null;

export function setupClickTracking(): void {
    if (!currentConfig.trackButtonClicks) {
        return;
    }

    log("Setting up click tracking");

    clickListener = (event: MouseEvent) => handleClick(event);
    document.addEventListener("click", clickListener, true);
}

export function cleanupClickTracking(): void {
    if (clickListener) {
        document.removeEventListener("click", clickListener, true);
        clickListener = null;
    }
}

function handleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!isButton(target)) {
        return;
    }
    trackButtonClick(target);
}

function isButton(element: HTMLElement): boolean {
    if (element.tagName === "BUTTON") return true;
    if (element.getAttribute("role") === "button") return true;
    if (element.tagName === "INPUT") {
        const type = (element as HTMLInputElement).type?.toLowerCase();
        if (type === "submit" || type === "button") return true;
    }

    let parent = element.parentElement;
    let depth = 0;
    while (parent && depth < 3) {
        if (parent.tagName === "BUTTON") return true;
        if (parent.getAttribute("role") === "button") return true;
        parent = parent.parentElement;
        depth++;
    }

    return false;
}

function findButton(element: HTMLElement): HTMLElement | null {
    if (element.tagName === "BUTTON") return element;
    if (element.getAttribute("role") === "button") return element;
    if (element.tagName === "INPUT") {
        const type = (element as HTMLInputElement).type?.toLowerCase();
        if (type === "submit" || type === "button") return element;
    }

    let parent = element.parentElement;
    let depth = 0;
    while (parent && depth < 3) {
        if (parent.tagName === "BUTTON") return parent;
        if (parent.getAttribute("role") === "button") return parent;
        parent = parent.parentElement;
        depth++;
    }

    return null;
}

function extractDataAttributes(element: HTMLElement): Record<string, string> {
    const attrs: Record<string, string> = {};
    for (const attr of element.attributes) {
        if (attr.name.startsWith("data-trackspire-prop-")) {
            const key = attr.name.replace("data-trackspire-prop-", "");
            attrs[key] = attr.value;
        }
    }
    return attrs;
}

function getElementText(element: HTMLElement): string | undefined {
    const text = element.textContent?.trim().substring(0, 100);
    return text || undefined;
}

function trackButtonClick(element: HTMLElement): void {
    const buttonElement = findButton(element);
    if (!buttonElement) return;

    // Skip if button has custom event tracking
    if (buttonElement.hasAttribute("data-trackspire-event")) return;

    const properties: ButtonClickProperties = {
        text: getElementText(buttonElement),
        ...extractDataAttributes(buttonElement),
    };

    track("button_click", { properties });
}
