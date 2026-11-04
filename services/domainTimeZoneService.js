const DEFAULT_TIME_ZONE = 'America/Lima';

function isValidTimeZone(value) {
    if (typeof value !== 'string' || !value.trim()) return false;
    try { new Intl.DateTimeFormat('en-US', { timeZone: value }).format(); return true; }
    catch { return false; }
}

async function getDomainTimeZone(domain) {
    const defaultUrl = process.env.NODE_ENV === 'production'
        ? 'https://api-configuration.creceidea.pe/api'
        : 'http://127.0.0.1:7000/api';
    const baseUrl = (process.env.CONFIGURATION_API_URL || defaultUrl).replace(/\/$/, '');
    try {
        const response = await fetch(`${baseUrl}/configurations/time-zone`, { headers: { domain } });
        const body = await response.json();
        const timeZone = response.ok && body?.status === true && isValidTimeZone(body.data?.timeZone)
            ? body.data.timeZone
            : DEFAULT_TIME_ZONE;
        return timeZone;
    } catch {
        return DEFAULT_TIME_ZONE;
    }
}

function dateKeyToInstant(dateKey, timeZone) {
    if (typeof dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        throw new Error('La fecha debe tener el formato YYYY-MM-DD.');
    }
    const [year, month, day] = dateKey.split('-').map(Number);
    const checkedDate = new Date(Date.UTC(year, month - 1, day));
    if (checkedDate.getUTCFullYear() !== year || checkedDate.getUTCMonth() !== month - 1 || checkedDate.getUTCDate() !== day) {
        throw new Error('La fecha no es válida.');
    }
    const wallClock = Date.UTC(year, month - 1, day);
    const offsetAt = (instant) => {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
        }).formatToParts(new Date(instant));
        const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
        return Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second)) - instant;
    };
    const firstGuess = wallClock - offsetAt(wallClock);
    const result = new Date(wallClock - offsetAt(firstGuess));
    if (Number.isNaN(result.valueOf())) throw new Error('La fecha no es válida.');
    return result;
}

function nextDateKey(dateKey) {
    const date = new Date(`${dateKey}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
}

function rangeDate(value, timeZone, endOfDay = false) {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
        const start = dateKeyToInstant(String(value), timeZone);
        return endOfDay ? new Date(dateKeyToInstant(nextDateKey(String(value)), timeZone).getTime() - 1) : start;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.valueOf())) throw new Error('El rango de fechas no es válido.');
    return parsed;
}

function getDateKeyInTimeZone(date, timeZone) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${values.year}-${values.month}-${values.day}`;
}

module.exports = { DEFAULT_TIME_ZONE, dateKeyToInstant, getDateKeyInTimeZone, getDomainTimeZone, isValidTimeZone, rangeDate };
