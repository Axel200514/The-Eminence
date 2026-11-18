import {
    chunkArray,
    jsonResponse,
    normalizeTag,
    optionsResponse,
    rejectDisallowedOrigin
} from '../modules/core/edge/edge-utils.js';

const MAX_TAGS = 200;
const CHUNK_SIZE = 80;

export async function onRequest(context) {
    if (context.request.method === 'OPTIONS') {
        return optionsResponse(context.request);
    }

    const originError = rejectDisallowedOrigin(context.request);
    if (originError) return originError;

    const url = new URL(context.request.url);
    const startDate = url.searchParams.get('start');
    const endDate = url.searchParams.get('end');
    const tagsParam = url.searchParams.get('tags');

    if (!context.env.DB) {
        return jsonResponse({ error: 'Database not bound' }, { status: 500, request: context.request });
    }
    if (!startDate || !endDate) {
        return jsonResponse({ error: 'Missing start or end' }, { status: 400, request: context.request });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate) || startDate > endDate) {
        return jsonResponse({ error: 'Invalid date format or range' }, { status: 400, request: context.request });
    }

    if (!tagsParam) {
        return jsonResponse({ error: 'Missing tags parameter' }, { status: 400, request: context.request });
    }

    const tags = [...new Set(
        tagsParam.split(',').map((t) => normalizeTag(t, { withHash: true })).filter(Boolean)
    )];

    if (tags.length === 0) {
        return jsonResponse([], { status: 200, request: context.request, cacheControl: 'public, max-age=300' });
    }

    if (tags.length > MAX_TAGS) {
        return jsonResponse(
            { error: `Se excedió el límite máximo de ${MAX_TAGS} tags por reporte` },
            { status: 400, request: context.request }
        );
    }

    const startBound = `${startDate} 00:00:00`;
    const endBound = `${endDate} 23:59:59`;
    const tagChunks = chunkArray(tags, CHUNK_SIZE);

    try {
        const results = [];

        for (const chunk of tagChunks) {
            const placeholders = chunk.map(() => '?').join(',');
            const query = `
                SELECT player_tag, player_name,
                       start_trophies, end_trophies
                FROM (
                    SELECT player_tag, player_name,
                           FIRST_VALUE(trophies) OVER (PARTITION BY player_tag ORDER BY recorded_at ASC) as start_trophies,
                           FIRST_VALUE(trophies) OVER (PARTITION BY player_tag ORDER BY recorded_at DESC) as end_trophies,
                           ROW_NUMBER() OVER (PARTITION BY player_tag ORDER BY recorded_at DESC) as rn
                    FROM player_history
                    WHERE player_tag IN (${placeholders})
                      AND recorded_at >= ? AND recorded_at <= ?
                ) WHERE rn = 1
            `;

            const { results: rows } = await context.env.DB.prepare(query).bind(...chunk, startBound, endBound).all();
            if (Array.isArray(rows)) {
                results.push(...rows);
            }
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
