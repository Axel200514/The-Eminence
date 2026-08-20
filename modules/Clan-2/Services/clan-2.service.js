import { HttpService } from '../../core/services/http.service.js';
import { APP_CONFIG } from '../../../app/app.config.js';

export class Clan2Service {
    static async getClanData() {
        const clanTag = '2CGG8Y229';
        const url = `${APP_CONFIG.API_ENDPOINT}?tag=${clanTag}`;
        return await HttpService.get(url);
    }
}