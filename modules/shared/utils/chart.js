import { parseUtcDate } from './formatters.js?v=2.1.0';

export class ChartManager {
    static instances = {};

    static setEmptyState(canvas, message) {
        const container = canvas?.parentElement;
        if (!container) return;

        let emptyEl = container.querySelector('.chart-empty-state');
        if (!message) {
            if (emptyEl) emptyEl.remove();
            return;
        }

        if (!emptyEl) {
            emptyEl = document.createElement('div');
            emptyEl.className = 'chart-empty-state';
            container.appendChild(emptyEl);
        }
        emptyEl.textContent = message;
    }

    static render(canvasId, type, dataArray, label, color, emptyMessage = 'Sin datos históricos en este período.') {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        if (this.instances[canvasId]) {
            this.instances[canvasId].destroy();
            delete this.instances[canvasId];
        }

        if (!dataArray || !Array.isArray(dataArray) || dataArray.length === 0) {
            this.setEmptyState(canvas, emptyMessage);
            return;
        }

        const dailyMap = {};

        dataArray.forEach((d) => {
            if (!d || !d.recorded_at) return;
            const parsed = parseUtcDate(d.recorded_at);
            if (!parsed) return;
            const dateStr = parsed.toLocaleDateString();
            dailyMap[dateStr] = { ...d, _parsedDate: parsed };
        });

        const cleanData = Object.values(dailyMap).sort((a, b) => a._parsedDate - b._parsedDate);

        if (cleanData.length === 0) {
            this.setEmptyState(canvas, emptyMessage);
            return;
        }

        this.setEmptyState(canvas, null);

        if (cleanData.length === 1) {
            const fakeData = { ...cleanData[0] };
            const fakeDate = new Date(fakeData._parsedDate);
            fakeDate.setDate(fakeDate.getDate() - 1);
            fakeData._parsedDate = fakeDate;
            cleanData.unshift(fakeData);
        }

        const labels = cleanData.map((d) => d._parsedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
        const data = cleanData.map((d) => (type === 'clan' ? d.total_trophies : d.trophies));

        const yAxisConfig = {
            ticks: { color: '#8b949e' },
            grid: { color: 'rgba(255,255,255,0.05)' },
            grace: '5%'
        };

        this.instances[canvasId] = new Chart(canvas, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label,
                    data,
                    borderColor: color,
                    backgroundColor: color.replace('1)', '0.1)'),
                    borderWidth: 3,
                    pointRadius: 4,
                    pointBackgroundColor: '#0b0e14',
                    pointBorderColor: color,
                    pointBorderWidth: 2,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(11, 14, 20, 0.9)',
                        titleColor: '#66fcf1',
                        bodyColor: '#fff',
                        borderColor: '#66fcf1',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: { ticks: { color: '#8b949e', maxTicksLimit: 7 }, grid: { display: false } },
                    y: yAxisConfig
                }
            }
        });
    }
}
