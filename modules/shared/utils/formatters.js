export function formatNumber(num) {
    if (typeof num !== 'number') return '0';
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

export function initDynamicYear() {
    const startYear = 2026;
    const currentYear = new Date().getFullYear();
    const yearText = currentYear > startYear ? `${startYear}-${currentYear}` : `${startYear}`;
    document.querySelectorAll('.copyright-year').forEach(el => {
        el.textContent = yearText;
    });
}

