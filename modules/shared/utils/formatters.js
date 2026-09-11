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

export function getRankedIconUrl(rankName) {
    if (!rankName) return 'https://cdn.brawlify.com/ranked/regular/Bronze.png';
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
    return `https://cdn.brawlify.com/ranked/regular/${name}.png`;
}

export function getFameIconUrl(fameTierName) {
    if (!fameTierName) return 'https://cdn.brawlify.com/prestiges/regular/1.png';
    const tier = fameTierName.toLowerCase();
    if (tier.includes('alien')) return 'https://cdn.brawlify.com/prestiges/tiered/7.png';
    if (tier.includes('meteoric')) return 'https://cdn.brawlify.com/prestiges/regular/6.png';
    if (tier.includes('solar')) return 'https://cdn.brawlify.com/prestiges/regular/5.png';
    if (tier.includes('saturnian') || tier.includes('saturn')) return 'https://cdn.brawlify.com/prestiges/regular/4.png';
    if (tier.includes('martian') || tier.includes('mars')) return 'https://cdn.brawlify.com/prestiges/regular/3.png';
    if (tier.includes('lunar') || tier.includes('moon')) return 'https://cdn.brawlify.com/prestiges/regular/2.png';
    return 'https://cdn.brawlify.com/prestiges/regular/1.png';
}

export function initDynamicYear() {
    const startYear = 2026;
    const currentYear = new Date().getFullYear();
    const yearText = currentYear > startYear ? `${startYear}-${currentYear}` : `${startYear}`;
    document.querySelectorAll('.copyright-year').forEach(el => {
        el.textContent = yearText;
    });
}

