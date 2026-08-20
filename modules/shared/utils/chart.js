export class ChartManager {
    static instances = {};

    static render(canvasId, type, dataArray, label, color) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        if (this.instances[canvasId]) {
            this.instances[canvasId].destroy();
        }

        if (!dataArray || !Array.isArray(dataArray) || dataArray.length === 0) {
            return;
        }

        const parseDate = (dateStr) => {
            if (!dateStr) return new Date();
            if (typeof dateStr === 'string' && dateStr.includes(' ') && !dateStr.includes('T')) {
                return new Date(dateStr.replace(' ', 'T') + 'Z');
            }
            return new Date(dateStr);
        };

        const dailyMap = {};
        dataArray.forEach(d => {
            if (!d || !d.recorded_at) return;
            const parsed = parseDate(d.recorded_at);
            const dateStr = parsed.toLocaleDateString();
            dailyMap[dateStr] = { ...d, _parsedDate: parsed };
        });
        const cleanData = Object.values(dailyMap).sort((a,b) => a._parsedDate - b._parsedDate);

        if (cleanData.length === 0) return;

        if (cleanData.length === 1) {
            const fakeData = { ...cleanData[0] };
            const fakeDate = new Date(fakeData._parsedDate);
            fakeDate.setDate(fakeDate.getDate() - 1);
            fakeData._parsedDate = fakeDate;
            cleanData.unshift(fakeData);
        }

        const labels = cleanData.map(d => d._parsedDate.toLocaleDateString(undefined, {month:'short', day:'numeric'}));
        const data = cleanData.map(d => type === 'clan' ? d.total_trophies : d.trophies);

        const yAxisConfig = {
            ticks: { color: '#8b949e' }, 
            grid: { color: 'rgba(255,255,255,0.05)' },
            grace: '5%'
        };

        this.instances[canvasId] = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: data,
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