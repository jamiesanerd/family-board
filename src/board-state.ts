import { getUpcomingDays } from './calendar.ts';
import { type BoardWeather } from './weather.ts';

const UPCOMING_DAY_COUNT = 30;

interface RefreshSources {
	loadCalendar: () => Promise<string>;
	loadWeather: () => Promise<BoardWeather>;
	now: Date;
}

function getErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

export function createBoardState() {
	let calendarText: string | null = null;
	let calendarUpdatedAt: string | null = null;
	let weather: BoardWeather | null = null;
	let weatherUpdatedAt: string | null = null;

	async function refreshCalendar({ loadCalendar, now }: Pick<RefreshSources, 'loadCalendar' | 'now'>) {
		const text = await loadCalendar();
		getUpcomingDays({ icsText: text, now, dayCount: UPCOMING_DAY_COUNT });
		calendarText = text;
		calendarUpdatedAt = now.toISOString();
	}

	async function refreshWeather({ loadWeather, now }: Pick<RefreshSources, 'loadWeather' | 'now'>) {
		weather = await loadWeather();
		weatherUpdatedAt = now.toISOString();
	}

	async function refresh({ loadCalendar, loadWeather, now }: RefreshSources) {
		const [calendarResult, weatherResult] = await Promise.allSettled([
			refreshCalendar({ loadCalendar, now }),
			refreshWeather({ loadWeather, now })
		]);
		const problems: string[] = [];
		if (calendarResult.status === 'rejected') {
			problems.push(`calendar: ${getErrorMessage(calendarResult.reason)}`);
		}
		if (weatherResult.status === 'rejected') {
			problems.push(`weather: ${getErrorMessage(weatherResult.reason)}`);
		}
		return problems;
	}

	function snapshot(now: Date) {
		const days = calendarText ? getUpcomingDays({ icsText: calendarText, now, dayCount: UPCOMING_DAY_COUNT }) : [];
		return { days, weather, calendarUpdatedAt, weatherUpdatedAt };
	}

	return { refresh, snapshot };
}
