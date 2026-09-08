export async function onRequest(context) {
    if (context.request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '86400'
            }
        });
    }

    const jsonHeaders = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    };

    const url = new URL(context.request.url);
    const startDate = url.searchParams.get('start');
    const endDate = url.searchParams.get('end');
    const tagsParam = url.searchParams.get('tags');

    if (!context.env.DB) {
        return new Response(JSON.stringify({ error: 'Database not bound' }), { status: 500, headers: jsonHeaders });
    }
    if (!startDate || !endDate) {
        return new Response(JSON.stringify({ error: 'Missing start or end' }), { status: 400, headers: jsonHeaders });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        return new Response(JSON.stringify({ error: 'Invalid date format' }), { status: 400, headers: jsonHeaders });
    }

    if (!tagsParam) {
        return new Response(JSON.stringify({ error: 'Missing tags parameter' }), { status: 400, headers: jsonHeaders });
    }

    let tags = tagsParam.split(',').map(t => t.trim()).filter(Boolean);
    tags = tags.map(t => t.startsWith('#') ? t : '#' + t.replace('%23', ''));
    if (tags.length === 0) {
        return new Response(JSON.stringify([]), { headers: jsonHeaders });
    }

    tags = tags.slice(0, 50);

    const placeholders = tags.map(() => '?').join(',');
    const tagsCondition = `AND player_tag IN (${placeholders})`;
    const params = [startDate, endDate, ...tags];

    try {
        const query = `
            SELECT player_tag, player_name, 
                   start_trophies, end_trophies
            FROM (
                SELECT player_tag, player_name,
                       FIRST_VALUE(trophies) OVER (PARTITION BY player_tag ORDER BY recorded_at ASC) as start_trophies,
                       FIRST_VALUE(trophies) OVER (PARTITION BY player_tag ORDER BY recorded_at DESC) as end_trophies,
                       ROW_NUMBER() OVER (PARTITION BY player_tag ORDER BY recorded_at DESC) as rn
                FROM player_history
                WHERE date(recorded_at) >= ? AND date(recorded_at) <= ?
                  ${tagsCondition}
            ) WHERE rn = 1;
        `;
        
        const { results } = await context.env.DB.prepare(query).bind(...params).all();

        return new Response(JSON.stringify(results || []), {
            headers: {
                ...jsonHeaders,
                'Cache-Control': 'public, max-age=300'
            }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: jsonHeaders });
    }
}
