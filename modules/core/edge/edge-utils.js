const ALLOWED_DAYS = new Set([7, 30, 9999]);
const ALLOWED_ORIGINS = [
    'https://the-eminence.pages.dev',
    /^https:\/\/[a-z0-9-]+\.the-eminence\.pages\.dev$/i,
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i
];

export function isOriginAllowed(origin) {
    if (!origin) return true;
    return ALLOWED_ORIGINS.some((rule) =>
        typeof rule === 'string' ? rule === origin : rule.test(origin)
    );
}

export function getCorsHeaders(request) {
    const origin = request?.headers?.get('Origin');
    const headers = {
        'Vary': 'Origin',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
    };

    if (origin && isOriginAllowed(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
    }

    return headers;
}

export function jsonResponse(data, { status = 200, request = null, cacheControl = 'no-store', extraHeaders = {} } = {}) {
    const cors = getCorsHeaders(request);
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': cacheControl,
            ...cors,
            ...extraHeaders
        }
    });
}

export function optionsResponse(request) {
    const origin = request?.headers?.get('Origin');
    if (origin && !isOriginAllowed(origin)) {
        return new Response(null, { status: 403, headers: { 'Vary': 'Origin' } });
    }
    return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request)
    });
}

export function rejectDisallowedOrigin(request) {
    const origin = request?.headers?.get('Origin');
    if (origin && !isOriginAllowed(origin)) {
        return jsonResponse({ error: 'Origen no autorizado' }, { status: 403, request });
    }
    return null;
}

export async function parseJsonSafely(response) {
    const rawText = await response.text();
    if (!rawText) {
        return { ok: false, data: null, rawText: '' };
    }
    try {
        return { ok: true, data: JSON.parse(rawText), rawText };
    } catch {
        return { ok: false, data: null, rawText };
    }
}

export function validateDays(rawDays, defaultValue = 7) {
    if (rawDays === null || rawDays === undefined || rawDays === '') {
        return { valid: true, value: defaultValue };
    }
    if (!/^\d+$/.test(String(rawDays).trim())) {
        return { valid: false, error: 'Parámetro days inválido. Valores permitidos: 7, 30, 9999.' };
    }
    const parsed = Number.parseInt(String(rawDays).trim(), 10);
    if (!ALLOWED_DAYS.has(parsed)) {
        return { valid: false, error: 'Parámetro days inválido. Valores permitidos: 7, 30, 9999.' };
    }
    return { valid: true, value: parsed };
}

export function normalizeTag(rawTag, { withHash = true } = {}) {
    if (typeof rawTag !== 'string') return '';
    const cleaned = rawTag.trim().replace(/^%23/i, '').replace(/^#/, '').toUpperCase();
    if (!cleaned || !/^[A-Z0-9]+$/.test(cleaned)) return '';
    return withHash ? `#${cleaned}` : cleaned;
}

export function chunkArray(items, chunkSize = 80) {
    const chunks = [];
    for (let i = 0; i < items.length; i += chunkSize) {
        chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
}
