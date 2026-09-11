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

    if (!context.env.DB) {
        return new Response(JSON.stringify({ error: 'Database not bound' }), { status: 500, headers: {'Access-Control-Allow-Origin': '*'} });
    }
    if (!tagsParam) {
        return new Response(JSON.stringify({ error: 'Missing tags' }), { status: 400, headers: {'Access-Control-Allow-Origin': '*'} });
    }

    let tags = tagsParam.split(',').map(t => t.trim());
    tags = tags.map(t => t.startsWith('#') ? t : '#' + t.replace('%23', ''));

    let dateCondition = '';
    if (days === 7) {
        const now = new Date();
        const clientTime = new Date(now.getTime() - (tzOffset * 60 * 1000));
        const clientDay = clientTime.getUTCDay();
        const daysSinceWed = (clientDay - 3 + 7) % 7;
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

    const placeholders = tags.map(() => '?').join(',');

    try {
        const query = `
            SELECT player_tag, MIN(recorded_at) as oldest_record, trophies as old_trophies
            FROM player_history
            WHERE player_tag IN (${placeholders}) AND ${dateCondition}
            GROUP BY player_tag
        `;
        
        const { results } = await context.env.DB.prepare(query).bind(...tags).all();

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
