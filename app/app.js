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
            const card = clone.querySelector('.member-card');
            
            card.classList.add('clickable');
            card.addEventListener('click', () => this.openPlayerProfile(member.tag));
            
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

    async openPlayerProfile(tag) {
        const modal = document.getElementById('player-modal');
        const loading = document.getElementById('modal-loading');
        const error = document.getElementById('modal-error');
        const body = document.getElementById('modal-body');
        
        modal.classList.remove('hidden');
        loading.classList.remove('hidden');
        error.classList.add('hidden');
        body.classList.add('hidden');
        
        document.getElementById('close-modal').onclick = () => modal.classList.add('hidden');

        try {
            const { PlayerService } = await import('../modules/core/services/player.service.js');
            const data = await PlayerService.getPlayerData(tag);
            
            const total3v3 = data['3vs3Victories'] || 0;
            const totalSolo = data.soloVictories || 0;
            const totalDuo = data.duoVictories || 0;
            const totalWins = total3v3 + totalSolo + totalDuo;
            const hoursSpent = Math.floor((totalWins * 2.5) / 60);

            document.getElementById('player-name').textContent = data.name;
            document.getElementById('player-tag').textContent = data.tag;
            
            document.getElementById('player-trophies').textContent = formatNumber(data.trophies);
            document.getElementById('player-highest-trophies').textContent = formatNumber(data.highestTrophies);
            document.getElementById('player-level').textContent = data.expLevel;
            document.getElementById('player-xp-points').textContent = formatNumber(data.expPoints);
            
            document.getElementById('player-total-wins').textContent = formatNumber(totalWins);
            document.getElementById('player-hours').textContent = formatNumber(hoursSpent);
            
            document.getElementById('player-3v3-wins').textContent = formatNumber(total3v3);
            document.getElementById('player-solo-wins').textContent = formatNumber(totalSolo);
            document.getElementById('player-duo-wins').textContent = formatNumber(totalDuo);
            
            const brawlers = data.brawlers || [];
            
            let unlockedStarPowers = 0;
            let unlockedGadgets = 0;
            let unlockedGears = 0;
            
            brawlers.forEach(b => {
                unlockedStarPowers += (b.starPowers || []).length;
                unlockedGadgets += (b.gadgets || []).length;
                unlockedGears += (b.gears || []).length;
            });
            
            const TOTAL_BRAWLERS = 105;
            const progressPercent = Math.min(100, Math.round((brawlers.length / TOTAL_BRAWLERS) * 100));
            
            const progFill = document.getElementById('progression-fill');
            progFill.style.width = `${progressPercent}%`;
            document.getElementById('progression-text').textContent = `${progressPercent}%`;
            document.getElementById('prog-brawlers').textContent = `${brawlers.length}/${TOTAL_BRAWLERS}`;
            document.getElementById('prog-starpowers').textContent = unlockedStarPowers;
            document.getElementById('prog-gadgets').textContent = unlockedGadgets;
            document.getElementById('prog-gears').textContent = unlockedGears;
            
            const brawlersList = document.getElementById('brawlers-list');
            brawlersList.textContent = '';
            
            const brawlerTemplate = document.getElementById('brawler-template');
            const frag = document.createDocumentFragment();
            
            brawlers.sort((a, b) => b.trophies - a.trophies).slice(0, 8).forEach(brawler => {
                const clone = brawlerTemplate.content.cloneNode(true);
                clone.querySelector('.brawler-name').textContent = brawler.name;
                clone.querySelector('.brawler-power').textContent = `Fuerza ${brawler.power}`;
                clone.querySelector('.brawler-trophies').textContent = formatNumber(brawler.trophies);
                clone.querySelector('.brawler-highest').textContent = formatNumber(brawler.highestTrophies);
                frag.appendChild(clone);
            });
            
            brawlersList.appendChild(frag);
            
            loading.classList.add('hidden');
            body.classList.remove('hidden');
        } catch (err) {
            loading.classList.add('hidden');
            error.classList.remove('hidden');
            document.getElementById('modal-error-message').textContent = err.message || 'No se pudo cargar el perfil.';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => new App());
