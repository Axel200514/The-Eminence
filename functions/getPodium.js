export async function onRequest(context) {
    if (context.request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        });
    }

    const url = new URL(context.request.url);
    const tagsParam = url.searchParams.get('tags');
    const days = parseInt(url.searchParams.get('days')) || 7;
    const tzOffsetParam = url.searchParams.get('tzOffset');
    const tzOffset = tzOffsetParam !== null ? parseInt(tzOffsetParam) : 360;
    const period = url.searchParams.get('period') || 'current';

    if (!context.env.DB) {
        return new Response(JSON.stringify({ error: 'Database not bound' }), { status: 500, headers: {'Access-Control-Allow-Origin': '*'} });
    }
    if (!tagsParam) {
        return new Response(JSON.stringify({ error: 'Missing tags' }), { status: 400, headers: {'Access-Control-Allow-Origin': '*'} });
    }

    let tags = tagsParam.split(',').map(t => t.trim());
    tags = tags.map(t => t.startsWith('#') ? t : '#' + t.replace('%23', ''));

    const now = new Date();
    const clientTime = new Date(now.getTime() - (tzOffset * 60 * 1000));
    const clientDay = clientTime.getUTCDay();
    const daysSinceWed = (clientDay - 3 + 7) % 7;

    const placeholders = tags.map(() => '?').join(',');

    try {
        let results = [];
        if (period === 'previous') {
            const daysToClosedWed = daysSinceWed === 0 ? 7 : daysSinceWed;
            const daysToPrevWed = daysToClosedWed + 7;

            const startCutoff = new Date(clientTime.getTime() - (daysToPrevWed * 24 * 60 * 60 * 1000));
            const endCutoff = new Date(clientTime.getTime() - (daysToClosedWed * 24 * 60 * 60 * 1000));

            const startStr = `${startCutoff.getUTCFullYear()}-${String(startCutoff.getUTCMonth() + 1).padStart(2, '0')}-${String(startCutoff.getUTCDate()).padStart(2, '0')}`;
            const endStr = `${endCutoff.getUTCFullYear()}-${String(endCutoff.getUTCMonth() + 1).padStart(2, '0')}-${String(endCutoff.getUTCDate()).padStart(2, '0')} 23:59:59`;

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

            const { results: rows } = await context.env.DB.prepare(query).bind(...tags, startStr, endStr).all();
            results = rows;
        } else {
            let dateCondition = '';
            if (days === 7) {
                const daysToSubtract = daysSinceWed === 0 ? 7 : daysSinceWed;
                const cutoffDate = new Date(clientTime.getTime() - (daysToSubtract * 24 * 60 * 60 * 1000));
                const year = cutoffDate.getUTCFullYear();
                const month = String(cutoffDate.getUTCMonth() + 1).padStart(2, '0');
                const day = String(cutoffDate.getUTCDate()).padStart(2, '0');
                dateCondition = `recorded_at >= '${year}-${month}-${day}'`;
            } else {
                const dateModifier = days === 9999 ? `'-100 years'` : `'-${days} days'`;
                dateCondition = `recorded_at >= datetime('now', ${dateModifier})`;
            }

            const query = `
                SELECT player_tag, MIN(recorded_at) as oldest_record, trophies as old_trophies
                FROM player_history
                WHERE player_tag IN (${placeholders}) AND ${dateCondition}
                GROUP BY player_tag
            `;

            const { results: rows } = await context.env.DB.prepare(query).bind(...tags).all();
            results = rows;
        }

        return new Response(JSON.stringify(results), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=300'
            }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: {'Access-Control-Allow-Origin': '*'} });
    }
}
