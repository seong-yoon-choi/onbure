import { getTitlePropertyName } from "./notion-schema";

// Helper to build Notion API payload properties dynamically based on Schema
export function buildProps(schema: any, data: Record<string, any>) {
    const propsPayload: Record<string, any> = {};
    const schemaProps = schema.properties;
    const titleKey = getTitlePropertyName(schema);

    for (const key in data) {
        const value = data[key];

        // Handle Title specially
        if (key === "title") {
            // User passed "title" logical field, map to actual title column
            propsPayload[titleKey] = {
                title: [{ text: { content: value } }]
            };
            continue;
        }

        // Standard properties
        // If the key exists in schema, use its type.
        const propDef = schemaProps[key];
        if (!propDef) {
            // Warning: Property in data is not in Notion Schema. Ignoring or Log?
            // console.warn(`Property '${key}' not found in Notion DB Schema. Skipping.`);
            continue;
        }

        const type = propDef.type;

        switch (type) {
            case "rich_text":
                propsPayload[key] = {
                    rich_text: [{ text: { content: String(value) } }]
                };
                break;
            case "number":
                propsPayload[key] = {
                    number: Number(value)
                };
                break;
            case "select":
                // Select requires 'name'
                propsPayload[key] = {
                    select: { name: String(value) }
                };
                break;
            case "multi_select":
                // Expect array of strings
                if (Array.isArray(value)) {
                    propsPayload[key] = {
                        multi_select: value.map(v => ({ name: String(v) }))
                    };
                }
                break;
            case "date":
                // Expect ISO string or Date object
                const dateStr = value instanceof Date ? value.toISOString() : String(value);
                propsPayload[key] = {
                    date: { start: dateStr }
                };
                break;
            case "checkbox":
                propsPayload[key] = {
                    checkbox: Boolean(value)
                };
                break;
            case "email":
                propsPayload[key] = {
                    email: String(value)
                };
                break;
            case "url":
                propsPayload[key] = {
                    url: String(value)
                };
                break;
            case "status":
                propsPayload[key] = {
                    status: { name: String(value) }
                };
                break;
            // Add more types as needed (people, files, relation...) - For MVP simpler ones suffice
            case "people":
                // value shoud be user id string
                propsPayload[key] = {
                    people: [{ id: value }]
                };
                break;
            default:
                console.warn(`Unsupported property type '${type}' for key '${key}'. Skipping auto-build.`);
        }
    }

    return propsPayload;
}
