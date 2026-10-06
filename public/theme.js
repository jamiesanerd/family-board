function getMinutesIntoDay(date) {
	return date.getHours() * 60 + date.getMinutes();
}

export function getTheme({ now, sunrise, sunset }) {
	if (!sunrise || !sunset) {
		return 'day';
	}
	const minutesNow = getMinutesIntoDay(now);
	const isDaylight = minutesNow >= getMinutesIntoDay(new Date(sunrise)) && minutesNow < getMinutesIntoDay(new Date(sunset));
	return isDaylight ? 'day' : 'night';
}
