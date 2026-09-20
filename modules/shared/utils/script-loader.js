import { APP_CONFIG } from '../../../app/app.config.js?v=2.1.0';

const loadedScripts = new Map();

export function loadExternalScript(src, integrity = '') {
    if (loadedScripts.has(src)) {
        return loadedScripts.get(src);
    }

    const promise = new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            if (existing.dataset.loaded === 'true') {
                resolve();
                return;
            }
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => {
                loadedScripts.delete(src);
                reject(new Error(`No se pudo cargar la librería ${src}`));
            }, { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.crossOrigin = 'anonymous';
        if (integrity) {
            script.integrity = integrity;
        }

        script.onload = () => {
            script.dataset.loaded = 'true';
            resolve();
        };

        script.onerror = () => {
            loadedScripts.delete(src);
            script.remove();
            reject(new Error(`No se pudo cargar la librería ${src}`));
        };

        document.head.appendChild(script);
    });

    loadedScripts.set(src, promise);
    return promise;
}

export async function ensureHtml2Canvas() {
    if (typeof window !== 'undefined' && typeof window.html2canvas !== 'undefined') {
        return window.html2canvas;
    }
    const lib = APP_CONFIG.EXTERNAL_LIBS.HTML2CANVAS;
    await loadExternalScript(lib.src, lib.integrity);
    if (typeof window.html2canvas === 'undefined') {
        throw new Error('La librería html2canvas no está disponible.');
    }
    return window.html2canvas;
}

export async function ensureJsPdf() {
    if (typeof window !== 'undefined' && window.jspdf && window.jspdf.jsPDF) {
        return window.jspdf.jsPDF;
    }
    const lib = APP_CONFIG.EXTERNAL_LIBS.JSPDF;
    await loadExternalScript(lib.src, lib.integrity);
    if (!window.jspdf || !window.jspdf.jsPDF) {
        throw new Error('La librería jsPDF no está disponible.');
    }
    return window.jspdf.jsPDF;
}
