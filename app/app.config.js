export const APP_VERSION = '2.1.0';

export const APP_CONFIG = {
    APP_NAME: 'The Eminence',
    VERSION: APP_VERSION,
    DEFAULT_CLAN_KEY: 'clan1',
    DEFAULT_CLAN_TAG: '80L9UYGQG',
    CLANS: {
        clan1: {
            key: 'clan1',
            queryValue: '1',
            tag: '80L9UYGQG',
            name: 'The Eminence',
            shortLabel: 'Clan 1',
            description: 'Tracker y estadísticas en vivo del clan The Eminence en Brawl Stars. Revisa el progreso, copas, miembros y podio de nuestro clan.'
        },
        clan2: {
            key: 'clan2',
            queryValue: '2',
            tag: '2CGG8Y229',
            name: 'The Eminence 2',
            shortLabel: 'Clan 2',
            description: 'Tracker y estadísticas en vivo del clan The Eminence 2 en Brawl Stars. Revisa el progreso, copas, miembros y podio de nuestro clan.'
        }
    },
    ORBIT_FEATURED_PLAYER: {
        tag: '#YPLYVQVLL',
        name: '🪷アレックス🪷',
        iconId: 28000889
    },
    API_ENDPOINTS: {
        CLAN: '/getClan',
        PLAYER: '/getPlayer',
        HISTORY: '/getHistory',
        PODIUM: '/getPodium',
        REPORT: '/getReport',
        REPORT_DATES: '/getReportDates'
    },
    API_ENDPOINT: '/getClan',
    PLAYER_ENDPOINT: '/getPlayer',
    LIVE_SERVER_PORTS: ['5500', '5501', '5502'],
    PRODUCTION_ORIGIN: 'https://the-eminence.pages.dev',
    EXTERNAL_LIBS: {
        HTML2CANVAS: {
            src: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
            integrity: 'sha384-ZZ1pncU3bQe8y31yfZdMFdSpttDoPmOZg2wguVK9almUodir1PghgT0eY7Mrty8H'
        },
        JSPDF: {
            src: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
            integrity: 'sha384-JcnsjUPPylna1s1fvi1u12X5qjY5OL56iySh75FdtrwhO/SWXgMjoVqcKyIIWOLk'
        }
    }
};

export function resolveClanKey(search = '', hash = '') {
    const params = new URLSearchParams(search || '');
    const clanParam = (params.get('clan') || '').trim().toLowerCase();
    if (clanParam === '2' || clanParam === 'clan2' || clanParam === '2cgg8y229') {
        return 'clan2';
    }
    const cleanHash = (hash || '').trim().toLowerCase();
    if (cleanHash === '#clan2' || cleanHash === '#clan=2' || cleanHash === '#2') {
        return 'clan2';
    }
    return 'clan1';
}

export function resolveApiBase(loc = (typeof window !== 'undefined' ? window.location : null)) {
    if (!loc) return '';
    const isLocalHost = loc.hostname === '127.0.0.1' || loc.hostname === 'localhost';
    if (isLocalHost && APP_CONFIG.LIVE_SERVER_PORTS.includes(String(loc.port))) {
        return APP_CONFIG.PRODUCTION_ORIGIN;
    }
    return '';
}

export function buildApiUrl(endpoint, loc) {
    return `${resolveApiBase(loc)}${endpoint}`;
}
