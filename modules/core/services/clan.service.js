import { HttpService } from './http.service.js';
import { APP_CONFIG } from '../../../app/app.config.js';

export class ClanService {
    static async getClanData(tag = APP_CONFIG.DEFAULT_CLAN_TAG) {
        const cleanTag = tag.replace(/^#/, '');
        const url = `${APP_CONFIG.API_ENDPOINT}?tag=${cleanTag}`;
        return await HttpService.get(url);
    }
}
