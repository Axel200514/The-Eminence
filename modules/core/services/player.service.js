import { HttpService } from './http.service.js?v=2.1.0';
import { APP_CONFIG, buildApiUrl } from '../../../app/app.config.js?v=2.1.0';

export class PlayerService {
    static async getPlayerData(tag, options = {}) {
        const cleanTag = String(tag).trim().replace(/^#/, '');
        const url = buildApiUrl(`${APP_CONFIG.API_ENDPOINTS.PLAYER}?tag=${encodeURIComponent(cleanTag)}`);
        return await HttpService.get(url, options);
    }
}
