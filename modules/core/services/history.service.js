import { HttpService } from './http.service.js';

export class HistoryService {
    static async getHistory(type, tag, days = 7) {
        const cleanTag = tag.replace(/^#/, '');
        const url = `https://the-eminence.pages.dev/getHistory?type=${type}&tag=${cleanTag}&days=${days}`;
        return await HttpService.get(url);
    }
}