import { HttpService } from './http.service.js';

export class HistoryService {
    static async getHistory(type, tag, days = 7) {
        const cleanTag = tag.replace(/^#/, '');
        const url = `https://the-eminence.pages.dev/getHistory?type=${type}&tag=${cleanTag}&days=${days}`;
        return await HttpService.get(url);
    }

    static async getPodium(tags, days = 7) {
        const cleanTags = tags.map(t => t.replace(/^#/, '')).join(',');
        const tzOffset = new Date().getTimezoneOffset();
        const url = `https://the-eminence.pages.dev/getPodium?tags=${cleanTags}&days=${days}&tzOffset=${tzOffset}`;
        return await HttpService.get(url);
    }
}