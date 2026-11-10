// Funções puras (sem gi://), testáveis fora do GNOME Shell.

// minúsculas e sem acentos, para a busca ("coração" acha "coracao")
export const norm = s => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function timeAgo(ts, now = Date.now()) {
    const s = Math.max(0, Math.floor((now - ts) / 1000));
    if (s < 45)
        return 'agora';
    const m = Math.round(s / 60);
    if (m < 60)
        return `há ${m} min`;
    const h = Math.round(m / 60);
    if (h < 24)
        return `há ${h} h`;
    const d = Math.round(h / 24);
    return d === 1 ? 'ontem' : `há ${d} dias`;
}
