function collectErrorValues(error) {
    return [
        error?.status,
        error?.statusCode,
        error?.code,
        error?.response?.status,
        error?.response?.statusCode,
        error?.response?.data?.error?.code,
        error?.error?.code,
        error?.cause?.status,
        error?.cause?.statusCode,
        error?.cause?.code
    ];
}

function collectErrorText(error) {
    return [
        error?.message,
        error?.response?.data?.error?.message,
        error?.error?.message,
        error?.cause?.message,
        error ? String(error) : ''
    ].filter(Boolean).join(' ');
}

export function isRateLimitError(error) {
    const values = collectErrorValues(error);
    if (values.some(value => Number(value) === 429 || String(value).toUpperCase() === 'RESOURCE_EXHAUSTED')) {
        return true;
    }

    return /\b429\b|RESOURCE_EXHAUSTED|rate[-\s]?limit|quota/i.test(collectErrorText(error));
}
