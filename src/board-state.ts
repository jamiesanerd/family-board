import { getUpcomingDays } from './calendar.ts';
import { type BoardWeather } from './weather.ts';

const UPCOMING_DAY_COUNT = 30;

interface RefreshSources {
	loadCalendar: (name: string) => Promise<string>;
	loadWeather: () => Promise<BoardWeather>;
	now: Date;
}

interface CalendarCopy {
	text: string | null;
	updatedAt: string | null;
}

function getErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

export function createBoardState(calendarNames: string[]) {
	const calendarCopies = new Map<string, CalendarCopy>(calendarNames.map((name) => [name, { text: null, updatedAt: null }]));
	let weather: BoardWeather | null = null;
	let weatherUpdatedAt: string | null = null;

	async function refreshCalendar({ name, loadCalendar, now }: { name: string; loadCalendar: RefreshSources['loadCalendar']; now: Date }) {
		const text = await loadCalendar(name);
		getUpcomingDays({ icsTexts: [text], now, dayCount: UPCOMING_DAY_COUNT });
		calendarCopies.set(name, { text, updatedAt: now.toISOString() });
	}

	async function refreshWeather({ loadWeather, now }: Pick<RefreshSources, 'loadWeather' | 'now'>) {
		weather = await loadWeather();
		weatherUpdatedAt = now.toISOString();
	}

	async function refresh({ loadCalendar, loadWeather, now }: RefreshSources) {
		const [weatherResult, ...calendarResults] = await Promise.allSettled([
			refreshWeather({ loadWeather, now }),
			...calendarNames.map((name) => refreshCalendar({ name, loadCalendar, now }))
		]);
		const problems = calendarResults.flatMap((result, index) => {
			return result.status === 'rejected' ? [`calendar "${calendarNames[index]}": ${getErrorMessage(result.reason)}`] : [];
		});
		if (weatherResult.status === 'rejected') {
			problems.push(`weather: ${getErrorMessage(weatherResult.reason)}`);
		}
		return problems;
	}

	function snapshot(now: Date) {
		const icsTexts = [...calendarCopies.values()].flatMap((copy) => (copy.text === null ? [] : [copy.text]));
		const days = getUpcomingDays({ icsTexts, now, dayCount: UPCOMING_DAY_COUNT });
		const calendars = calendarNames.map((name) => ({ name, updatedAt: calendarCopies.get(name)?.updatedAt ?? null }));
		return { days, weather, weatherUpdatedAt, calendars };
	}

	return { refresh, snapshot };
}
