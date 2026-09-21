export function formatNumber(num) {
    if (typeof num !== 'number' || Number.isNaN(num)) return '0';
    return new Intl.NumberFormat('es-NI').format(num);
}

export function formatRole(role) {
    const roles = {
        president: 'Presidente',
        vicePresident: 'Vicepresidente',
        senior: 'Veterano',
        member: 'Miembro'
    };
    return roles[role] || role;
}

export function getRoleBadgeClass(role) {
    const classes = {
        president: 'badge-president',
        vicePresident: 'badge-vp',
        senior: 'badge-senior',
        member: 'badge-member'
    };
    return classes[role] || 'badge-member';
}

export function getProfileIconUrl(iconId) {
    const defaultIcon = '28000000';
    const id = iconId || defaultIcon;
    return `https://cdn.brawlify.com/profile-icons/regular/${id}.png`;
}

export function getBrawlerIconUrl(brawlerId) {
    if (!brawlerId) return '';
    return `https://cdn.brawlify.com/brawlers/borderless/${brawlerId}.png`;
}

export function getRankedIconUrl(rankName, basePath = 'styles/Icons/ranked/') {
    if (!rankName) return `${basePath}Bronze.png`;
    const league = rankName.split(' ')[0].toLowerCase();
    const map = {
        bronze: 'Bronze',
        silver: 'Silver',
        gold: 'Gold',
        diamond: 'Diamond',
        mythic: 'Mythic',
        legendary: 'Legendary',
        masters: 'Masters'
    };
    const name = map[league] || 'Bronze';
    return `${basePath}${name}.png`;
}

export function getFameIconUrl(fameTierName, basePath = 'styles/Icons/fame/') {
    if (!fameTierName) return `${basePath}global.png`;
    const tier = fameTierName.toLowerCase();
    if (tier.includes('starr') || tier.includes('force')) return `${basePath}starrforce.png`;
    if (tier.includes('alien')) return `${basePath}alien.png`;
    if (tier.includes('meteoric')) return `${basePath}meteoric.png`;
    if (tier.includes('solar')) return `${basePath}solar.png`;
    if (tier.includes('saturnian') || tier.includes('saturn')) return `${basePath}saturnian.png`;
    if (tier.includes('martian') || tier.includes('mars')) return `${basePath}martian.png`;
    if (tier.includes('lunar') || tier.includes('moon')) return `${basePath}lunar.png`;
    return `${basePath}global.png`;
}

export function parseUtcDate(dateStr) {
    if (!dateStr) return null;
    if (dateStr instanceof Date) {
        return Number.isNaN(dateStr.getTime()) ? null : dateStr;
    }
    const str = String(dateStr).trim();
    if (!str) return null;

    let normalized = str;
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        normalized = `${str}T00:00:00Z`;
    } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(str) && !str.includes('T')) {
        normalized = str.replace(' ', 'T');
        if (!normalized.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(normalized)) {
            normalized += 'Z';
        }
    }

    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function escapeCsvCell(value) {
    const text = String(value ?? '').replace(/"/g, '""');
    return `"${text}"`;
}

export function initDynamicYear() {
    const startYear = 2026;
    const currentYear = new Date().getFullYear();
    const yearText = currentYear > startYear ? `${startYear}-${currentYear}` : `${startYear}`;
    document.querySelectorAll('.copyright-year').forEach((el) => {
        el.textContent = yearText;
    });
}
