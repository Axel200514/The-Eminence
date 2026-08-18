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
