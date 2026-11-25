function toMinutes(timeStr) {
  const [h, m] = timeStr.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

function toTimeStr(totalMinutes) {
  const h = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const m = String(totalMinutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

export function getAvailableSlots({
  dateStr,
  durationMinutes,
  appointments = [],
  blockedSlots = [],
  openTime = '09:00',
  closeTime = '21:00',
  isClosed = false,
  stepMinutes = 15,
}) {
  if (!dateStr || !durationMinutes || isClosed || !openTime || !closeTime) return [];

  const openMin = toMinutes(openTime);
  const closeMin = toMinutes(closeTime);
  if (closeMin <= openMin) return [];

  const busyRanges = [
    ...appointments
      .filter((a) => a.status !== 'cancelled')
      .map((a) => ({
        start: toMinutes(a.start_time),
        end: toMinutes(a.end_time),
      })),
    ...blockedSlots.map((b) => ({
      start: toMinutes(b.start_time),
      end: toMinutes(b.end_time),
    })),
  ];

  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;
  const currentMin = now.getHours() * 60 + now.getMinutes();

  const slots = [];

  for (let start = openMin; start + durationMinutes <= closeMin; start += stepMinutes) {
    const end = start + durationMinutes;

    if (dateStr === todayStr && start <= currentMin) {
      continue;
    }

    const overlaps = busyRanges.some((range) => start < range.end && end > range.start);
    if (!overlaps) {
      slots.push({
        start_time: toTimeStr(start),
        end_time: toTimeStr(end),
      });
    }
  }

  return slots;
}