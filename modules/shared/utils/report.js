export class ReportManager {
    constructor(getClanDataFn = null, clanTag = '80L9UYGQG') {
        this.getClanDataFn = getClanDataFn;
        this.clanTag = clanTag;
        this.availableDates = [];
        this.currentReportData = null;
        this.setupUI();
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
            modal.classList.remove('hidden');
            document.body.classList.add('modal-open');
            if (this.availableDates.length === 0) {
                this.loadDates();
            }
        };

        btnClose.onclick = () => {
            modal.classList.add('hidden');
            document.body.classList.remove('modal-open');
        };

        typeSelect.onchange = () => this.populateDateSelect();
        btnGenerate.onclick = () => this.generateReport();
        btnDownload.onclick = () => this.downloadPDF();
    }

    async loadDates() {
        const dateSelect = document.getElementById('report-date-select');
        try {
            const res = await fetch(`https://the-eminence.pages.dev/getHistory?type=clan&tag=${this.clanTag}&days=9999`);
            if (!res.ok) throw new Error('Network response was not ok');
            const data = await res.json();
            
            const uniqueDates = [...new Set(data.map(d => d.recorded_at.split(' ')[0]))];
            this.availableDates = uniqueDates.sort().reverse();
            
            this.populateDateSelect();
        } catch (e) {
            console.error(e);
            dateSelect.textContent = '';
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Error cargando fechas';
            dateSelect.appendChild(option);
        }
    }

    populateDateSelect() {
        const type = document.getElementById('report-type-select').value;
        const select = document.getElementById('report-date-select');
        select.textContent = '';

        if (this.availableDates.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No hay datos disponibles';
            select.appendChild(option);
            return;
        }

        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

        if (type === 'weekly') {
            let i = 0;
            let currentOptgroup = null;
            let currentGroupLabel = '';
            let weeksCount = 0;

            while (i < this.availableDates.length && weeksCount < 24) {
                const newerDate = this.availableDates[i];
                const targetDateObj = new Date(newerDate);
                targetDateObj.setDate(targetDateObj.getDate() - 7);
                const targetOlderDateStr = targetDateObj.toISOString().split('T')[0];
                
                let olderDate = this.availableDates[this.availableDates.length - 1]; 
                for (let j = i; j < this.availableDates.length; j++) {
                    if (this.availableDates[j] <= targetOlderDateStr) {
                        olderDate = this.availableDates[j];
                        break;
                    }
                }
                
                // Group by the month of newerDate (YYYY-MM-DD)
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
            this.availableDates.forEach(d => {
                const month = d.substring(0, 7);
                months.add(month);
            });
            
            let currentOptgroup = null;
            let currentYearLabel = '';
            let monthsCount = 0;

            for (const monthStr of months) {
                if (monthsCount >= 12) break;

                const datesInMonth = this.availableDates.filter(d => d.startsWith(monthStr));
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

        document.getElementById('report-loading').classList.remove('hidden');
        document.getElementById('report-preview-container').classList.add('hidden');
        document.getElementById('btn-download-pdf').classList.add('hidden');

        try {
            const clanData = this.getClanDataFn ? this.getClanDataFn() : null;
            let tagsQuery = '';
            if (clanData && clanData.memberList && clanData.memberList.length > 0) {
                const tags = clanData.memberList.map(m => m.tag.replace('#', '')).join(',');
                tagsQuery = `&tags=${tags}`;
            }

            const res = await fetch(`https://the-eminence.pages.dev/getReport?start=${start}&end=${end}${tagsQuery}`);
            if (!res.ok) throw new Error('Error fetch report');
            const data = await res.json();
            
            this.renderReport(data, start, end);
        } catch (e) {
            console.error(e);
            alert('Error al generar informe: ' + e.message);
        } finally {
            document.getElementById('report-loading').classList.add('hidden');
        }
    }

    renderReport(data, start, end) {
        document.getElementById('report-preview-container').classList.remove('hidden');
        document.getElementById('btn-download-pdf').classList.remove('hidden');
        document.getElementById('report-subtitle-print').textContent = `Período: ${start} hasta ${end}`;

        let netGain = 0;
        let inactiveList = [];
        let mvpList = [];
        
        data.forEach(p => {
            const gain = p.end_trophies - p.start_trophies;
            netGain += gain;
            
            if (gain <= 0) {
                inactiveList.push({ ...p, gain });
            }
            mvpList.push({ ...p, gain });
        });

        mvpList.sort((a, b) => b.gain - a.gain);
        inactiveList.sort((a, b) => a.gain - b.gain);

        const netGainEl = document.getElementById('report-net-gain');
        netGainEl.textContent = (netGain > 0 ? '+' : '') + netGain + ' Copas';
        if (netGain >= 0) {
            netGainEl.style.color = '#2e7d32';
        } else {
            netGainEl.style.color = '#c62828';
        }

        document.getElementById('report-active-members').textContent = data.length + ' Miembros';
        document.getElementById('report-risk-members').textContent = inactiveList.length + ' Jugadores';

        const mvpContainer = document.getElementById('report-mvp-list');
        const mvpTemplate = document.getElementById('report-mvp-template');
        mvpContainer.textContent = '';
        
        if (mvpTemplate) {
            const mvpFragment = document.createDocumentFragment();
            mvpList.slice(0, 5).forEach((p, i) => {
                const clone = mvpTemplate.content.cloneNode(true);
                clone.querySelector('.mvp-name').textContent = `#${i+1} ${p.player_name}`;
                clone.querySelector('.mvp-gain').textContent = `+${p.gain}`;
                mvpFragment.appendChild(clone);
            });
            mvpContainer.appendChild(mvpFragment);
        }

        const inactiveContainer = document.getElementById('report-inactive-list');
        const inactiveTemplate = document.getElementById('report-inactive-template');
        inactiveContainer.textContent = '';
        
        if (inactiveTemplate) {
            const inactiveFragment = document.createDocumentFragment();
            inactiveList.forEach(p => {
                const clone = inactiveTemplate.content.cloneNode(true);
                clone.querySelector('.inactive-name').textContent = p.player_name;
                clone.querySelector('.inactive-tag').textContent = p.player_tag;
                clone.querySelector('.inactive-gain').textContent = p.gain;
                inactiveFragment.appendChild(clone);
            });
            inactiveContainer.appendChild(inactiveFragment);
        }
    }

    async downloadPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'pt', 'a4');
        const element = document.getElementById('report-content-print');
        
        document.getElementById('btn-download-pdf').textContent = "Procesando...";

        await html2canvas(element, { scale: 2 }).then(canvas => {
            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            const pdfWidth = doc.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            doc.save(`Informe_Clan_${new Date().toISOString().split('T')[0]}.pdf`);
        });

        document.getElementById('btn-download-pdf').textContent = "Descargar PDF";
    }
}
