import { ClanService } from '../../core/services/clan.service.js?v=2.1.0';
import { HistoryService } from '../../core/services/history.service.js?v=2.1.0';
import { getLocalDateString } from './formatters.js?v=2.1.0';
import { ensureHtml2Canvas, ensureJsPdf } from './script-loader.js?v=2.1.0';

export class ReportManager {
    constructor(getClanDataFn = null, clanTag = '80L9UYGQG', clanName = 'The Eminence') {
        this.getClanDataFn = getClanDataFn;
        this.clanTag = clanTag;
        this.clanName = clanName;
        this.availableDates = [];
        this.isLoadingDates = false;
        this.setupUI();
    }

    setClan(clanTag, clanName = 'The Eminence') {
        const normalizedNew = String(clanTag || '').replace(/^#/, '').toUpperCase();
        const normalizedOld = String(this.clanTag || '').replace(/^#/, '').toUpperCase();
        this.clanTag = clanTag;
        this.clanName = clanName;
        if (normalizedNew !== normalizedOld) {
            this.availableDates = [];
            this.clearError();
            document.getElementById('report-preview-container')?.classList.add('hidden');
            document.getElementById('btn-download-pdf')?.classList.add('hidden');
        }
    }

    showError(message) {
        const errorEl = document.getElementById('report-error');
        if (!errorEl) return;
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    }

    clearError() {
        const errorEl = document.getElementById('report-error');
        if (!errorEl) return;
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
    }

    closeModal() {
        const modal = document.getElementById('report-modal');
        if (!modal || modal.classList.contains('hidden')) return;
        modal.classList.add('hidden');
        document.body.classList.remove('modal-open');
    }

    setupUI() {
        const btnOpen = document.getElementById('btn-report');
        const modal = document.getElementById('report-modal');
        const btnClose = document.getElementById('close-report');
        const typeSelect = document.getElementById('report-type-select');
        const dateSelect = document.getElementById('report-date-select');
        const btnGenerate = document.getElementById('btn-generate-report');
        const btnDownload = document.getElementById('btn-download-pdf');

        if (!btnOpen || !modal) return;

        btnOpen.onclick = () => {
            this.clearError();
            modal.classList.remove('hidden');
            document.body.classList.add('modal-open');
            if (this.availableDates.length === 0 && !this.isLoadingDates) {
                this.loadDates();
            }
        };

        if (btnClose) btnClose.onclick = () => this.closeModal();

        modal.onclick = (e) => {
            if (e.target === modal) this.closeModal();
        };

        if (typeSelect) {
            typeSelect.onchange = () => {
                this.clearError();
                document.getElementById('report-preview-container')?.classList.add('hidden');
                document.getElementById('btn-download-pdf')?.classList.add('hidden');
                if (this.availableDates.length === 0 && !this.isLoadingDates) {
                    this.loadDates();
                } else {
                    this.populateDateSelect();
                }
            };
        }

        if (dateSelect) {
            dateSelect.onchange = () => {
                this.clearError();
                document.getElementById('report-preview-container')?.classList.add('hidden');
                document.getElementById('btn-download-pdf')?.classList.add('hidden');
            };
        }

        if (btnGenerate) btnGenerate.onclick = () => this.generateReport();
        if (btnDownload) btnDownload.onclick = () => this.downloadPDF();
    }

    async loadDates() {
        const dateSelect = document.getElementById('report-date-select');
        const btnGenerate = document.getElementById('btn-generate-report');
        if (!dateSelect) return;

        if (this.isLoadingDates) return;
        this.isLoadingDates = true;

        if (btnGenerate) btnGenerate.disabled = true;
        dateSelect.textContent = '';
        const loadingOption = document.createElement('option');
        loadingOption.value = '';
        loadingOption.textContent = 'Cargando fechas...';
        dateSelect.appendChild(loadingOption);

        try {
            const dates = await HistoryService.getAvailableDates(this.clanTag);
            const uniqueDates = [...new Set((dates || []).filter(Boolean))];
            this.availableDates = uniqueDates.sort().reverse();
            this.populateDateSelect();
        } catch (e) {
            console.error(e);
            dateSelect.textContent = '';
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Error cargando fechas';
            dateSelect.appendChild(option);
            if (btnGenerate) btnGenerate.disabled = true;
            this.showError('No se pudieron cargar las fechas disponibles para este clan.');
        } finally {
            this.isLoadingDates = false;
        }
    }

    populateDateSelect() {
        const type = document.getElementById('report-type-select').value;
        const select = document.getElementById('report-date-select');
        const btnGenerate = document.getElementById('btn-generate-report');
        select.textContent = '';

        if (this.availableDates.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = this.isLoadingDates ? 'Cargando fechas...' : 'No hay datos disponibles';
            select.appendChild(option);
            if (btnGenerate) btnGenerate.disabled = true;
            return;
        }

        if (btnGenerate) btnGenerate.disabled = false;

        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        if (type === 'weekly') {
            let i = 0;
            let currentOptgroup = null;
            let currentGroupLabel = '';
            let weeksCount = 0;

            while (i < this.availableDates.length && weeksCount < 24) {
                const newerDate = this.availableDates[i];
                const targetDateObj = new Date(`${newerDate}T00:00:00Z`);
                targetDateObj.setUTCDate(targetDateObj.getUTCDate() - 7);
                const targetOlderDateStr = targetDateObj.toISOString().split('T')[0];

                let olderDate = this.availableDates[this.availableDates.length - 1];
                for (let j = i; j < this.availableDates.length; j++) {
                    if (this.availableDates[j] <= targetOlderDateStr) {
                        olderDate = this.availableDates[j];
                        break;
                    }
                }

                const [yearStr, monthStr] = newerDate.split('-');
                const groupLabel = `${monthNames[parseInt(monthStr, 10) - 1]} ${yearStr}`;

                if (groupLabel !== currentGroupLabel) {
                    currentGroupLabel = groupLabel;
                    currentOptgroup = document.createElement('optgroup');
                    currentOptgroup.label = groupLabel;
                    select.appendChild(currentOptgroup);
                }

                const option = document.createElement('option');
                option.value = `${olderDate}|${newerDate}`;
                option.textContent = `${olderDate} al ${newerDate}`;
                currentOptgroup.appendChild(option);
                weeksCount++;

                let nextI = i + 1;
                while (nextI < this.availableDates.length && this.availableDates[nextI] > targetOlderDateStr) {
                    nextI++;
                }
                if (nextI === i) nextI++;
                i = nextI;
            }
        } else if (type === 'monthly') {
            const months = new Set();
            this.availableDates.forEach((d) => {
                months.add(d.substring(0, 7));
            });

            let currentOptgroup = null;
            let currentYearLabel = '';
            let monthsCount = 0;

            for (const monthStr of months) {
                if (monthsCount >= 12) break;

                const datesInMonth = this.availableDates.filter((d) => d.startsWith(monthStr));
                const newerDate = datesInMonth[0];
                const olderDate = datesInMonth[datesInMonth.length - 1];

                const [year, monthNum] = monthStr.split('-');
                if (year !== currentYearLabel) {
                    currentYearLabel = year;
                    currentOptgroup = document.createElement('optgroup');
                    currentOptgroup.label = `Año ${year}`;
                    select.appendChild(currentOptgroup);
                }

                const option = document.createElement('option');
                option.value = `${olderDate}|${newerDate}`;
                option.textContent = `${monthNames[parseInt(monthNum, 10) - 1]} (${olderDate.slice(5)} al ${newerDate.slice(5)})`;
                currentOptgroup.appendChild(option);
                monthsCount++;
            }
        } else if (type === 'global') {
            const olderDate = this.availableDates[this.availableDates.length - 1];
            const newerDate = this.availableDates[0];
            const option = document.createElement('option');
            option.value = `${olderDate}|${newerDate}`;
            option.textContent = `Todo el historial (${olderDate} al ${newerDate})`;
            select.appendChild(option);
        }
    }

    async generateReport() {
        const val = document.getElementById('report-date-select').value;
        if (!val) return;
        const [start, end] = val.split('|');

        const btnGenerate = document.getElementById('btn-generate-report');
        if (btnGenerate) btnGenerate.disabled = true;

        this.clearError();
        document.getElementById('report-loading').classList.remove('hidden');
        document.getElementById('report-preview-container').classList.add('hidden');
        document.getElementById('btn-download-pdf').classList.add('hidden');

        try {
            const clanData = (typeof this.getClanDataFn === 'function') ? this.getClanDataFn() : null;
            let members = clanData?.members || clanData?.memberList || [];

            if (!members || members.length === 0) {
                const fetchedClan = await ClanService.getClanData(this.clanTag);
                members = fetchedClan.members || fetchedClan.memberList || [];
            }

            if (!members || members.length === 0) {
                throw new Error('No se pudieron obtener los miembros del clan actual.');
            }

            const tags = members.map((m) => m.tag || m.player_tag).filter(Boolean);
            const data = await HistoryService.getReport(start, end, tags);

            this.renderReport(data, start, end, members);
        } catch (e) {
            console.error(e);
            this.showError(`Error al generar informe: ${e.message}`);
        } finally {
            document.getElementById('report-loading').classList.add('hidden');
            if (btnGenerate) btnGenerate.disabled = false;
        }
    }

    renderReport(data, start, end, fullMemberList = []) {
        document.getElementById('report-preview-container').classList.remove('hidden');
        document.getElementById('btn-download-pdf').classList.remove('hidden');
        const titleEl = document.getElementById('report-title-clan');
        if (titleEl) titleEl.textContent = `Auditoría del Clan: ${this.clanName}`;
        document.getElementById('report-subtitle-print').textContent = `Período: ${start} hasta ${end}`;

        const reportType = document.getElementById('report-type-select').value;
        const threshold = reportType === 'weekly' ? 800 : (reportType === 'monthly' ? 2000 : null);

        let netGain = 0;
        const mvpList = [];
        let riskCount = 0;
        let activeWithVariationCount = 0;
        const historyMap = new Map();
        const normalizeTag = (tag) => (tag || '').replace(/^#/, '').toUpperCase();

        (data || []).forEach((p) => {
            const startTrophies = Number.isFinite(Number(p.start_trophies)) ? Number(p.start_trophies) : 0;
            const endTrophies = Number.isFinite(Number(p.end_trophies)) ? Number(p.end_trophies) : startTrophies;
            const gain = endTrophies - startTrophies;
            historyMap.set(normalizeTag(p.player_tag), {
                player_tag: p.player_tag,
                player_name: p.player_name,
                gain,
                hasRecord: true
            });
        });

        const membersArray = Array.isArray(fullMemberList) ? fullMemberList : [];

        membersArray.forEach((m) => {
            const tagKey = normalizeTag(m.tag || m.player_tag);
            const record = historyMap.get(tagKey);
            if (record) {
                netGain += record.gain;
                if (record.gain !== 0) activeWithVariationCount++;
                const isRisk = threshold !== null ? record.gain < threshold : record.gain <= 0;
                if (isRisk) riskCount++;
                mvpList.push({ ...record, isRisk });
            } else {
                if (threshold !== null) riskCount++;
                mvpList.push({
                    player_tag: m.tag || m.player_tag,
                    player_name: m.name || m.player_name,
                    gain: 0,
                    isRisk: true,
                    hasRecord: false
                });
            }
        });

        if (membersArray.length === 0) {
            historyMap.forEach((record) => {
                netGain += record.gain;
                if (record.gain !== 0) activeWithVariationCount++;
                const isRisk = threshold !== null ? record.gain < threshold : record.gain <= 0;
                if (isRisk) riskCount++;
                mvpList.push({ ...record, isRisk });
            });
        }

        mvpList.sort((a, b) => b.gain - a.gain);

        const netGainEl = document.getElementById('report-net-gain');
        netGainEl.textContent = (netGain > 0 ? '+' : '') + netGain + ' Copas';
        netGainEl.className = netGain >= 0 ? 'gain-good' : 'gain-risk';

        const totalCount = membersArray.length > 0 ? membersArray.length : (data || []).length;
        const activeCount = historyMap.size;
        const activeMembersEl = document.getElementById('report-active-members');
        activeMembersEl.textContent = `${activeCount} / ${totalCount} Miembros`;
        activeMembersEl.title = `${activeCount} con registro histórico (${activeWithVariationCount} con variación de copas)`;

        const riskMembersEl = document.getElementById('report-risk-members');
        riskMembersEl.textContent = reportType === 'global' ? 'N/A' : `${riskCount} Jugadores`;

        const qualifyingMvps = mvpList.filter((p) => p.hasRecord && (threshold !== null ? p.gain >= threshold : p.gain > 0));
        const mvpPlayers = qualifyingMvps.slice(0, 5);
        const mvpTags = new Set(mvpPlayers.map((p) => normalizeTag(p.player_tag)));
        const restOfMembers = mvpList.filter((p) => !mvpTags.has(normalizeTag(p.player_tag)));

        const mvpContainer = document.getElementById('report-mvp-list');
        const mvpTemplate = document.getElementById('report-mvp-template');
        mvpContainer.textContent = '';

        if (mvpTemplate) {
            const mvpFragment = document.createDocumentFragment();
            if (mvpPlayers.length === 0) {
                const tr = document.createElement('tr');
                const td = document.createElement('td');
                td.colSpan = 2;
                td.className = 'text-center report-empty-cell';
                td.textContent = 'Ningún jugador alcanzó el aporte mínimo de MVP.';
                tr.appendChild(td);
                mvpFragment.appendChild(tr);
            } else {
                mvpPlayers.forEach((p, i) => {
                    const clone = mvpTemplate.content.cloneNode(true);
                    clone.querySelector('.mvp-name').textContent = `#${i + 1} ${p.player_name}`;
                    clone.querySelector('.mvp-gain').textContent = (p.gain > 0 ? '+' : '') + p.gain;
                    mvpFragment.appendChild(clone);
                });
            }
            mvpContainer.appendChild(mvpFragment);
        }

        const inactiveContainer = document.getElementById('report-inactive-list');
        const inactiveTemplate = document.getElementById('report-inactive-template');
        inactiveContainer.textContent = '';

        if (inactiveTemplate) {
            const inactiveFragment = document.createDocumentFragment();
            if (restOfMembers.length === 0) {
                const tr = document.createElement('tr');
                const td = document.createElement('td');
                td.colSpan = 3;
                td.className = 'text-center report-empty-cell';
                td.textContent = 'No hay más miembros que mostrar.';
                tr.appendChild(td);
                inactiveFragment.appendChild(tr);
            } else {
                restOfMembers.forEach((p, i) => {
                    const clone = inactiveTemplate.content.cloneNode(true);
                    const rankNum = i + mvpPlayers.length + 1;
                    clone.querySelector('.inactive-name').textContent = `#${rankNum} ${p.player_name}`;
                    clone.querySelector('.inactive-tag').textContent = p.player_tag;

                    const gainEl = clone.querySelector('.inactive-gain');
                    gainEl.textContent = '';
                    const valSpan = document.createElement('span');

                    if (p.hasRecord === false) {
                        valSpan.className = 'gain-neutral';
                        valSpan.textContent = 'Sin registro';
                    } else {
                        const gainStr = (p.gain > 0 ? '+' : '') + p.gain;
                        if (threshold !== null) {
                            valSpan.className = p.gain < threshold ? 'gain-risk' : 'gain-good';
                        } else {
                            valSpan.className = p.gain > 0 ? 'gain-good' : (p.gain < 0 ? 'gain-risk' : 'gain-neutral');
                        }
                        valSpan.textContent = gainStr;
                    }
                    gainEl.appendChild(valSpan);
                    inactiveFragment.appendChild(clone);
                });
            }
            inactiveContainer.appendChild(inactiveFragment);
        }
    }

    async downloadPDF() {
        const btn = document.getElementById('btn-download-pdf');
        const element = document.getElementById('report-content-print');

        if (!element) return;
        this.clearError();

        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Procesando...';
        }

        try {
            const [html2canvasFn, JsPDF] = await Promise.all([
                ensureHtml2Canvas(),
                ensureJsPdf()
            ]);

            if (document.fonts && document.fonts.ready) {
                await document.fonts.ready;
            }

            const canvas = await html2canvasFn(element, {
                scale: 2,
                backgroundColor: '#14151f',
                useCORS: true,
                scrollX: 0,
                scrollY: 0,
                windowWidth: 1200,
                onclone: (clonedDoc) => {
                    clonedDoc.body.style.height = 'auto';
                    clonedDoc.body.style.overflow = 'visible';
                    clonedDoc.body.style.fontFamily = "'Outfit', system-ui, -apple-system, sans-serif";
                    clonedDoc.documentElement.style.height = 'auto';
                    clonedDoc.documentElement.style.overflow = 'visible';

                    const printEl = clonedDoc.getElementById('report-content-print');
                    if (printEl) {
                        printEl.style.height = 'auto';
                        printEl.style.maxHeight = 'none';
                        printEl.style.overflow = 'visible';
                        printEl.style.width = '640px';
                        printEl.style.maxWidth = '640px';
                        printEl.style.margin = '0 auto';
                        printEl.style.padding = '22px 26px';
                        printEl.style.boxSizing = 'border-box';
                    }
                    const preview = clonedDoc.getElementById('report-preview-container');
                    if (preview) {
                        preview.style.height = 'auto';
                        preview.style.maxHeight = 'none';
                        preview.style.overflow = 'visible';
                        preview.style.padding = '0';
                        preview.style.border = 'none';
                    }
                    const modal = clonedDoc.querySelector('.modal-content');
                    if (modal) {
                        modal.style.height = 'auto';
                        modal.style.maxHeight = 'none';
                        modal.style.overflow = 'visible';
                    }
                }
            });

            const pageWidth = 595.28;
            const pageHeight = 841.89;
            const margin = 20;
            const contentWidth = pageWidth - (margin * 2);
            const contentHeightPerPage = pageHeight - (margin * 2);
            const pxPerPt = canvas.width / contentWidth;
            const sliceHeightPx = Math.floor(contentHeightPerPage * pxPerPt);

            const doc = new JsPDF('p', 'pt', 'a4');
            let offsetY = 0;
            let pageIndex = 0;

            while (offsetY < canvas.height) {
                if (pageIndex > 0) {
                    doc.addPage('a4', 'p');
                }
                doc.setFillColor(20, 21, 31);
                doc.rect(0, 0, pageWidth, pageHeight, 'F');

                const currentSliceHeightPx = Math.min(sliceHeightPx, canvas.height - offsetY);
                const pageCanvas = document.createElement('canvas');
                pageCanvas.width = canvas.width;
                pageCanvas.height = currentSliceHeightPx;

                const ctx = pageCanvas.getContext('2d');
                ctx.drawImage(
                    canvas,
                    0,
                    offsetY,
                    canvas.width,
                    currentSliceHeightPx,
                    0,
                    0,
                    canvas.width,
                    currentSliceHeightPx
                );

                const sliceImgData = pageCanvas.toDataURL('image/jpeg', 0.95);
                const renderHeightPt = currentSliceHeightPx / pxPerPt;
                doc.addImage(sliceImgData, 'JPEG', margin, margin, contentWidth, renderHeightPt, undefined, 'FAST');

                offsetY += currentSliceHeightPx;
                pageIndex++;
            }

            const cleanTag = this.clanTag.replace(/^#/, '');
            doc.save(`Informe_Clan_${cleanTag}_${getLocalDateString()}.pdf`);
        } catch (err) {
            console.error('PDF error:', err);
            this.showError(`Error generando PDF: ${err.message}`);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Descargar PDF';
            }
        }
    }
}
