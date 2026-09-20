export class HttpService {
    static async get(url, { signal } = {}) {
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json'
            },
            signal
        });

        const text = await response.text();
        let payload = null;
        if (text) {
            try {
                payload = JSON.parse(text);
            } catch {
                payload = null;
            }
        }

        if (!response.ok) {
            const msg = payload?.error || `HTTP Error: ${response.status}`;
            throw new Error(msg);
        }

        if (payload === null) {
            throw new Error('Respuesta JSON inválida del servidor');
        }

        return payload;
    }
}
