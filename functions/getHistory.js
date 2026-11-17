import {
    jsonResponse,
    normalizeTag,
    optionsResponse,
    rejectDisallowedOrigin,
    validateDays
} from '../modules/core/edge/edge-utils.js';

export async function onRequest(context) {
    if (context.request.method === 'OPTIONS') {
        return optionsResponse(context.request);
    }

    const originError = rejectDisallowedOrigin(context.request);
    if (originError) return originError;

    const url = new URL(context.request.url);
    const type = url.searchParams.get('type');
    const rawTag = url.searchParams.get('tag');
    const daysCheck = validateDays(url.searchParams.get('days'), 7);

    if (!context.env.DB) {
        return jsonResponse({ error: 'Database not bound' }, { status: 500, request: context.request });
    }
    if (!type || !rawTag) {
        return jsonResponse({ error: 'Missing type or tag' }, { status: 400, request: context.request });
    }
    if (type !== 'clan' && type !== 'player') {
        return jsonResponse({ error: 'Invalid type parameter' }, { status: 400, request: context.request });
    }
    if (!daysCheck.valid) {
        return jsonResponse({ error: daysCheck.error }, { status: 400, request: context.request });
    }

    const tag = normalizeTag(rawTag, { withHash: true });
    if (!tag) {
        return jsonResponse({ error: 'Invalid tag parameter' }, { status: 400, request: context.request });
    }

    const dateModifier = daysCheck.value === 9999 ? '-100 years' : `-${daysCheck.value} days`;

    try {
        let results = [];
        if (type === 'clan') {
            const query = `
                SELECT total_trophies, member_count, recorded_at
                FROM clan_history
                WHERE clan_tag = ? AND recorded_at >= datetime('now', ?)
                ORDER BY recorded_at ASC
            `;
            const { results: rows } = await context.env.DB.prepare(query).bind(tag, dateModifier).all();
            results = rows || [];
        } else {
            const query = `
                SELECT trophies, highest_trophies, victories_3v3, victories_solo, victories_duo, recorded_at
                FROM player_history
                WHERE player_tag = ? AND recorded_at >= datetime('now', ?)
                ORDER BY recorded_at ASC
            `;
            const { results: rows } = await context.env.DB.prepare(query).bind(tag, dateModifier).all();
            results = rows || [];
        }

        return jsonResponse(results, {
            status: 200,
            request: context.request,
            cacheControl: 'public, max-age=300'
        });
    } catch (e) {
        return jsonResponse({ error: e.message }, { status: 500, request: context.request });
    }
}
