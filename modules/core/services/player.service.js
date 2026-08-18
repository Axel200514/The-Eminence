import { HttpService } from './http.service.js';
import { APP_CONFIG } from '../../../app/app.config.js';

export class PlayerService {
    static async getPlayerData(tag) {
        const cleanTag = tag.replace(/^#/, '');
        const url = `${APP_CONFIG.PLAYER_ENDPOINT}?tag=${cleanTag}`;
        return await HttpService.get(url);
    }
}
