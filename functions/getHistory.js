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
    const type = url.searchParams.get('type');
    let tag = url.searchParams.get('tag');
    const days = parseInt(url.searchParams.get('days')) || 7;

    if (!context.env.DB) {
        return new Response(JSON.stringify({ error: 'Database not bound' }), { status: 500, headers: {'Access-Control-Allow-Origin': '*'} });
    }
    if (!type || !tag) {
        return new Response(JSON.stringify({ error: 'Missing type or tag' }), { status: 400, headers: {'Access-Control-Allow-Origin': '*'} });
    }

    if (!tag.startsWith('#')) tag = '#' + tag.replace('%23', '');

    const dateModifier = days === 9999 ? `'-100 years'` : `'-${days} days'`;

    let results = [];
    try {
        if (type === 'clan') {
            const query = `
                SELECT total_trophies, member_count, recorded_at 
                FROM clan_history 
                WHERE clan_tag = ? AND recorded_at >= datetime('now', ${dateModifier})
                ORDER BY recorded_at ASC
            `;
            const { results: rows } = await context.env.DB.prepare(query).bind(tag).all();
            results = rows;
        } else if (type === 'player') {
            const query = `
                SELECT trophies, highest_trophies, victories_3v3, victories_solo, victories_duo, recorded_at 
                FROM player_history 
                WHERE player_tag = ? AND recorded_at >= datetime('now', ${dateModifier})
                ORDER BY recorded_at ASC
            `;
            const { results: rows } = await context.env.DB.prepare(query).bind(tag).all();
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