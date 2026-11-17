import {
    chunkArray,
    jsonResponse,
    normalizeTag,
    optionsResponse,
    rejectDisallowedOrigin,
    validateDays
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
    const tagsParam = url.searchParams.get('tags');
    const daysCheck = validateDays(url.searchParams.get('days'), 7);
    const tzOffsetParam = url.searchParams.get('tzOffset');
    const period = url.searchParams.get('period') || 'current';

    if (!context.env.DB) {
        return jsonResponse({ error: 'Database not bound' }, { status: 500, request: context.request });
    }
    if (!tagsParam) {
        return jsonResponse({ error: 'Missing tags' }, { status: 400, request: context.request });
    }
    if (!daysCheck.valid) {
        return jsonResponse({ error: daysCheck.error }, { status: 400, request: context.request });
    }
    if (period !== 'current' && period !== 'previous') {
        return jsonResponse({ error: 'Invalid period parameter' }, { status: 400, request: context.request });
    }

    let tzOffset = 360;
    if (tzOffsetParam !== null && tzOffsetParam !== '') {
        if (!/^-?\d+$/.test(tzOffsetParam.trim())) {
            return jsonResponse({ error: 'Invalid tzOffset parameter' }, { status: 400, request: context.request });
        }
        tzOffset = Number.parseInt(tzOffsetParam.trim(), 10);
        if (tzOffset < -840 || tzOffset > 840) {
            return jsonResponse({ error: 'tzOffset out of range' }, { status: 400, request: context.request });
        }
    }

    const tags = [...new Set(
        tagsParam.split(',').map((t) => normalizeTag(t, { withHash: true })).filter(Boolean)
    )];
    if (tags.length === 0) {
        return jsonResponse([], { status: 200, request: context.request, cacheControl: 'public, max-age=300' });
    }
    if (tags.length > MAX_TAGS) {
        return jsonResponse(
            { error: `Se excedió el límite máximo de ${MAX_TAGS} tags por consulta` },
            { status: 400, request: context.request }
        );
    }

    const now = new Date();
    const clientTime = new Date(now.getTime() - (tzOffset * 60 * 1000));
    const clientDay = clientTime.getUTCDay();
    const daysSinceWed = (clientDay - 3 + 7) % 7;
    const tagChunks = chunkArray(tags, CHUNK_SIZE);

    try {
        const results = [];

        if (period === 'previous') {
            const daysToClosedWed = daysSinceWed === 0 ? 7 : daysSinceWed;
            const daysToPrevWed = daysToClosedWed + 7;

            const startCutoff = new Date(clientTime.getTime() - (daysToPrevWed * 24 * 60 * 60 * 1000));
            const endCutoff = new Date(clientTime.getTime() - (daysToClosedWed * 24 * 60 * 60 * 1000));

            const startStr = `${startCutoff.getUTCFullYear()}-${String(startCutoff.getUTCMonth() + 1).padStart(2, '0')}-${String(startCutoff.getUTCDate()).padStart(2, '0')}`;
            const endStr = `${endCutoff.getUTCFullYear()}-${String(endCutoff.getUTCMonth() + 1).padStart(2, '0')}-${String(endCutoff.getUTCDate()).padStart(2, '0')} 23:59:59`;

            for (const chunk of tagChunks) {
                const placeholders = chunk.map(() => '?').join(',');
                const query = `
                    SELECT player_tag,
                           start_trophies as old_trophies,
                           end_trophies,
                           (end_trophies - start_trophies) as gain,
                           start_time as oldest_record
                    FROM (
                        SELECT player_tag,
                               FIRST_VALUE(trophies) OVER (PARTITION BY player_tag ORDER BY recorded_at ASC) as start_trophies,
                               FIRST_VALUE(trophies) OVER (PARTITION BY player_tag ORDER BY recorded_at DESC) as end_trophies,
                               FIRST_VALUE(recorded_at) OVER (PARTITION BY player_tag ORDER BY recorded_at ASC) as start_time,
                               ROW_NUMBER() OVER (PARTITION BY player_tag ORDER BY recorded_at DESC) as rn
                        FROM player_history
                        WHERE player_tag IN (${placeholders}) AND recorded_at >= ? AND recorded_at <= ?
                    )
                    WHERE rn = 1
                `;

                const { results: rows } = await context.env.DB.prepare(query).bind(...chunk, startStr, endStr).all();
                if (Array.isArray(rows)) results.push(...rows);
            }
        } else if (daysCheck.value === 7) {
            const daysToSubtract = daysSinceWed === 0 ? 7 : daysSinceWed;
            const cutoffDate = new Date(clientTime.getTime() - (daysToSubtract * 24 * 60 * 60 * 1000));
            const year = cutoffDate.getUTCFullYear();
            const month = String(cutoffDate.getUTCMonth() + 1).padStart(2, '0');
            const day = String(cutoffDate.getUTCDate()).padStart(2, '0');
            const cutoffStr = `${year}-${month}-${day} 23:59:59`;

            for (const chunk of tagChunks) {
                const placeholders = chunk.map(() => '?').join(',');
                const query = `
                    SELECT player_tag,
                           COALESCE(
                               (SELECT trophies FROM player_history h WHERE h.player_tag = p.player_tag AND h.recorded_at <= ? ORDER BY h.recorded_at DESC LIMIT 1),
                               (SELECT trophies FROM player_history h WHERE h.player_tag = p.player_tag AND h.recorded_at > ? ORDER BY h.recorded_at ASC LIMIT 1)
                           ) as old_trophies,
                           COALESCE(
                               (SELECT recorded_at FROM player_history h WHERE h.player_tag = p.player_tag AND h.recorded_at <= ? ORDER BY h.recorded_at DESC LIMIT 1),
                               (SELECT recorded_at FROM player_history h WHERE h.player_tag = p.player_tag AND h.recorded_at > ? ORDER BY h.recorded_at ASC LIMIT 1)
                           ) as oldest_record
                    FROM (
                        SELECT DISTINCT player_tag FROM player_history WHERE player_tag IN (${placeholders})
                    ) p
                `;

                const { results: rows } = await context.env.DB.prepare(query).bind(
                    cutoffStr,
                    cutoffStr,
                    cutoffStr,
                    cutoffStr,
                    ...chunk
                ).all();
                if (Array.isArray(rows)) results.push(...rows);
            }
        } else {
            const dateModifier = daysCheck.value === 9999 ? '-100 years' : `-${daysCheck.value} days`;

            for (const chunk of tagChunks) {
                const placeholders = chunk.map(() => '?').join(',');
                const query = `
                    SELECT player_tag,
                           oldest_record,
                           old_trophies
                    FROM (
                        SELECT player_tag,
                               FIRST_VALUE(recorded_at) OVER (PARTITION BY player_tag ORDER BY recorded_at ASC) as oldest_record,
                               FIRST_VALUE(trophies) OVER (PARTITION BY player_tag ORDER BY recorded_at ASC) as old_trophies,
                               ROW_NUMBER() OVER (PARTITION BY player_tag ORDER BY recorded_at ASC) as rn
                        FROM player_history
                        WHERE player_tag IN (${placeholders}) AND recorded_at >= datetime('now', ?)
                    )
                    WHERE rn = 1
                `;

                const { results: rows } = await context.env.DB.prepare(query).bind(...chunk, dateModifier).all();
                if (Array.isArray(rows)) results.push(...rows);
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
