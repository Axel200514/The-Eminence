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
    const startDate = url.searchParams.get('start');
    const endDate = url.searchParams.get('end');
    const tagsParam = url.searchParams.get('tags');

    if (!context.env.DB) {
        return new Response(JSON.stringify({ error: 'Database not bound' }), { status: 500, headers: {'Access-Control-Allow-Origin': '*'} });
    }
    if (!startDate || !endDate) {
        return new Response(JSON.stringify({ error: 'Missing start or end' }), { status: 400, headers: {'Access-Control-Allow-Origin': '*'} });
    }

    let tagsCondition = '';
    let params = [startDate, endDate];

    if (tagsParam) {
        let tags = tagsParam.split(',').map(t => t.trim());
        tags = tags.map(t => t.startsWith('#') ? t : '#' + t.replace('%23', ''));
        const placeholders = tags.map(() => '?').join(',');
        tagsCondition = `AND player_tag IN (${placeholders})`;
        params.push(...tags);
    }

    try {
        const query = `
            SELECT player_tag, player_name, 
                   start_trophies, end_trophies
            FROM (
                SELECT player_tag, player_name,
                       FIRST_VALUE(trophies) OVER (PARTITION BY player_tag ORDER BY recorded_at ASC) as start_trophies,
                       LAST_VALUE(trophies) OVER (PARTITION BY player_tag ORDER BY recorded_at ASC) as end_trophies,
                       ROW_NUMBER() OVER (PARTITION BY player_tag ORDER BY recorded_at DESC) as rn
                FROM player_history
                WHERE date(recorded_at) >= ? AND date(recorded_at) <= ?
                  ${tagsCondition}
            ) WHERE rn = 1;
        `;
        
        const { results } = await context.env.DB.prepare(query).bind(...params).all();

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
