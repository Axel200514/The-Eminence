export class HttpService {
    static async get(url) {
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || `HTTP Error: ${response.status}`);
        }

        return await response.json();
    }
}
