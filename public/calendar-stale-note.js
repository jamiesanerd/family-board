function isBehind({ calendar, now, staleAfterMs }) {
	return calendar.updatedAt === null || now - new Date(calendar.updatedAt) > staleAfterMs;
}

function describeCalendar({ calendar, formatTime }) {
	return calendar.updatedAt === null ? `${calendar.name} not loaded` : `${calendar.name} updated ${formatTime(new Date(calendar.updatedAt))}`;
}

export function getCalendarStaleNote({ calendars, now, staleAfterMs, formatTime }) {
	const hasLoadedCalendar = calendars.some((calendar) => calendar.updatedAt !== null);
	if (!hasLoadedCalendar) {
		return '';
	}
	const calendarsBehind = calendars.filter((calendar) => isBehind({ calendar, now, staleAfterMs }));
	if (calendars.length === 1) {
		return calendarsBehind.length === 1 ? `updated ${formatTime(new Date(calendars[0].updatedAt))}` : '';
	}
	return calendarsBehind.map((calendar) => describeCalendar({ calendar, formatTime })).join(' · ');
}
