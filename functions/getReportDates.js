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

    if (!context.env.DB) {
        return new Response(JSON.stringify({ error: 'Database not bound' }), { status: 500, headers: {'Access-Control-Allow-Origin': '*'} });
    }

    try {
        const query = `
            SELECT DISTINCT date(recorded_at) as record_date 
            FROM clan_history 
            ORDER BY record_date DESC
        `;
        
        const { results } = await context.env.DB.prepare(query).all();

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
