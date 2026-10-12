import { currentConfig } from "./config";
import { track } from "./core";
import { log } from "./utils";
import type { FormSubmitProperties, InputChangeProperties } from "./types";

let submitListener: ((event: Event) => void) | null = null;
let changeListener: ((event: Event) => void) | null = null;

export function setupFormTracking(): void {
    if (!currentConfig.trackFormInteractions) {
        return;
    }

    log("Setting up form tracking");

    submitListener = (event: Event) => handleSubmit(event);
    changeListener = (event: Event) => handleChange(event);

    document.addEventListener("submit", submitListener, true);
    document.addEventListener("change", changeListener, true);
}

export function cleanupFormTracking(): void {
    if (submitListener) {
        document.removeEventListener("submit", submitListener, true);
        submitListener = null;
    }
    if (changeListener) {
        document.removeEventListener("change", changeListener, true);
        changeListener = null;
    }
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

function handleSubmit(event: Event): void {
    const form = event.target as HTMLFormElement;
    if (form.tagName !== "FORM") return;

    const properties: FormSubmitProperties = {
        formId: form.id || "",
        formName: form.name || "",
        formAction: form.action || "",
        method: (form.method || "get").toUpperCase(),
        fieldCount: form.elements.length,
        ariaLabel: form.getAttribute("aria-label") || undefined,
        ...extractDataAttributes(form),
    };

    track("form_submit", { properties });
}

function handleChange(event: Event): void {
    const target = event.target as HTMLElement;
    const tagName = target.tagName.toUpperCase();

    if (!["INPUT", "SELECT", "TEXTAREA"].includes(tagName)) return;

    // Skip hidden inputs and password fields for privacy
    if (tagName === "INPUT") {
        const inputType = (target as HTMLInputElement).type?.toLowerCase();
        if (inputType === "hidden" || inputType === "password") return;
    }

    const properties: InputChangeProperties = {
        element: tagName.toLowerCase(),
        inputType: tagName === "INPUT" ? (target as HTMLInputElement).type?.toLowerCase() : undefined,
        inputName: (target as HTMLInputElement).name || target.id || "",
        formId: (target as HTMLInputElement).form?.id || undefined,
        formName: (target as HTMLInputElement).form?.name || undefined,
        ...extractDataAttributes(target),
    };

    track("input_change", { properties });
}
