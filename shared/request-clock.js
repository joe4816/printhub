// A request's At Time is a wall-clock time, not its issue date.
export function requestClockTime(value) {
  if (value === '' || value === null || value === undefined) return '';
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 1) {
    return clock(Math.round(value * 1440) % 1440);
  }
  const text = String(value).trim();
  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (match) {
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    if (minute > 59 || hour > (match[3] ? 12 : 23) || (match[3] && hour < 1)) return text;
    if (match[3]) hour = hour % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
    return clock(hour * 60 + minute);
  }
  const date = value instanceof Date ? value : /^\d{4}-\d{2}-\d{2}T/.test(text) ? new Date(text) : null;
  if (!date || Number.isNaN(date.getTime())) return text;
  // Sheets encodes time-only cells against Dec 30, 1899 in standard time.
  // Use a modern standard-time date to avoid historical local-mean-time offsets.
  const instant = date.getUTCFullYear() < 1901
    ? new Date(Date.UTC(2000, 11, 30, date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()))
    : date;
  return new Intl.DateTimeFormat('en-US', {timeZone:'America/Los_Angeles', hour:'numeric', minute:'2-digit'}).format(instant);
}

function clock(minutes) {
  const hour = Math.floor(minutes / 60);
  return (hour % 12 || 12) + ':' + String(minutes % 60).padStart(2, '0') + (hour >= 12 ? ' PM' : ' AM');
}
