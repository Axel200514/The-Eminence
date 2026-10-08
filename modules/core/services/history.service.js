import { HttpService } from './http.service.js';

export class HistoryService {
    static async getHistory(type, tag, days = 7) {
        const cleanTag = tag.replace(/^#/, '');
        const url = `https://the-eminence.pages.dev/getHistory?type=${type}&tag=${cleanTag}&days=${days}`;
        return await HttpService.get(url);
    }

    static async getPodium(tags, days = 7, period = 'current') {
        const cleanTags = [...new Set(tags.map(t => t.replace(/^#/, '')))];
        const tzOffset = new Date().getTimezoneOffset();

        if (period === 'previous') {
            const now = new Date();
            const clientTime = new Date(now.getTime() - (tzOffset * 60 * 1000));
            const clientDay = clientTime.getUTCDay();
            const daysSinceWed = (clientDay - 3 + 7) % 7;
            const daysToClosedWed = daysSinceWed === 0 ? 7 : daysSinceWed;
            const daysToPrevWed = daysToClosedWed + 7;

            const startCutoff = new Date(clientTime.getTime() - (daysToPrevWed * 24 * 60 * 60 * 1000));
            const endCutoff = new Date(clientTime.getTime() - (daysToClosedWed * 24 * 60 * 60 * 1000));

            const startStr = startCutoff.toISOString().split('T')[0];
            const endStr = endCutoff.toISOString().split('T')[0];

            const chunks = [];
            for (let i = 0; i < cleanTags.length; i += 40) {
                chunks.push(cleanTags.slice(i, i + 40));
            }

            try {
                const reportPromises = chunks.map(chunk => {
                    const chunkStr = chunk.join(',');
                    return HttpService.get(`https://the-eminence.pages.dev/getReport?start=${startStr}&end=${endStr}&tags=${chunkStr}`);
                });
                const reportResults = (await Promise.all(reportPromises)).flat();
                return reportResults.map(r => {
                    const pTag = (r.player_tag || '').startsWith('#') ? r.player_tag : '#' + (r.player_tag || '');
                    return {
                        player_tag: pTag,
                        old_trophies: r.start_trophies,
                        end_trophies: r.end_trophies,
                        gain: (r.end_trophies || 0) - (r.start_trophies || 0)
                    };
                });
            } catch (e) {
                console.error("Error cargando semana pasada vía getReport:", e);
            }
        }

        const tagsParam = cleanTags.join(',');
        const url = `https://the-eminence.pages.dev/getPodium?tags=${tagsParam}&days=${days}&period=${period}&tzOffset=${tzOffset}`;
        return await HttpService.get(url);
    }
}