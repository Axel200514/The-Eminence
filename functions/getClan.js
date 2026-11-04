import {
    jsonResponse,
    normalizeTag,
    optionsResponse,
    parseJsonSafely,
    rejectDisallowedOrigin
} from '../modules/core/edge/edge-utils.js';

const SNAPSHOT_DEDUP_MODIFIER = '-2 hours';

export async function onRequest(context) {
    if (context.request.method === 'OPTIONS') {
        return optionsResponse(context.request);
    }

    const originError = rejectDisallowedOrigin(context.request);
    if (originError) return originError;

    const url = new URL(context.request.url);
    const rawTag = url.searchParams.get('tag') || '80L9UYGQG';
    const cleanTag = normalizeTag(rawTag, { withHash: false });
    if (!cleanTag) {
        return jsonResponse({ error: 'Tag de clan inválido' }, { status: 400, request: context.request });
    }

    const formattedTag = `%23${cleanTag}`;
    const apiKey = context.env.BRAWL_API_KEY;

    if (!apiKey) {
        return jsonResponse({ error: 'BRAWL_API_KEY no configurada' }, { status: 500, request: context.request });
    }

    try {
        const response = await fetch(`https://bsproxy.royaleapi.dev/v1/clubs/${formattedTag}`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json'
            },
            cf: {
                cacheTtlByStatus: {
                    '200-299': 7200,
                    '404': 60,
                    '500-599': 0
                }
            }
        });

        const parsed = await parseJsonSafely(response);
        if (!parsed.ok) {
            const errorStatus = response.status >= 400 ? response.status : 502;
            return jsonResponse(
                { error: 'La API externa devolvió una respuesta no válida', status: response.status },
                { status: errorStatus, request: context.request, cacheControl: 'no-store' }
            );
        }

        const data = parsed.data;

        if (!response.ok) {
            return jsonResponse(data, {
                status: response.status,
                request: context.request,
                cacheControl: 'no-store'
            });
        }

        if (context.env.DB && data && data.tag) {
            context.waitUntil((async () => {
                try {
                    const recent = await context.env.DB.prepare(
                        `SELECT 1 FROM clan_history WHERE clan_tag = ? AND recorded_at >= datetime('now', ?) LIMIT 1`
                    ).bind(data.tag, SNAPSHOT_DEDUP_MODIFIER).first();

                    if (recent) {
                        return;
                    }

                    await context.env.DB.prepare(
                        `INSERT INTO clan_history (clan_tag, clan_name, total_trophies, member_count, required_trophies) VALUES (?, ?, ?, ?, ?)`
                    ).bind(
                        data.tag,
                        data.name,
                        data.trophies,
                        Array.isArray(data.members) ? data.members.length : 0,
                        data.requiredTrophies || 0
                    ).run();

                    if (Array.isArray(data.members) && data.members.length > 0) {
                        const stmts = data.members.map((m) =>
                            context.env.DB.prepare(
                                `INSERT INTO player_history (player_tag, player_name, trophies) VALUES (?, ?, ?)`
                            ).bind(m.tag, m.name, m.trophies)
                        );
                        await context.env.DB.batch(stmts);
                    }
                } catch (e) {
                    console.error('D1 Error:', e);
                }
            })());
        }

        return jsonResponse(data, {
            status: response.status,
            request: context.request,
            cacheControl: 'public, max-age=7200, s-maxage=7200, stale-while-revalidate=3600'
        });
    } catch (error) {
        return jsonResponse(
            { error: error.message || 'Error interno al consultar clan' },
            { status: 500, request: context.request, cacheControl: 'no-store' }
        );
    }
}
