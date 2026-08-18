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
                cacheTtl: 18000,
                cacheEverything: true
            }
        });

        const data = await response.json();

        return new Response(JSON.stringify(data), {
            status: response.status,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Cache-Control': 'public, max-age=18000, s-maxage=18000, stale-while-revalidate=3600'
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }
}
