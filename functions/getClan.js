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

    const url = new URL(context.request.url);
    const clanTag = url.searchParams.get('tag') || '80L9UYGQG';
    const cleanTag = clanTag.trim().replace(/^#/, '');
    const formattedTag = `%23${cleanTag}`;
    const apiKey = context.env.BRAWL_API_KEY;

    if (!apiKey) {
        return new Response(JSON.stringify({ error: 'BRAWL_API_KEY no configurada' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }

    try {
        const response = await fetch(`https://bsproxy.royaleapi.dev/v1/clubs/${formattedTag}`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json'
            },
            cf: {
                cacheTtl: 7200,
                cacheEverything: true
            }
        });

        const data = await response.json();

        if (context.env.DB && data && data.tag) {
            context.waitUntil((async () => {
                try {
                    await context.env.DB.prepare(
                        `INSERT INTO clan_history (clan_tag, clan_name, total_trophies, member_count, required_trophies) VALUES (?, ?, ?, ?, ?)`
                    ).bind(data.tag, data.name, data.trophies, data.members ? data.members.length : 0, data.requiredTrophies || 0).run();
                    
                    if (Array.isArray(data.members)) {
                        const stmts = data.members.map(m => 
                            context.env.DB.prepare(
                                `INSERT INTO player_history (player_tag, player_name, trophies) VALUES (?, ?, ?)`
                            ).bind(m.tag, m.name, m.trophies)
                        );
                        await context.env.DB.batch(stmts);
                    }
                } catch (e) {
                    console.error("D1 Error:", e);
                }
            })());
        }

        return new Response(JSON.stringify(data), {
            status: response.status,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Cache-Control': 'public, max-age=7200, s-maxage=7200, stale-while-revalidate=3600'
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }
}
