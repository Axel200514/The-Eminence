import {
    jsonResponse,
    normalizeTag,
    optionsResponse,
    rejectDisallowedOrigin
} from '../modules/core/edge/edge-utils.js';

export async function onRequest(context) {
    if (context.request.method === 'OPTIONS') {
        return optionsResponse(context.request);
    }

    const originError = rejectDisallowedOrigin(context.request);
    if (originError) return originError;

    if (!context.env.DB) {
        return jsonResponse({ error: 'Database not bound' }, { status: 500, request: context.request });
    }

    const url = new URL(context.request.url);
    const rawTag = url.searchParams.get('tag');

    try {
        let rows;
        if (rawTag) {
            const clanTag = normalizeTag(rawTag, { withHash: true });
            if (!clanTag) {
                return jsonResponse({ error: 'Tag de clan inválido' }, { status: 400, request: context.request });
            }
            const query = `
                SELECT DISTINCT substr(recorded_at, 1, 10) as record_date
                FROM clan_history
                WHERE clan_tag = ?
                ORDER BY record_date DESC
            `;
            const { results } = await context.env.DB.prepare(query).bind(clanTag).all();
            rows = results;
        } else {
            const query = `
                SELECT DISTINCT substr(recorded_at, 1, 10) as record_date
                FROM clan_history
                ORDER BY record_date DESC
            `;
            const { results } = await context.env.DB.prepare(query).all();
            rows = results;
        }

        return jsonResponse(rows || [], {
            status: 200,
            request: context.request,
            cacheControl: 'public, max-age=300'
        });
    } catch (e) {
        return jsonResponse({ error: e.message }, { status: 500, request: context.request });
    }
}
