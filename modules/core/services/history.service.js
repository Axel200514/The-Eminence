import { HttpService } from './http.service.js';

let cachedReportDates = null;
let reportDatesPromise = null;

async function getAvailableDates() {
    if (cachedReportDates && cachedReportDates.length > 0) return cachedReportDates;
    if (reportDatesPromise) return await reportDatesPromise;
    
    reportDatesPromise = (async () => {
        try {
            const data = await HttpService.get('https://the-eminence.pages.dev/getReportDates');
            const dates = (data || []).map(d => d.record_date).filter(Boolean).sort();
            cachedReportDates = dates;
            return dates;
        } catch (e) {
            console.warn("No se pudieron cargar fechas para el reporte:", e);
            return [];
        } finally {
            reportDatesPromise = null;
        }
    })();
    return await reportDatesPromise;
}

export class HistoryService {
    static async getHistory(type, tag, days = 7) {
        const cleanTag = tag.replace(/^#/, '');
        const url = `https://the-eminence.pages.dev/getHistory?type=${type}&tag=${cleanTag}&days=${days}`;
        return await HttpService.get(url);
    }

    static async getPodium(tags, days = 7, period = 'current') {
        const cleanTags = [...new Set(tags.map(t => t.replace(/^#/, '')))];
        const tzOffset = new Date().getTimezoneOffset();
        const now = new Date();
        const clientTime = new Date(now.getTime() - (tzOffset * 60 * 1000));
        const clientDay = clientTime.getUTCDay();
        const daysSinceWed = (clientDay - 3 + 7) % 7;
        const daysToClosedWed = daysSinceWed === 0 ? 7 : daysSinceWed;
        const daysToPrevWed = daysToClosedWed + 7;

        let targetStartStr;
        let targetEndStr;

        if (period === 'previous') {
            const startCutoff = new Date(clientTime.getTime() - (daysToPrevWed * 24 * 60 * 60 * 1000));
            const endCutoff = new Date(clientTime.getTime() - (daysToClosedWed * 24 * 60 * 60 * 1000));
            targetStartStr = startCutoff.toISOString().split('T')[0];
            targetEndStr = endCutoff.toISOString().split('T')[0];
        } else {
            const startCutoff = new Date(clientTime.getTime() - (daysToClosedWed * 24 * 60 * 60 * 1000));
            targetStartStr = startCutoff.toISOString().split('T')[0];
            targetEndStr = clientTime.toISOString().split('T')[0];
        }

        try {
            const availableDates = await getAvailableDates();
            let actualStartStr = targetStartStr;
            let actualEndStr = targetEndStr;

            if (availableDates && availableDates.length > 0) {
                // Encontrar la fecha de registro más cercana y anterior o igual al corte de inicio
                const datesBeforeStart = availableDates.filter(d => d <= targetStartStr);
                if (datesBeforeStart.length > 0) {
                    actualStartStr = datesBeforeStart[datesBeforeStart.length - 1];
                }
                // Encontrar la fecha de registro más cercana y anterior o igual a la fecha final
                const datesBeforeEnd = availableDates.filter(d => d <= targetEndStr);
                if (datesBeforeEnd.length > 0) {
                    actualEndStr = datesBeforeEnd[datesBeforeEnd.length - 1];
                }
            }

            const chunks = [];
            for (let i = 0; i < cleanTags.length; i += 40) {
                chunks.push(cleanTags.slice(i, i + 40));
            }

            const reportPromises = chunks.map(chunk => {
                const chunkStr = chunk.join(',');
                return HttpService.get(`https://the-eminence.pages.dev/getReport?start=${actualStartStr}&end=${actualEndStr}&tags=${chunkStr}`);
            });
            const reportResults = (await Promise.all(reportPromises)).flat();

            if (reportResults && reportResults.length > 0) {
                return reportResults.map(r => {
                    const pTag = (r.player_tag || '').startsWith('#') ? r.player_tag : '#' + (r.player_tag || '');
                    return {
                        player_tag: pTag,
                        old_trophies: r.start_trophies,
                        end_trophies: r.end_trophies,
                        gain: (r.end_trophies || 0) - (r.start_trophies || 0),
                        oldest_record: actualStartStr
                    };
                });
            }
        } catch (e) {
            console.error(`Error calculando podio (${period}) vía getReport:`, e);
        }

        // Fallback a getPodium
        try {
            const tagsParam = cleanTags.join(',');
            const url = `https://the-eminence.pages.dev/getPodium?tags=${tagsParam}&days=${days}&period=${period}&tzOffset=${tzOffset}`;
            return await HttpService.get(url);
        } catch (err) {
            console.error(`Error en fallback getPodium (${period}):`, err);
            return [];
        }
    }
}
