export class ChartManager {
    static instances = {};

    static render(canvasId, type, dataArray, label, color) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        if (this.instances[canvasId]) {
            this.instances[canvasId].destroy();
        }

        if (!dataArray || dataArray.length === 0) {

        }

        const dailyMap = {};
        dataArray.forEach(d => {
            const dateStr = new Date(d.recorded_at).toLocaleDateString();
            dailyMap[dateStr] = d;
        });
        const cleanData = Object.values(dailyMap).sort((a,b) => new Date(a.recorded_at) - new Date(b.recorded_at));

        const labels = cleanData.map(d => new Date(d.recorded_at).toLocaleDateString(undefined, {month:'short', day:'numeric'}));
        const data = cleanData.map(d => type === 'clan' ? d.total_trophies : d.trophies);

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
                    y: { ticks: { color: '#8b949e' }, grid: { color: 'rgba(255,255,255,0.05)' } }
                }
            }
        });
    }
}