import { ClanService } from '../modules/core/services/clan.service.js';
import { formatNumber, formatRole, getRoleBadgeClass } from '../modules/shared/utils/formatters.js';

class App {
    constructor() {
        this.clanData = null;
        this.dom = {
            loading: document.getElementById('state-loading'),
            content: document.getElementById('state-content'),
            error: document.getElementById('state-error'),
            errorMessage: document.getElementById('error-message'),
            
            clanName: document.getElementById('clan-name'),
            clanTag: document.getElementById('clan-tag'),
            clanDesc: document.getElementById('clan-desc'),
            totalTrophies: document.getElementById('total-trophies'),
            memberCount: document.getElementById('member-count'),
            requiredTrophies: document.getElementById('required-trophies'),
            presidentName: document.getElementById('president-name'),
            
            membersList: document.getElementById('members-list'),
            searchInput: document.getElementById('search-input'),
            sortSelect: document.getElementById('sort-select'),
            
            memberTemplate: document.getElementById('member-template')
        };

        this.init();
    }

    async init() {
        this.setupEvents();
        await this.loadClan();
    }

    setupEvents() {
        if (this.dom.searchInput) {
            this.dom.searchInput.addEventListener('input', () => this.renderMembers());
        }
        if (this.dom.sortSelect) {
            this.dom.sortSelect.addEventListener('change', () => this.renderMembers());
        }
    }

    async loadClan() {
        this.showState('loading');
        try {
            this.clanData = await ClanService.getClanData();
            this.renderHeader();
            this.renderMembers();
            this.showState('content');
        } catch (error) {
            this.dom.errorMessage.textContent = error.message || 'Error al cargar los datos del clan.';
            this.showState('error');
        }
    }

    showState(state) {
        this.dom.loading.classList.toggle('hidden', state !== 'loading');
        this.dom.content.classList.toggle('hidden', state !== 'content');
        this.dom.error.classList.toggle('hidden', state !== 'error');
    }

    renderHeader() {
        const { name, tag, description, trophies, requiredTrophies, members } = this.clanData;
        const president = members.find(m => m.role === 'president');

        this.dom.clanName.textContent = name;
        this.dom.clanTag.textContent = tag;
        this.dom.clanDesc.textContent = description || 'Sin descripción';
        this.dom.totalTrophies.textContent = formatNumber(trophies);
        this.dom.memberCount.textContent = `${members.length} / 30`;
        this.dom.requiredTrophies.textContent = formatNumber(requiredTrophies);
        this.dom.presidentName.textContent = president ? president.name : 'N/A';
    }

    renderMembers() {
        const query = (this.dom.searchInput.value || '').toLowerCase().trim();
        const sortBy = this.dom.sortSelect.value || 'trophies-desc';

        let members = [...(this.clanData?.members || [])];

        if (query) {
            members = members.filter(m => 
                m.name.toLowerCase().includes(query) || 
                m.tag.toLowerCase().includes(query)
            );
        }

        members.sort((a, b) => {
            if (sortBy === 'trophies-desc') return b.trophies - a.trophies;
            if (sortBy === 'trophies-asc') return a.trophies - b.trophies;
            if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
            return 0;
        });

        this.dom.membersList.textContent = '';
        const fragment = document.createDocumentFragment();

        members.forEach((member, index) => {
            const clone = this.dom.memberTemplate.content.cloneNode(true);
            
            clone.querySelector('.member-rank').textContent = `#${index + 1}`;
            clone.querySelector('.member-name').textContent = member.name;
            clone.querySelector('.member-tag').textContent = member.tag;
            clone.querySelector('.member-trophies').textContent = `🏆 ${formatNumber(member.trophies)}`;
            
            const badge = clone.querySelector('.member-role-badge');
            badge.textContent = formatRole(member.role);
            badge.classList.add(getRoleBadgeClass(member.role));

            fragment.appendChild(clone);
        });

        this.dom.membersList.appendChild(fragment);
    }
}

document.addEventListener('DOMContentLoaded', () => new App());
