import { Clan2Service } from './Services/clan-2.service.js';
import { ClanService } from '../core/services/clan.service.js';
import { HistoryService } from '../core/services/history.service.js';
import { ChartManager } from '../shared/utils/chart.js';
import { formatNumber, formatRole, getRoleBadgeClass, getProfileIconUrl, getBrawlerIconUrl } from '../shared/utils/formatters.js';

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
        this.setupPodium();
        await this.loadClan();
        setTimeout(() => this.loadPodiumData(true), 600);
    }

    setupEvents() {
        if (this.dom.searchInput) {
            this.dom.searchInput.addEventListener('input', () => this.renderMembers());
        }
        if (this.dom.sortSelect) {
            this.dom.sortSelect.addEventListener('change', () => this.renderMembers());
        }
    }

    setupPodium() {
        const btn = document.getElementById('btn-podium');
        const modal = document.getElementById('podium-modal');
        const closeBtn = document.getElementById('close-podium');
        if (!btn || !modal) return;

        btn.onmouseenter = () => {
            if (!this.podiumMembersData && !this.isPodiumLoading) {
                this.loadPodiumData(true);
            }
        };

        btn.onclick = () => {
            modal.classList.remove('hidden');
            document.body.classList.add('modal-open');
            if (this.podiumMembersData) {
                document.getElementById('podium-loading').classList.add('hidden');
                document.getElementById('podium-content').classList.remove('hidden');
                this.renderPodiumScope();
            } else {
                this.loadPodiumData(false);
            }
        };

        closeBtn.onclick = () => {
            modal.classList.add('hidden');
            document.body.classList.remove('modal-open');
        };

        const tabButtons = document.querySelectorAll('#podium-tabs button');
        tabButtons.forEach(button => {
            button.onclick = () => {
                tabButtons.forEach(b => b.classList.remove('active'));
                button.classList.add('active');
                this.currentPodiumScope = button.dataset.scope || 'general';
                this.renderPodiumScope();
            };
        });
    }

    async loadPodiumData(isBackground = false) {
        if (this.isPodiumLoading) return;
        this.isPodiumLoading = true;

        const loading = document.getElementById('podium-loading');
        const content = document.getElementById('podium-content');
        
        if (!isBackground) {
            loading.classList.remove('hidden');
            content.classList.add('hidden');
        }

        try {
            const [clan1Data, clan2Data] = await Promise.all([
                ClanService.getClanData('80L9UYGQG').catch(() => null),
                ClanService.getClanData('2CGG8Y229').catch(() => null)
            ]);

            const clan1Members = (clan1Data?.members || []).map(m => ({ ...m, clanName: clan1Data?.name || 'The Eminence', clanScope: 'clan1' }));
            const clan2Members = (clan2Data?.members || []).map(m => ({ ...m, clanName: clan2Data?.name || 'The Eminence 2', clanScope: 'clan2' }));

            const allMembers = [...clan1Members, ...clan2Members];
            const allTags = allMembers.map(m => m.tag);

            if (allTags.length === 0) {
                if (!isBackground) loading.textContent = "No se pudieron obtener datos de los clanes.";
                this.isPodiumLoading = false;
                return;
            }

            allMembers.forEach(m => {
                const img = new Image();
                img.src = getProfileIconUrl(m.icon?.id);
            });

            const history = await HistoryService.getPodium(allTags, 7);
            const historyMap = {};
            history.forEach(h => historyMap[h.player_tag] = h.old_trophies);

            this.podiumMembersData = allMembers.map(m => {
                const oldTrophies = historyMap[m.tag];
                const gain = oldTrophies !== undefined ? (m.trophies - oldTrophies) : 0;
                return { ...m, gain };
            });

            this.currentPodiumScope = this.currentPodiumScope || 'general';
            this.renderPodiumScope();

            loading.classList.add('hidden');
            content.classList.remove('hidden');
        } catch (e) {
            console.error("Error loading podium:", e);
            if (!isBackground) loading.textContent = "Error calculando el podio.";
        } finally {
            this.isPodiumLoading = false;
        }
    }

    renderPodiumScope() {
        if (!this.podiumMembersData) return;
        const scope = this.currentPodiumScope || 'general';
        const topList = document.getElementById('podium-top');
        const bottomList = document.getElementById('podium-bottom');
        const titleEl = document.getElementById('podium-scope-title');
        const topTemplate = document.getElementById('podium-top-template');
        const listTemplate = document.getElementById('podium-item-template');
        if (!topList || !bottomList || !topTemplate || !listTemplate) return;

        topList.replaceChildren();
        bottomList.replaceChildren();

        let filtered = [...this.podiumMembersData];
        if (scope === 'clan1') {
            filtered = filtered.filter(m => m.clanScope === 'clan1');
            if (titleEl) titleEl.textContent = '🥇 SALÓN DE LA FAMA (CLAN 1)';
        } else if (scope === 'clan2') {
            filtered = filtered.filter(m => m.clanScope === 'clan2');
            if (titleEl) titleEl.textContent = '🥇 SALÓN DE LA FAMA (CLAN 2)';
        } else {
            if (titleEl) titleEl.textContent = '🥇 SALÓN DE LA FAMA (GENERAL)';
        }

        filtered.sort((a, b) => b.gain - a.gain);

        const renderListItem = (m, rankIcon, rankClass, isGhost = false) => {
            const clone = listTemplate.content.cloneNode(true);
            const item = clone.querySelector('.podium-item');
            
            if (rankClass) item.classList.add(rankClass);
            if (isGhost) item.classList.add('ghost');
            
            clone.querySelector('.p-rank').textContent = rankIcon;
            
            const icon = clone.querySelector('.p-icon');
            icon.src = getProfileIconUrl(m.icon?.id);
            icon.onerror = () => { icon.src = getProfileIconUrl('28000000'); };

            clone.querySelector('.p-name').textContent = m.name;
            clone.querySelector('.p-clan-badge').textContent = m.clanName;
            clone.querySelector('.p-role').textContent = `• ${formatRole(m.role)}`;

            const gainSign = m.gain > 0 ? '+' : '';
            const gainClass = m.gain > 0 ? 'positive' : (m.gain < 0 ? 'negative' : 'neutral');
            const gainEl = clone.querySelector('.p-gain');
            gainEl.classList.add(gainClass);
            clone.querySelector('.p-gain-value').textContent = `${gainSign}${formatNumber(m.gain)}`;

            item.addEventListener('click', () => {
                document.getElementById('podium-modal').classList.add('hidden');
                this.openPlayerProfile(m.tag);
            });

            return clone;
        };

        const renderTopItem = (m, rankNum) => {
            const clone = topTemplate.content.cloneNode(true);
            const step = clone.querySelector('.podium-step');
            step.classList.add(`rank-${rankNum}`);
            
            if (rankNum === 1) {
                const crown = clone.querySelector('.podium-crown');
                if (crown) crown.classList.remove('hidden');
            }

            clone.querySelector('.podium-player-name').textContent = m.name;
            clone.querySelector('.podium-player-clan').textContent = m.clanName;
            
            const avatar = clone.querySelector('.podium-avatar');
            avatar.src = getProfileIconUrl(m.icon?.id);
            avatar.onerror = () => { avatar.src = getProfileIconUrl('28000000'); };

            clone.querySelector('.podium-base').textContent = rankNum;

            const gainSign = m.gain > 0 ? '+' : '';
            const gainClass = m.gain > 0 ? 'positive' : (m.gain < 0 ? 'negative' : 'neutral');
            const gainEl = clone.querySelector('.podium-player-gain');
            gainEl.classList.add(gainClass);
            clone.querySelector('.p-gain-value').textContent = `${gainSign}${formatNumber(m.gain)}`;

            step.addEventListener('click', () => {
                document.getElementById('podium-modal').classList.add('hidden');
                this.openPlayerProfile(m.tag);
            });

            return clone;
        };

        const topFrag = document.createDocumentFragment();
        const top3 = filtered.slice(0, 3);
        if (top3[1]) topFrag.appendChild(renderTopItem(top3[1], 2));
        if (top3[0]) topFrag.appendChild(renderTopItem(top3[0], 1));
        if (top3[2]) topFrag.appendChild(renderTopItem(top3[2], 3));
        topList.appendChild(topFrag);

        const bottomFrag = document.createDocumentFragment();
        const ghosts = [...filtered].reverse();
        ghosts.slice(0, 6).forEach((m) => {
            bottomFrag.appendChild(renderListItem(m, '👻', null, true));
        });
        bottomList.appendChild(bottomFrag);
    }

    async loadClan() {
        this.showState('loading');
        try {
            this.clanData = await Clan2Service.getClanData();
            this.renderHeader();
            this.renderMembers();
            this.setupClanChart();
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
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            exportBtn.onclick = () => this.exportClanToCSV();
        }
    }

    exportClanToCSV() {
        if (this.isExporting) return;
        this.isExporting = true;
        setTimeout(() => this.isExporting = false, 1500);
        if (!this.clanData || !this.clanData.members) return;
        const members = this.clanData.members;
        
        let csv = "Rank,Nombre,Tag,Rol,Copas\n";
        const sorted = [...members].sort((a, b) => b.trophies - a.trophies);
        sorted.forEach((m, index) => {
            csv += `${index + 1},"${m.name}",${m.tag},${m.role},${m.trophies}\n`;
        });
        
        const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Clan_${this.clanData.name}_Stats_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    async setupClanChart() {
        const clanTag = this.clanData.tag;
        const loadChart = async (days) => {
            try {
                const data = await HistoryService.getHistory('clan', clanTag, days);
                ChartManager.render('clan-chart', 'clan', data, 'Copas Totales', 'rgba(102, 252, 241, 1)');
            } catch (e) {
                console.error("Error loading clan chart:", e);
            }
        };

        const buttons = document.querySelectorAll('#clan-chart-filters button');
        buttons.forEach(btn => {
            btn.onclick = () => {
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                loadChart(parseInt(btn.dataset.days));
            };
        });
        
        loadChart(7);
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
            
            const avatar = clone.querySelector('.member-avatar');
            const iconId = member.icon ? member.icon.id : null;
            avatar.src = getProfileIconUrl(iconId);
            avatar.onerror = () => { avatar.src = getProfileIconUrl('28000000'); };

            clone.querySelector('.member-name').textContent = member.name;
            clone.querySelector('.member-tag').textContent = member.tag;
            clone.querySelector('.member-trophies').textContent = formatNumber(member.trophies);
            
            const badge = clone.querySelector('.member-role-badge');
            badge.textContent = formatRole(member.role);
            badge.classList.add(getRoleBadgeClass(member.role));

            fragment.appendChild(clone);
        });

        this.dom.membersList.appendChild(fragment);
    }

    async setupPlayerChart(tag) {
        const loadChart = async (days) => {
            try {
                const data = await HistoryService.getHistory('player', tag, days);
                ChartManager.render('player-chart', 'player', data, 'Copas Actuales', 'rgba(0, 229, 255, 1)');
            } catch (e) {
                console.error("Error loading player chart:", e);
            }
        };

        const buttons = document.querySelectorAll('#player-chart-filters button');
        buttons.forEach(btn => {
            btn.onclick = () => {
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                loadChart(parseInt(btn.dataset.days));
            };
        });
        
        loadChart(7);
    }

    async openPlayerProfile(tag) {
        const modal = document.getElementById('player-modal');
        const loading = document.getElementById('modal-loading');
        const error = document.getElementById('modal-error');
        const body = document.getElementById('modal-body');
        
        modal.classList.remove('hidden');
        document.body.classList.add('modal-open');
        loading.classList.remove('hidden');
        error.classList.add('hidden');
        body.classList.add('hidden');
        
        const closeModal = () => {
            modal.classList.add('hidden');
            document.body.classList.remove('modal-open');
        };

        document.getElementById('close-modal').onclick = closeModal;
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };

        try {
            const { PlayerService } = await import('../core/services/player.service.js');
            const data = await PlayerService.getPlayerData(tag);
            
            const total3v3 = data['3vs3Victories'] || 0;
            const totalSolo = data.soloVictories || 0;
            const totalDuo = data.duoVictories || 0;
            const totalWins = total3v3 + totalSolo + totalDuo;
            const totalMatchesEstimated = totalWins * 2;
            const hoursSpent = Math.floor((totalMatchesEstimated * 2.5) / 60);

            document.getElementById('sc-name').textContent = data.name;
            document.getElementById('sc-tag').textContent = data.tag;
            document.getElementById('sc-trophies').textContent = formatNumber(data.trophies);
            document.getElementById('sc-highest').textContent = formatNumber(data.highestTrophies);
            document.getElementById('sc-level').textContent = data.expLevel;
            document.getElementById('sc-xp').textContent = formatNumber(data.expPoints);
            document.getElementById('sc-total-wins').textContent = formatNumber(totalWins);
            document.getElementById('sc-hours').textContent = formatNumber(hoursSpent);
            document.getElementById('sc-3v3').textContent = formatNumber(total3v3);
            document.getElementById('sc-solo').textContent = formatNumber(totalSolo);
            document.getElementById('sc-duo').textContent = formatNumber(totalDuo);
            
            const captureBtn = document.getElementById('capture-btn');
            captureBtn.style.display = 'inline-flex';
            captureBtn.onclick = () => {
                const btnText = captureBtn.querySelector('.btn-share-text');
                if (btnText) btnText.textContent = 'Generando...';
                html2canvas(document.getElementById('share-card'), {
                    backgroundColor: '#0b0e14',
                    scale: 2
                }).then(canvas => {
                    if (btnText) btnText.textContent = 'Tarjeta Gráfica';
                    const link = document.createElement('a');
                    link.download = `TheEminence_${data.name}.png`;
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                }).catch(() => {
                    if (btnText) btnText.textContent = 'Tarjeta Gráfica';
                });
            };
            document.getElementById('player-name').textContent = data.name;
            document.getElementById('player-tag').textContent = data.tag;
            
            const modalIcon = document.getElementById('player-modal-icon');
            if (modalIcon) {
                if (data.icon && data.icon.id) {
                    modalIcon.src = getProfileIconUrl(data.icon.id);
                    modalIcon.onerror = () => { modalIcon.src = getProfileIconUrl('28000000'); };
                    modalIcon.style.display = 'block';
                } else {
                    modalIcon.style.display = 'none';
                }
            }
            
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
            
            document.getElementById('prog-brawlers').textContent = brawlers.length;
            document.getElementById('prog-starpowers').textContent = unlockedStarPowers;
            document.getElementById('prog-gadgets').textContent = unlockedGadgets;
            document.getElementById('prog-gears').textContent = unlockedGears;
            
            const brawlersList = document.getElementById('brawlers-list');
            brawlersList.textContent = '';
            
            const brawlerTemplate = document.getElementById('brawler-template');
            const frag = document.createDocumentFragment();
            
            brawlers.sort((a, b) => b.trophies - a.trophies).slice(0, 8).forEach(brawler => {
                const clone = brawlerTemplate.content.cloneNode(true);
                const icon = clone.querySelector('.brawler-avatar');
                if (icon) icon.src = getBrawlerIconUrl(brawler.id);
                clone.querySelector('.brawler-name').textContent = brawler.name;
                clone.querySelector('.brawler-power').textContent = `Fuerza ${brawler.power}`;
                clone.querySelector('.brawler-trophies').textContent = formatNumber(brawler.trophies);
                clone.querySelector('.brawler-highest').textContent = formatNumber(brawler.highestTrophies);
                frag.appendChild(clone);
            });
            
            brawlersList.appendChild(frag);
            
            this.setupPlayerChart(tag);

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
