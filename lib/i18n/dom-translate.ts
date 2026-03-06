import { AppLanguage } from "@/lib/i18n/messages";
import { translateLiteral } from "@/lib/i18n/literals";

const ATTRIBUTES_TO_TRANSLATE = ["placeholder", "title", "aria-label"] as const;

type TranslatableAttribute = (typeof ATTRIBUTES_TO_TRANSLATE)[number];

function originalAttrKey(name: TranslatableAttribute) {
    return `data-i18n-orig-${name}`;
}

function withPreservedWhitespace(source: string, translatedCore: string) {
    const leading = source.match(/^\s*/)?.[0] || "";
    const trailing = source.match(/\s*$/)?.[0] || "";
    return `${leading}${translatedCore}${trailing}`;
}

function shouldSkipTextNode(node: Text) {
    const parent = node.parentElement;
    if (!parent) return true;
    if (parent.closest("[data-i18n-skip='true']")) return true;

    const tagName = parent.tagName;
    if (tagName === "SCRIPT" || tagName === "STYLE" || tagName === "NOSCRIPT") return true;
    return false;
}

export function applyDomLiteralTranslations(
    root: ParentNode,
    language: AppLanguage,
    originalTextMap: WeakMap<Text, string>
) {
    if (!(root instanceof Element || root instanceof Document || root instanceof DocumentFragment)) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();
    while (current) {
        const textNode = current as Text;
        if (!shouldSkipTextNode(textNode)) {
            const original = originalTextMap.get(textNode) ?? textNode.nodeValue ?? "";
            if (!originalTextMap.has(textNode)) {
                originalTextMap.set(textNode, original);
            }
            const translatedCore = translateLiteral(language, original.trim());
            if (translatedCore) {
                textNode.nodeValue = withPreservedWhitespace(original, translatedCore);
            }
        }
        current = walker.nextNode();
    }

    const elements = root.querySelectorAll<HTMLElement>(
        ATTRIBUTES_TO_TRANSLATE.map((attr) => `[${attr}]`).join(",")
    );
    elements.forEach((element) => {
        ATTRIBUTES_TO_TRANSLATE.forEach((attr) => {
            const originalKey = originalAttrKey(attr);
            const existingOriginal = element.getAttribute(originalKey);
            const currentValue = element.getAttribute(attr);
            if (!existingOriginal && currentValue !== null) {
                element.setAttribute(originalKey, currentValue);
            }
            const source = element.getAttribute(originalKey);
            if (!source) return;
            const translated = translateLiteral(language, source);
            if (translated) {
                element.setAttribute(attr, translated);
            }
        });
    });
}
