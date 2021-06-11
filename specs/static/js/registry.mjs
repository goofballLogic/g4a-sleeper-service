export const entries = [];

export function Given(text, strategy) {
    entries.push({ keyword: "Given", text, strategy });
}

export function When(text, strategy) {
    entries.push({ keyword: "When", text, strategy });
}

export function Then(text, strategy) {
    entries.push({ keyword: "Then", text, strategy });
}

