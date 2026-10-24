import { APP_CONFIG, resolveClanKey } from './app.config.js?v=2.1.0';
import { ClanService } from '../modules/core/services/clan.service.js?v=2.1.0';
import { PlayerService } from '../modules/core/services/player.service.js?v=2.1.0';
import { HistoryService } from '../modules/core/services/history.service.js?v=2.1.0';
import { ChartManager } from '../modules/shared/utils/chart.js?v=2.1.0';
import {
    escapeCsvCell,
    formatNumber,
    formatRole,
    getBrawlerIconUrl,
    getFameIconUrl,
    getLocalDateString,
    getProfileIconUrl,
    getRankedIconUrl,
    getRoleBadgeClass,
    initDynamicYear,
    parseUtcDate
} from '../modules/shared/utils/formatters.js?v=2.1.0';
import { ReportManager } from '../modules/shared/utils/report.js?v=2.1.0';
import { ensureHtml2Canvas } from '../modules/shared/utils/script-loader.js?v=2.1.0';

function attachButtonBehavior(el, handler) {
    if (!el) return;
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.addEventListener('click', handler);
    el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handler(e);
        }
    });
}

export class ClanTrackerApp {
    constructor({ clanKey = null } = {}) {
        this.activeClanKey = clanKey || resolveClanKey(window.location.search, window.location.hash);
        this.clanData = null;
        this.hasShownWinners = false;
        this.podiumCache = {};
        this.activePlayerRequestId = 0;
        this.playerAbortController = null;
        this.clanChartAbortController = null;
        this.playerChartAbortController = null;
        this.searchDebounceTimer = null;

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
            switchClanBtn: document.getElementById('btn-switch-clan'),

            memberTemplate: document.getElementById('member-template')
        };

