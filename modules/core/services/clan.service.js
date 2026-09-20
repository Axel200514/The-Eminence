import { HttpService } from './http.service.js?v=2.1.0';
import { APP_CONFIG, buildApiUrl } from '../../../app/app.config.js?v=2.1.0';

export class ClanService {
    static async getClanData(tag = APP_CONFIG.DEFAULT_CLAN_TAG, options = {}) {
        const cleanTag = String(tag).trim().replace(/^#/, '');
        const url = buildApiUrl(`${APP_CONFIG.API_ENDPOINTS.CLAN}?tag=${encodeURIComponent(cleanTag)}`);
        return await HttpService.get(url, options);
    }
}
