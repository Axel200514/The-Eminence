import { HttpService } from './http.service.js?v=2.1.0';
import { APP_CONFIG, buildApiUrl } from '../../../app/app.config.js?v=2.1.0';

const cachedDatesByKey = new Map();
const pendingDatesByKey = new Map();

export class HistoryService {
    static async getAvailableDates(clanTag = null) {
        const cleanTag = clanTag ? String(clanTag).trim().replace(/^#/, '').toUpperCase() : '';
        const cacheKey = cleanTag || '__all__';

        const cached = cachedDatesByKey.get(cacheKey);
        if (cached && cached.length > 0) return cached;

        if (pendingDatesByKey.has(cacheKey)) {
            return await pendingDatesByKey.get(cacheKey);
        }

        const promise = (async () => {
            try {
                const query = cleanTag ? `?tag=${encodeURIComponent(cleanTag)}` : '';
                const data = await HttpService.get(buildApiUrl(`${APP_CONFIG.API_ENDPOINTS.REPORT_DATES}${query}`));
                const dates = (data || []).map((d) => d.record_date).filter(Boolean).sort();
                cachedDatesByKey.set(cacheKey, dates);
                return dates;
            } catch (e) {
                console.warn('No se pudieron cargar fechas para el reporte:', e);
                return [];
            } finally {
                pendingDatesByKey.delete(cacheKey);
            }
        })();

        pendingDatesByKey.set(cacheKey, promise);
        return await promise;
    }

    static clearDatesCache() {
        cachedDatesByKey.clear();
    }

    static async getHistory(type, tag, days = 7, options = {}) {
        const cleanTag = String(tag).trim().replace(/^#/, '');
        const url = buildApiUrl(`${APP_CONFIG.API_ENDPOINTS.HISTORY}?type=${encodeURIComponent(type)}&tag=${encodeURIComponent(cleanTag)}&days=${encodeURIComponent(days)}`);
        return await HttpService.get(url, options);
    }

    static async getReport(start, end, tags = []) {
        const cleanTags = [...new Set(tags.map((t) => String(t).trim().replace(/^#/, '')).filter(Boolean))];
        if (cleanTags.length === 0) return [];

        const chunks = [];
        for (let i = 0; i < cleanTags.length; i += 40) {
            chunks.push(cleanTags.slice(i, i + 40));
        }

        const promises = chunks.map((chunk) => {
            const url = buildApiUrl(`${APP_CONFIG.API_ENDPOINTS.REPORT}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&tags=${encodeURIComponent(chunk.join(','))}`);
            return HttpService.get(url);
        });

        return (await Promise.all(promises)).flat();
    }

    static async getPodium(tags, days = 7, period = 'current', clanTag = null) {
        const cleanTags = [...new Set(tags.map((t) => String(t).trim().replace(/^#/, '')).filter(Boolean))];
        if (cleanTags.length === 0) return [];

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
            const availableDates = await this.getAvailableDates(clanTag);
            let actualStartStr = targetStartStr;
            let actualEndStr = targetEndStr;

            if (availableDates && availableDates.length > 0) {
                const datesBeforeStart = availableDates.filter((d) => d <= targetStartStr);
                if (datesBeforeStart.length > 0) {
                    actualStartStr = datesBeforeStart[datesBeforeStart.length - 1];
                }
                const datesBeforeEnd = availableDates.filter((d) => d <= targetEndStr);
                if (datesBeforeEnd.length > 0) {
                    actualEndStr = datesBeforeEnd[datesBeforeEnd.length - 1];
                }
            }

            const reportResults = await this.getReport(actualStartStr, actualEndStr, cleanTags);

            if (reportResults && reportResults.length > 0) {
                return reportResults.map((r) => {
                    const pTag = (r.player_tag || '').startsWith('#') ? r.player_tag : `#${r.player_tag || ''}`;
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

        try {
            const url = buildApiUrl(`${APP_CONFIG.API_ENDPOINTS.PODIUM}?tags=${encodeURIComponent(cleanTags.join(','))}&days=${encodeURIComponent(days)}&period=${encodeURIComponent(period)}&tzOffset=${encodeURIComponent(tzOffset)}`);
            return await HttpService.get(url);
        } catch (err) {
            console.error(`Error en fallback getPodium (${period}):`, err);
            return [];
        }
    }
}