        const activeClan = this.getActiveClanConfig();
        this.reportManager = new ReportManager(() => this.clanData, activeClan.tag, activeClan.name);
        this.init();
    }

    getActiveClanConfig() {
        return APP_CONFIG.CLANS[this.activeClanKey] || APP_CONFIG.CLANS.clan1;
    }

    getOtherClanConfig() {
        return this.activeClanKey === 'clan1' ? APP_CONFIG.CLANS.clan2 : APP_CONFIG.CLANS.clan1;
    }

    init() {
        initDynamicYear();
        const localDay = new Date().getDay();
        this.currentPodiumPeriod = (localDay === 4 || localDay === 5) ? 'previous' : 'current';

        this.updateClanMetadataUI();
        this.setupEvents();
        this.setupPodium();
        this.setupModalsAccessibility();
        this.loadClan();
    }

    updateClanMetadataUI() {
        const clan = this.getActiveClanConfig();
        const other = this.getOtherClanConfig();

        document.title = `${clan.name} | Brawl Stars Clan`;
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.setAttribute('content', clan.description);

        if (this.dom.switchClanBtn) {
            const fullText = this.dom.switchClanBtn.querySelector('.switch-clan-full');
            const shortText = this.dom.switchClanBtn.querySelector('.switch-clan-short');
            if (fullText) fullText.textContent = `Ir al ${other.shortLabel}`;
            if (shortText) shortText.textContent = other.shortLabel;
            this.dom.switchClanBtn.setAttribute('aria-label', `Cambiar a ${other.name}`);
        }
    }

    async switchClan(nextClanKey, { updateHistory = true } = {}) {
        if (!APP_CONFIG.CLANS[nextClanKey] || nextClanKey === this.activeClanKey) return;
        this.activeClanKey = nextClanKey;

        const clan = this.getActiveClanConfig();
        if (updateHistory && window.history && window.history.pushState) {
            const nextUrl = nextClanKey === 'clan2' ? '?clan=2' : window.location.pathname;
            window.history.pushState({ clanKey: nextClanKey }, '', nextUrl);
        }

        this.updateClanMetadataUI();
        this.reportManager.setClan(clan.tag, clan.name);
        if (this.dom.searchInput) this.dom.searchInput.value = '';
        await this.loadClan();
    }

    setupEvents() {
        if (this.dom.searchInput) {
            this.dom.searchInput.addEventListener('input', () => {
                clearTimeout(this.searchDebounceTimer);
                this.searchDebounceTimer = setTimeout(() => this.renderMembers(), 120);
            });
        }

        if (this.dom.sortSelect) {
            this.dom.sortSelect.addEventListener('change', () => {
                this.renderMembers();
            });
        }

        if (this.dom.switchClanBtn) {
            this.dom.switchClanBtn.addEventListener('click', () => {
                const other = this.getOtherClanConfig();
                this.switchClan(other.key);
            });
        }

        window.addEventListener('popstate', () => {
            const key = resolveClanKey(window.location.search, window.location.hash);
            if (key !== this.activeClanKey) {
                this.switchClan(key, { updateHistory: false });
            }
        });

        const retryBtn = document.getElementById('btn-retry-clan');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => this.loadClan());
        }
    }

    setupModalsAccessibility() {
        const playerModal = document.getElementById('player-modal');
        const podiumModal = document.getElementById('podium-modal');
        const reportModal = document.getElementById('report-modal');
        const closePlayerBtn = document.getElementById('close-modal');
        const closePodiumBtn = document.getElementById('close-podium');

        const closePlayerModal = () => {
            if (!playerModal || playerModal.classList.contains('hidden')) return;
            playerModal.classList.add('hidden');
            document.body.classList.remove('modal-open');
            this.activePlayerRequestId++;
            if (this.playerAbortController) {
                this.playerAbortController.abort();
                this.playerAbortController = null;
            }
            if (this.playerChartAbortController) {
                this.playerChartAbortController.abort();
                this.playerChartAbortController = null;
            }
        };

        const closePodiumModal = () => {
            if (!podiumModal || podiumModal.classList.contains('hidden')) return;
            podiumModal.classList.add('hidden');
            document.body.classList.remove('modal-open');
        };

        if (closePlayerBtn) closePlayerBtn.onclick = closePlayerModal;
        if (playerModal) {
            playerModal.onclick = (e) => {
                if (e.target === playerModal) closePlayerModal();
            };
        }

        if (closePodiumBtn) closePodiumBtn.onclick = closePodiumModal;
        if (podiumModal) {
            podiumModal.onclick = (e) => {
                if (e.target === podiumModal) closePodiumModal();
            };
        }

        window.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            if (playerModal && !playerModal.classList.contains('hidden')) {
                closePlayerModal();
                return;
            }
            if (podiumModal && !podiumModal.classList.contains('hidden')) {
                closePodiumModal();
                return;
            }
            if (reportModal && !reportModal.classList.contains('hidden')) {
                this.reportManager.closeModal();
            }
        });
    }

    setupPodium() {
        const btn = document.getElementById('btn-podium');
        const modal = document.getElementById('podium-modal');
        if (!btn || !modal) return;

        const preload = () => {
            if (!this.podiumMembersData && !this.podiumLoadingPromise) {
                this.loadPodiumData(true);
            }
        };

        btn.addEventListener('mouseenter', preload);
        btn.addEventListener('focus', preload);

        btn.addEventListener('click', () => {
            modal.classList.remove('hidden');
            document.body.classList.add('modal-open');
            if (this.podiumMembersData) {
                const loadingEl = document.getElementById('podium-loading');
                const contentEl = document.getElementById('podium-content');
                if (loadingEl) loadingEl.classList.add('hidden');
                if (contentEl) contentEl.classList.remove('hidden');
                const topList = document.getElementById('podium-top');
                if (!topList || !topList.hasChildNodes() || this.lastRenderedScope !== (this.currentPodiumScope || 'general') || this.lastRenderedPeriod !== this.currentPodiumPeriod) {
                    this.renderPodiumScope();
                }
                this.showAllWinnersAnnouncement();
            } else {
                this.loadPodiumData(false);
            }
        });

        const periodTabs = document.querySelectorAll('#podium-period-tabs button');
        periodTabs.forEach((button) => {
            button.classList.toggle('active', button.dataset.period === this.currentPodiumPeriod);
            button.onclick = () => {
                const period = button.dataset.period || 'previous';
                if (this.currentPodiumPeriod === period) return;
                periodTabs.forEach((b) => b.classList.remove('active'));
                button.classList.add('active');
                this.currentPodiumPeriod = period;
                this.switchPodiumPeriod(period);
            };
        });

        const tabButtons = document.querySelectorAll('#podium-tabs button');
        tabButtons.forEach((button) => {
            button.onclick = () => {
                tabButtons.forEach((b) => b.classList.remove('active'));
                button.classList.add('active');
                this.currentPodiumScope = button.dataset.scope || 'general';
                this.renderPodiumScope();
            };
        });
    }

    processPeriodData(pName, historyList, allMembers) {
        const historyMap = {};
        let minRecordTime = Date.now();

        (historyList || []).forEach((h) => {
            if (h.player_tag) {
                historyMap[h.player_tag] = h;
                historyMap[h.player_tag.replace(/^#/, '')] = h;
            }
            if (h.oldest_record) {
                const parsed = parseUtcDate(h.oldest_record);
                if (parsed && parsed.getTime() < minRecordTime) {
                    minRecordTime = parsed.getTime();
                }
            }
        });

        const daysSinceStart = (Date.now() - minRecordTime) / (1000 * 60 * 60 * 24);
        const localDay = new Date().getDay();
        const daysSinceWed = (localDay - 3 + 7) % 7;

        let isWeekCompleted;
        let cycleDay;
        if (pName === 'previous') {
            isWeekCompleted = true;
            cycleDay = 7;
        } else {
            isWeekCompleted = daysSinceWed === 0 || daysSinceStart >= 6.8;
            cycleDay = daysSinceWed === 0 ? 7 : daysSinceWed;
        }

        const members = allMembers.map((m) => {
            const clean = m.tag.replace(/^#/, '');
            const record = historyMap[m.tag] || historyMap[clean];
            let gain = 0;
            if (record) {
                if (pName === 'previous') {
                    gain = record.gain !== undefined ? record.gain : ((record.end_trophies || 0) - (record.old_trophies || 0));
                } else if (record.old_trophies !== undefined) {
                    gain = m.trophies - record.old_trophies;
                } else if (record.gain !== undefined) {
                    gain = record.gain;
                }
            }
            return { ...m, gain };
        });

        return {
            members,
            isWeekCompleted,
            cycleDay,
            daysSinceStart
        };
    }

    async switchPodiumPeriod(period) {
        this.currentPodiumPeriod = period;
        if (this.podiumCache && this.podiumCache[period]) {
            const cached = this.podiumCache[period];
            this.podiumMembersData = cached.members;
            this.isWeekCompleted = cached.isWeekCompleted;
            this.cycleDay = cached.cycleDay;
            this.daysSinceStart = cached.daysSinceStart;
            this.renderPodiumScope();
            return;
        }

        if (this.podiumLoadingPromise) {
            const loading = document.getElementById('podium-loading');
            const content = document.getElementById('podium-content');
            if (loading) loading.classList.remove('hidden');
            if (content) content.classList.add('hidden');
            await this.podiumLoadingPromise;
            if (this.podiumCache && this.podiumCache[period]) {
                const cached = this.podiumCache[period];
                this.podiumMembersData = cached.members;
                this.isWeekCompleted = cached.isWeekCompleted;
                this.cycleDay = cached.cycleDay;
                this.daysSinceStart = cached.daysSinceStart;
                this.renderPodiumScope();
                if (loading) loading.classList.add('hidden');
                if (content) content.classList.remove('hidden');
                return;
            }
        }

        await this.loadPodiumData(false, period);
    }

    async loadPodiumData(isBackground = false, targetPeriod = null) {
        if (this.podiumLoadingPromise) {
            if (!isBackground) {
                const loading = document.getElementById('podium-loading');
                const content = document.getElementById('podium-content');
                if (loading) loading.classList.remove('hidden');
                if (content) content.classList.add('hidden');
            }
            return await this.podiumLoadingPromise;
        }

        const period = targetPeriod || this.currentPodiumPeriod || ((new Date().getDay() === 4 || new Date().getDay() === 5) ? 'previous' : 'current');
        this.currentPodiumPeriod = period;

        const loading = document.getElementById('podium-loading');
        const content = document.getElementById('podium-content');

        if (!isBackground) {
            if (loading) loading.classList.remove('hidden');
            if (content) content.classList.add('hidden');
        }

        this.podiumLoadingPromise = (async () => {
            try {
                const clan1Cfg = APP_CONFIG.CLANS.clan1;
                const clan2Cfg = APP_CONFIG.CLANS.clan2;

                const clan1Promise = (this.activeClanKey === 'clan1' && this.clanData)
                    ? Promise.resolve(this.clanData)
                    : ClanService.getClanData(clan1Cfg.tag).catch(() => null);
                const clan2Promise = (this.activeClanKey === 'clan2' && this.clanData)
                    ? Promise.resolve(this.clanData)
                    : ClanService.getClanData(clan2Cfg.tag).catch(() => null);

                const [clan1Data, clan2Data] = await Promise.all([clan1Promise, clan2Promise]);

                const clan1Members = (clan1Data?.members || []).map((m) => ({
                    ...m,
                    clanName: clan1Data?.name || clan1Cfg.name,
                    clanScope: 'clan1'
                }));
                const clan2Members = (clan2Data?.members || []).map((m) => ({
                    ...m,
                    clanName: clan2Data?.name || clan2Cfg.name,
                    clanScope: 'clan2'
                }));

                const allMembers = [...clan1Members, ...clan2Members];
                const allTags = allMembers.map((m) => m.tag);

                if (allTags.length === 0) {
                    if (!isBackground && loading) loading.textContent = 'No se pudieron obtener datos de los clanes.';
                    return;
                }

                const [prevHistory, currHistory] = await Promise.all([
                    HistoryService.getPodium(allTags, 7, 'previous').catch((e) => { console.error('Error prev podium:', e); return []; }),
                    HistoryService.getPodium(allTags, 7, 'current').catch((e) => { console.error('Error curr podium:', e); return []; })
                ]);

                this.podiumCache = this.podiumCache || {};
                if (prevHistory && prevHistory.length > 0) {
                    this.podiumCache.previous = this.processPeriodData('previous', prevHistory, allMembers);
                }
                if (currHistory && currHistory.length > 0) {
                    this.podiumCache.current = this.processPeriodData('current', currHistory, allMembers);
                }

                const active = this.podiumCache[this.currentPodiumPeriod] || this.podiumCache.previous || this.podiumCache.current;
                if (active) {
                    this.podiumMembersData = active.members;
                    this.isWeekCompleted = active.isWeekCompleted;
                    this.cycleDay = active.cycleDay;
                    this.daysSinceStart = active.daysSinceStart;

                    this.currentPodiumScope = this.currentPodiumScope || 'general';
                    this.renderPodiumScope();

                    if (loading) loading.classList.add('hidden');
                    if (content) content.classList.remove('hidden');

                    const modal = document.getElementById('podium-modal');
                    if (modal && !modal.classList.contains('hidden')) {
                        this.showAllWinnersAnnouncement();
                    }
                } else {
                    if (!isBackground && loading) loading.textContent = 'No se pudieron calcular estadísticas del podio.';
                }
            } catch (e) {
                console.error('Error loading podium:', e);
                if (!isBackground && loading) loading.textContent = 'Error calculando el podio.';
            } finally {
                this.podiumLoadingPromise = null;
            }
        })();

        return await this.podiumLoadingPromise;
    }

    createPodiumListItem(m, rankLabel, isGhost = false) {
        const listTemplate = document.getElementById('podium-item-template');
        if (!listTemplate) return document.createDocumentFragment();
        const clone = listTemplate.content.cloneNode(true);
        const item = clone.querySelector('.podium-item');

        if (isGhost) item.classList.add('ghost');

        clone.querySelector('.p-rank').textContent = rankLabel;

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

        attachButtonBehavior(item, () => {
            document.getElementById('podium-modal')?.classList.add('hidden');
            this.openPlayerProfile(m.tag);
        });

        return clone;
    }

    renderPodiumScope() {
        if (!this.podiumMembersData) return;
        const scope = this.currentPodiumScope || 'general';
        this.lastRenderedScope = scope;
        this.lastRenderedPeriod = this.currentPodiumPeriod;
        const topList = document.getElementById('podium-top');
        const bottomList = document.getElementById('podium-bottom');
        const titleEl = document.getElementById('podium-scope-title');
        const topTemplate = document.getElementById('podium-top-template');
        const listTemplate = document.getElementById('podium-item-template');
        if (!topList || !bottomList || !topTemplate || !listTemplate) return;

        topList.replaceChildren();
        bottomList.replaceChildren();

        let filtered = [...this.podiumMembersData];
        const isPrev = this.currentPodiumPeriod === 'previous';
        const day = Math.max(1, Math.min(7, this.cycleDay || 1));
        if (scope === 'clan1') {
            filtered = filtered.filter((m) => m.clanScope === 'clan1');
            if (titleEl) titleEl.textContent = isPrev ? '🏆 SALÓN DE LA FAMA (CLAN 1 - SEMANA PASADA)' : `🥇 LÍDERES ACTUALES (CLAN 1 - DÍA ${day}/7)`;
        } else if (scope === 'clan2') {
            filtered = filtered.filter((m) => m.clanScope === 'clan2');
            if (titleEl) titleEl.textContent = isPrev ? '🏆 SALÓN DE LA FAMA (CLAN 2 - SEMANA PASADA)' : `🥇 LÍDERES ACTUALES (CLAN 2 - DÍA ${day}/7)`;
        } else if (titleEl) {
            titleEl.textContent = isPrev ? '🏆 SALÓN DE LA FAMA (SEMANA PASADA)' : `🥇 LÍDERES ACTUALES (GENERAL - DÍA ${day}/7)`;
        }

        const fantasmonesSub = document.querySelector('.fantasmones-header .text-muted');
        if (fantasmonesSub) {
            fantasmonesSub.textContent = isPrev
                ? 'Menor aporte en copas (Semana cerrada)'
                : 'Menor aporte en copas (Ciclo actual)';
        }

        filtered.sort((a, b) => b.gain - a.gain);

        const renderTopItem = (m, rankNum) => {
            const clone = topTemplate.content.cloneNode(true);
            const step = clone.querySelector('.podium-step');
            step.classList.add(`rank-${rankNum}`);
            step.classList.add('animate');

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

            attachButtonBehavior(step, () => {
                document.getElementById('podium-modal')?.classList.add('hidden');
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
            bottomFrag.appendChild(this.createPodiumListItem(m, '👻', true));
        });
        bottomList.appendChild(bottomFrag);
    }

    showAllWinnersAnnouncement(force = false) {
        const today = getLocalDateString();
        const storageKey = `hasShownWinners_${today}`;
        if (!force && (this.hasShownWinners || !this.podiumMembersData || localStorage.getItem(storageKey))) return;
        this.hasShownWinners = true;
        try {
            localStorage.setItem(storageKey, 'true');
        } catch {
            return;
        }

        const template = document.getElementById('winners-announcement-template');
        if (!template) return;

        const existing = document.querySelector('.winner-announcement-overlay');
        if (existing) existing.remove();

        const clone = template.content.cloneNode(true);
        const overlay = clone.querySelector('.winner-announcement-overlay');

        const titleEl = clone.querySelector('.winners-title');
        if (titleEl) {
            if (!this.isWeekCompleted) {
                const day = Math.max(1, Math.min(7, this.cycleDay || Math.ceil(this.daysSinceStart || 1)));
                titleEl.textContent = `🔥 LÍDERES ACTUALES (DÍA ${day}/7) 🔥`;
                titleEl.classList.remove('text-gold');
                titleEl.classList.add('text-neon');
            } else {
                titleEl.textContent = this.currentPodiumPeriod === 'previous'
                    ? '🏆 GANADORES DE LA SEMANA PASADA 🏆'
                    : '🏆 GANADORES DE LA SEMANA 🏆';
                titleEl.classList.remove('text-neon');
                titleEl.classList.add('text-gold');
            }
        }

        const getWinner = (scope) => {
            let list = [...this.podiumMembersData];
            if (scope === 'clan1' || scope === 'clan2') {
                list = list.filter((m) => m.clanScope === scope);
            }
            return list.sort((a, b) => b.gain - a.gain)[0];
        };

        const setupRow = (prefix, player) => {
            if (!player) return;
            const gainSign = player.gain > 0 ? '+' : '';
            clone.querySelector(`.w-${prefix}-name`).textContent = player.name;
            clone.querySelector(`.w-${prefix}-gain`).textContent = `${gainSign}${formatNumber(player.gain)} Copas`;
            const av = clone.querySelector(`.w-${prefix}-avatar`);
            av.src = getProfileIconUrl(player.icon?.id);
            av.onerror = () => { av.src = getProfileIconUrl('28000000'); };
        };

        setupRow('gen', getWinner('general'));
        setupRow('c1', getWinner('clan1'));
        setupRow('c2', getWinner('clan2'));

        const confettiContainer = clone.querySelector('.confetti-container');
        const confettiTemplate = document.getElementById('confetti-template');
        if (confettiContainer && confettiTemplate && this.isWeekCompleted) {
            const colors = ['#ffcf33', '#ff003c', '#009dff', '#00ff66', '#d000ff'];
            const frag = document.createDocumentFragment();

            for (let i = 0; i < 28; i++) {
                const confNode = confettiTemplate.content.cloneNode(true);
                const conf = confNode.querySelector('.confetti-piece');

                conf.style.setProperty('--left', `${Math.random() * 100}%`);
                conf.style.setProperty('--bg-color', colors[Math.floor(Math.random() * colors.length)]);
                conf.style.setProperty('--anim-delay', `${Math.random() * 2}s`);
                conf.style.setProperty('--anim-dur', `${Math.random() * 2 + 2}s`);

                frag.appendChild(confNode);
            }
            confettiContainer.appendChild(frag);
        }

        const closeBtn = clone.querySelector('.close-announcement-btn');
        if (closeBtn) {
            closeBtn.onclick = () => {
                overlay.classList.add('fade-out');
                setTimeout(() => { if (overlay && overlay.parentNode) overlay.remove(); }, 500);
            };
        }

        const modal = document.getElementById('podium-modal');
        if (modal) {
            modal.appendChild(clone);
        }
    }

    async loadClan() {
        this.showState('loading');
        try {
            this.clanData = await ClanService.getClanData();
            this.renderHeader();
            this.renderMembers();
            this.setupClanChart();
            if (typeof initOrbitAnimation === 'function') {
                initOrbitAnimation(this.clanData);
            }
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
            const { PlayerService } = await import('../modules/core/services/player.service.js');
            const data = await PlayerService.getPlayerData(tag);
            
            const total3v3 = data['3vs3Victories'] || 0;
            const totalSolo = data.soloVictories || 0;
            const totalDuo = data.duoVictories || 0;
            const totalWins = total3v3 + totalSolo + totalDuo;
            const totalMatchesEstimated = totalWins * 2;
            const hoursSpent = Math.floor((totalMatchesEstimated * 2.5) / 60);

            const brawlers = data.brawlers || [];
            let unlockedStarPowers = 0;
            let unlockedGadgets = 0;
            let unlockedGears = 0;
            let unlockedHypercharges = 0;
            let totalPrestigeTrophies = 0;
            let prestige1Count = 0;
            let prestige2Count = 0;
            let prestige3Count = 0;

            brawlers.forEach(b => {
                unlockedStarPowers += (b.starPowers || []).length;
                unlockedGadgets += (b.gadgets || []).length;
                unlockedGears += (b.gears || []).length;
                unlockedHypercharges += (b.hyperCharges || []).length;

                const current = b.trophies || 0;
                const peak = Math.max(current, b.highestTrophies || 0);

                if (current > 1000) {
                    totalPrestigeTrophies += (current - 1000);
                }

                if (peak >= 1000) {
                    prestige1Count++;
                }
                if (peak >= 2000) {
                    prestige2Count++;
                }
                if (peak >= 3000) {
                    prestige3Count++;
                }
            });

            const totalPrestigeCount = prestige1Count + prestige2Count + prestige3Count;

            const currentRanked = data.rankedRankName || 'Sin Rango';
            const currentRankedElo = data.rankedElo ? `Ranked Actual (${formatNumber(data.rankedElo)})` : 'Ranked Actual';
            const highestRanked = data.highestAllTimeRankedRankName || (data.rankedRankName || 'Sin Rango');
            const highestRankedElo = data.highestAllTimeRankedElo ? `Récord Ranked (${formatNumber(data.highestAllTimeRankedElo)})` : 'Récord Ranked';

            const currentFame = data.fameTierName || 'Sin Fama';
            const famePoints = data.fame ? `Fama (${formatNumber(data.fame)} pts)` : 'Fama Mundial';

            const rankedIcon = getRankedIconUrl(data.rankedRankName);
            const highestRankedIcon = getRankedIconUrl(data.highestAllTimeRankedRankName || data.rankedRankName);
            const fameIcon = getFameIconUrl(data.fameTierName);

            document.getElementById('sc-name').textContent = data.name;
            document.getElementById('sc-tag').textContent = data.tag;
            document.getElementById('sc-trophies').textContent = formatNumber(data.trophies);
            document.getElementById('sc-highest').textContent = formatNumber(data.highestTrophies);
            document.getElementById('sc-prestige-trophies').textContent = formatNumber(totalPrestigeTrophies);
            document.getElementById('sc-total-prestige').textContent = formatNumber(totalPrestigeCount);
            document.getElementById('sc-prestige-1').textContent = formatNumber(prestige1Count);
            document.getElementById('sc-prestige-2').textContent = formatNumber(prestige2Count);
            document.getElementById('sc-prestige-3').textContent = formatNumber(prestige3Count);
            document.getElementById('sc-ranked').textContent = currentRanked;
            document.getElementById('sc-ranked-label').textContent = currentRankedElo;
            document.getElementById('sc-ranked-icon').src = rankedIcon;
            document.getElementById('sc-ranked-highest').textContent = highestRanked;
            document.getElementById('sc-ranked-highest-label').textContent = highestRankedElo;
            document.getElementById('sc-ranked-highest-icon').src = highestRankedIcon;
            document.getElementById('sc-fame').textContent = currentFame;
            document.getElementById('sc-fame-label').textContent = famePoints;
            document.getElementById('sc-fame-icon').src = fameIcon;
            document.getElementById('sc-level').textContent = data.expLevel;
            document.getElementById('sc-xp').textContent = formatNumber(data.expPoints);
            document.getElementById('sc-total-wins').textContent = formatNumber(totalWins);
            document.getElementById('sc-hours').textContent = formatNumber(hoursSpent);
            document.getElementById('sc-3v3').textContent = formatNumber(total3v3);
            document.getElementById('sc-solo').textContent = formatNumber(totalSolo);
            document.getElementById('sc-duo').textContent = formatNumber(totalDuo);
            
            const captureBtn = document.getElementById('capture-btn');
            captureBtn.classList.remove('hidden');
            captureBtn.onclick = () => {
                const btnText = captureBtn.querySelector('.btn-share-text');
                if (btnText) btnText.textContent = 'Generando...';
                html2canvas(document.getElementById('share-card'), {
                    backgroundColor: '#0b0e14',
                    scale: 2,
                    useCORS: true
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
                    modalIcon.classList.remove('hidden');
                } else {
                    modalIcon.classList.add('hidden');
                }
            }
            
            document.getElementById('player-trophies').textContent = formatNumber(data.trophies);
            document.getElementById('player-highest-trophies').textContent = formatNumber(data.highestTrophies);
            document.getElementById('player-prestige-trophies').textContent = formatNumber(totalPrestigeTrophies);
            document.getElementById('player-total-prestige').textContent = formatNumber(totalPrestigeCount);
            document.getElementById('player-prestige-1').textContent = formatNumber(prestige1Count);
            document.getElementById('player-prestige-2').textContent = formatNumber(prestige2Count);
            document.getElementById('player-prestige-3').textContent = formatNumber(prestige3Count);
            document.getElementById('player-ranked').textContent = currentRanked;
            document.getElementById('player-ranked-label').textContent = currentRankedElo;
            document.getElementById('player-ranked-icon').src = rankedIcon;
            document.getElementById('player-ranked-highest').textContent = highestRanked;
            document.getElementById('player-ranked-highest-label').textContent = highestRankedElo;
            document.getElementById('player-ranked-highest-icon').src = highestRankedIcon;
            document.getElementById('player-fame').textContent = currentFame;
            document.getElementById('player-fame-label').textContent = famePoints;
            document.getElementById('player-fame-icon').src = fameIcon;
            document.getElementById('player-level').textContent = data.expLevel;
            document.getElementById('player-xp-points').textContent = formatNumber(data.expPoints);
            
            document.getElementById('player-total-wins').textContent = formatNumber(totalWins);
            document.getElementById('player-hours').textContent = formatNumber(hoursSpent);
            
            document.getElementById('player-3v3-wins').textContent = formatNumber(total3v3);
            document.getElementById('player-solo-wins').textContent = formatNumber(totalSolo);
            document.getElementById('player-duo-wins').textContent = formatNumber(totalDuo);
            
            document.getElementById('prog-brawlers').textContent = brawlers.length;
            document.getElementById('prog-starpowers').textContent = unlockedStarPowers;
            document.getElementById('prog-gadgets').textContent = unlockedGadgets;
            document.getElementById('prog-gears').textContent = unlockedGears;
            document.getElementById('prog-hypercharges').textContent = unlockedHypercharges;
            
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

document.addEventListener('DOMContentLoaded', () => new ClanTrackerApp());

function initOrbitAnimation(clanData) {
    const container = document.getElementById("orbit-system-container");
    const template = document.getElementById("orbit-satellite-template");
    if (!container || !template || !clanData || !clanData.members) return;

    container.querySelectorAll('.satellite-wrapper').forEach(el => el.remove());

    const members = clanData.members;
    const userAcc = members.find(m => m.tag === '#YPLYVQVLL') || {
        tag: '#YPLYVQVLL',
        name: '🪷アレックス🪷',
        icon: { id: 28000889 }
    };
    const usedTags = new Set([userAcc.tag]);
    
    const president = members.find(m => m.role === 'president' && !usedTags.has(m.tag)) || members.find(m => !usedTags.has(m.tag));
    if (president) usedTags.add(president.tag);
    
    const vicePresident = members.find(m => m.role === 'vicePresident' && !usedTags.has(m.tag)) || members.find(m => !usedTags.has(m.tag));
    if (vicePresident) usedTags.add(vicePresident.tag);
    
    const topPlayer = members.find(m => !usedTags.has(m.tag)) || members[3] || members[0];

    const getIconUrl = (iconId) => `https://cdn.brawlify.com/profile-icons/regular/${iconId}.png`;

    const orbitData = [];
    if (userAcc) orbitData.push({ name: `Yo (${userAcc.name})`, icon: getIconUrl(userAcc.icon?.id || '28000000') });
    if (president) orbitData.push({ name: `Presi (${president.name})`, icon: getIconUrl(president.icon?.id || '28000000') });
    if (vicePresident) orbitData.push({ name: `Vice (${vicePresident.name})`, icon: getIconUrl(vicePresident.icon?.id || '28000000') });
    if (topPlayer) orbitData.push({ name: `Top (${topPlayer.name})`, icon: getIconUrl(topPlayer.icon?.id || '28000000') });

    const fragment = document.createDocumentFragment();
    const duration = 18;

    orbitData.forEach((app, index) => {
        const clone = template.content.cloneNode(true);
        const wrapper = clone.querySelector(".satellite-wrapper");
        const sat = clone.querySelector(".satellite");
        const blob = clone.querySelector(".blob");
        const inner = clone.querySelector(".satellite-inner");
        const img = clone.querySelector("img");
        const srOnly = clone.querySelector(".sr-only");

        const delay = -(duration / orbitData.length) * index;
        
        wrapper.style.animationDelay = `${delay}s`;
        sat.style.animationDelay = `${delay}s`;
        blob.style.animationDelay = `${-index * 2.3}s`;
        inner.style.animationDelay = `${-index * 1.3}s`;

        img.src = app.icon;
        img.alt = "";
        if (srOnly) srOnly.textContent = app.name;

        fragment.appendChild(clone);
    });

    container.appendChild(fragment);
}
