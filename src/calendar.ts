import ICAL from 'ical.js';

export interface BoardEvent {
	title: string;
	startsAt: string;
	endsAt: string;
	isAllDay: boolean;
}

export interface BoardDay {
	date: string;
	events: BoardEvent[];
	endingEvents: BoardEvent[];
}

interface Occurrence {
	title: string;
	start: ICAL.Time;
	end: ICAL.Time;
}

const MAX_OCCURRENCES_SCANNED = 20000;

function registerTimezones(calendar: ICAL.Component) {
	for (const timezone of calendar.getAllSubcomponents('vtimezone')) {
		ICAL.TimezoneService.register(timezone);
	}
}

function getEvents(calendar: ICAL.Component) {
	const vevents = calendar.getAllSubcomponents('vevent');
	const masterEvents = new Map<string, ICAL.Event>();
	const exceptionEvents: ICAL.Event[] = [];
	for (const vevent of vevents) {
		const event = new ICAL.Event(vevent);
		if (event.isRecurrenceException()) {
			exceptionEvents.push(event);
		} else {
			masterEvents.set(event.uid, event);
		}
	}
	const orphanExceptions = exceptionEvents.filter((exception) => {
		const master = masterEvents.get(exception.uid);
		if (!master?.isRecurring()) {
			return true;
		}
		master.relateException(exception);
		return false;
	});
	return [...masterEvents.values(), ...orphanExceptions];
}

function getOccurrences({ event, windowEnd }: { event: ICAL.Event; windowEnd: Date }) {
	if (!event.isRecurring()) {
		return [{ title: event.summary, start: event.startDate, end: event.endDate }];
	}
	const occurrences: Occurrence[] = [];
	const iterator = event.iterator();
	for (let scanned = 0; scanned < MAX_OCCURRENCES_SCANNED; scanned++) {
		const next = iterator.next();
		if (!next || next.toJSDate() >= windowEnd) {
			break;
		}
		const details = event.getOccurrenceDetails(next);
		occurrences.push({ title: details.item.summary, start: details.startDate, end: details.endDate });
	}
	return occurrences;
}

function getAllDayEnd({ start, end }: { start: ICAL.Time; end: ICAL.Time }) {
	if (end.compare(start) > 0) {
		return end;
	}
	const nextDay = start.clone();
	nextDay.adjust(1, 0, 0, 0);
	return nextDay;
}

function toBoardEvent({ title, start, end }: Occurrence) {
	if (start.isDate) {
		return { title: title ?? '', startsAt: start.toString(), endsAt: getAllDayEnd({ start, end }).toString(), isAllDay: true };
	}
	return { title: title ?? '', startsAt: start.toJSDate().toISOString(), endsAt: end.toJSDate().toISOString(), isAllDay: false };
}

function getLocalDate(event: { isAllDay: boolean; at: string }) {
	if (event.isAllDay) {
		const [year, month, day] = event.at.split('-').map(Number);
		return new Date(year, month - 1, day);
	}
	return new Date(event.at);
}

function getEventStart(event: BoardEvent) {
	return getLocalDate({ isAllDay: event.isAllDay, at: event.startsAt });
}

function getEventEnd(event: BoardEvent) {
	return getLocalDate({ isAllDay: event.isAllDay, at: event.endsAt });
}

function getLastDayKey(event: BoardEvent) {
	return formatLocalDate(new Date(getEventEnd(event).getTime() - 1));
}

function isMultiDay(event: BoardEvent) {
	return getLastDayKey(event) > formatLocalDate(getEventStart(event));
}

function formatLocalDate(date: Date) {
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${date.getFullYear()}-${month}-${day}`;
}

function compareEvents(first: BoardEvent, second: BoardEvent) {
	if (first.isAllDay !== second.isAllDay) {
		return first.isAllDay ? -1 : 1;
	}
	const byStart = getEventStart(first).getTime() - getEventStart(second).getTime();
	return byStart || first.title.localeCompare(second.title);
}

export function getUpcomingDays({ icsText, now, dayCount }: { icsText: string; now: Date; dayCount: number }) {
	const calendar = new ICAL.Component(ICAL.parse(icsText));
	registerTimezones(calendar);
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const windowEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + dayCount);
	const events = getEvents(calendar)
		.flatMap((event) => getOccurrences({ event, windowEnd }))
		.map(toBoardEvent)
		.filter((event) => event.isAllDay || new Date(event.endsAt) > now);
	const listedEvents = new Set<BoardEvent>();
	const days: BoardDay[] = [];
	for (let offset = 0; offset < dayCount; offset++) {
		const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
		const dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset + 1);
		const date = formatLocalDate(dayStart);
		const endingEvents = [...listedEvents].filter((event) => isMultiDay(event) && getLastDayKey(event) === date);
		const dayEvents = events.filter((event) => {
			return !listedEvents.has(event) && getEventStart(event) < dayEnd && getEventEnd(event) > dayStart;
		});
		for (const event of dayEvents) {
			listedEvents.add(event);
		}
		if (dayEvents.length > 0 || endingEvents.length > 0) {
			days.push({ date, events: dayEvents.sort(compareEvents), endingEvents: endingEvents.sort(compareEvents) });
		}
	}
	return days;
}

export async function fetchCalendarText(calendarURL: string) {
	const response = await fetch(calendarURL, { signal: AbortSignal.timeout(20000) });
	if (!response.ok) {
		throw new Error(`calendar answered ${response.status}`);
	}
	return response.text();
}
