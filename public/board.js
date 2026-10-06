import { getCalendarStaleNote } from './calendar-stale-note.js';
import { getInkMasks } from './riso-photo.js';
import { getSpanLanes } from './span-lanes.js';
import { getTheme } from './theme.js';

const BOARD_REFRESH_MS = 5 * 60 * 1000;
const STALE_AFTER_MS = 60 * 60 * 1000;

const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
const fullDateFormat = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const shortWeekdayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
const shortDateFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const monthDayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const DAYS_IN_A_WEEK = 7;
const HOUR_MS = 60 * 60 * 1000;
const PHOTO_SAMPLE_SCALE = 2;
const PHOTO_FOCUS_Y = 0.35;

let board = null;
let photo = { hourKey: null, image: null, renderedKey: null };

function findElement(selector) {
	return document.querySelector(selector);
}

function createElement({ tag, className, text }) {
	const element = document.createElement(tag);
	element.className = className;
	if (text !== undefined) {
		element.textContent = text;
	}
	return element;
}

function parseLocalDate(date) {
	const [year, month, day] = date.split('-').map(Number);
	return new Date(year, month - 1, day);
}

function formatTime(date) {
	return timeFormat.format(date).replace(' AM', ' am').replace(' PM', ' pm');
}

function getDayHeading({ date, now }) {
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const daysAway = Math.round((parseLocalDate(date) - today) / 86400000);
	if (daysAway === 0) {
		return 'Today';
	}
	if (daysAway === 1) {
		return 'Tomorrow';
	}
	if (daysAway >= DAYS_IN_A_WEEK) {
		return shortDateFormat.format(parseLocalDate(date));
	}
	return `${shortWeekdayFormat.format(parseLocalDate(date))} ${parseLocalDate(date).getDate()}`;
}

function getFirstDay(event) {
	const start = event.isAllDay ? parseLocalDate(event.startsAt) : new Date(event.startsAt);
	return new Date(start.getFullYear(), start.getMonth(), start.getDate());
}

function getLastDay(event) {
	const lastMoment = event.isAllDay ? new Date(parseLocalDate(event.endsAt).getTime() - 1) : new Date(new Date(event.endsAt).getTime() - 1);
	return new Date(lastMoment.getFullYear(), lastMoment.getMonth(), lastMoment.getDate());
}

function isMultiDay(event) {
	return getLastDay(event) > getFirstDay(event);
}

function getSpanLabel({ event, date }) {
	const firstDay = getFirstDay(event);
	const lastDay = getLastDay(event);
	if (firstDay < parseLocalDate(date)) {
		return `until ${monthDayFormat.format(lastDay)}`;
	}
	const isSameMonth = firstDay.getMonth() === lastDay.getMonth();
	return `${monthDayFormat.format(firstDay)} – ${isSameMonth ? lastDay.getDate() : monthDayFormat.format(lastDay)}`;
}

function formatLocalDate(date) {
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${date.getFullYear()}-${month}-${day}`;
}

function getEventTime({ event, date }) {
	if (isMultiDay(event)) {
		return getSpanLabel({ event, date });
	}
	if (event.isAllDay) {
		return 'all day';
	}
	const startsAt = new Date(event.startsAt);
	if (startsAt < parseLocalDate(date)) {
		return `until ${formatTime(new Date(event.endsAt))}`;
	}
	return formatTime(startsAt);
}

function setIcon({ element, iconName }) {
	element.hidden = !iconName;
	element.style.setProperty('--icon', iconName ? `url(icons/${iconName}.svg)` : 'none');
}

function renderClock(now) {
	const [time, meridiem] = formatTime(now).split(' ');
	const clockTime = findElement('.board-clock-time');
	clockTime.textContent = time;
	clockTime.dataset.time = time;
	findElement('.board-clock-meridiem').textContent = meridiem;
	findElement('.board-date').textContent = fullDateFormat.format(now);
}

function renderStaleNote({ element, updatedAt, now }) {
	const isStale = !!updatedAt && now - new Date(updatedAt) > STALE_AFTER_MS;
	element.hidden = !isStale;
	element.textContent = isStale ? `updated ${formatTime(new Date(updatedAt))}` : '';
}

function renderCalendarStaleNote({ calendars, now }) {
	const element = findElement('.calendar-stale');
	const note = getCalendarStaleNote({ calendars, now, staleAfterMs: STALE_AFTER_MS, formatTime });
	element.hidden = !note;
	element.textContent = note;
}

function createForecastCondition({ label, iconName }) {
	if (!iconName) {
		return createElement({ tag: 'span', className: 'weather-forecast-label', text: label });
	}
	const icon = createElement({ tag: 'span', className: 'weather-forecast-icon' });
	setIcon({ element: icon, iconName });
	return icon;
}

function createForecastDay(forecastDay) {
	const item = createElement({ tag: 'li', className: 'weather-forecast-day' });
	item.append(
		createElement({ tag: 'span', className: 'weather-forecast-weekday', text: shortWeekdayFormat.format(parseLocalDate(forecastDay.date)) }),
		createForecastCondition(forecastDay),
		createElement({ tag: 'span', className: 'weather-forecast-high', text: `${forecastDay.high}°` })
	);
	return item;
}

function renderAirQuality(airQuality) {
	const element = findElement('.weather-air-quality');
	element.hidden = !airQuality;
	element.textContent = airQuality ? `AQI ${airQuality.index} · ${airQuality.category}` : '';
	element.classList.toggle('is-unhealthy', !!airQuality?.isUnhealthy);
}

function renderWeather(weather) {
	findElement('.board-now').classList.toggle('is-weather-unavailable', !weather);
	if (!weather) {
		findElement('.weather-label').textContent = 'Weather unavailable';
		return;
	}
	setIcon({ element: findElement('.weather-icon'), iconName: weather.current.iconName });
	findElement('.weather-temperature').textContent = `${weather.current.temperature}°`;
	findElement('.weather-label').textContent = weather.current.label;
	findElement('.weather-range').textContent = `H ${weather.today.high}° · L ${weather.today.low}°`;
	findElement('.weather-forecast').replaceChildren(...weather.forecast.map(createForecastDay));
	renderAirQuality(weather.airQuality);
}

function createEventRow({ event, date }) {
	const rowClassName = isMultiDay(event) ? 'calendar-event calendar-event-span' : event.isAllDay ? 'calendar-event calendar-event-all-day' : 'calendar-event';
	const row = createElement({ tag: 'li', className: rowClassName });
	if (isMultiDay(event)) {
		row.dataset.lastDay = formatLocalDate(getLastDay(event));
	}
	row.append(
		createElement({ tag: 'span', className: 'calendar-event-time', text: getEventTime({ event, date }) }),
		createElement({ tag: 'span', className: 'calendar-event-title', text: event.title })
	);
	return row;
}

function createEndingRow(event) {
	const row = createElement({ tag: 'li', className: 'calendar-event calendar-event-ending' });
	row.append(
		createElement({ tag: 'span', className: 'calendar-event-time', text: 'last day' }),
		createElement({ tag: 'span', className: 'calendar-event-title', text: event.title })
	);
	return row;
}

function createDayGroup({ day, now }) {
	const heading = getDayHeading({ date: day.date, now });
	const group = createElement({ tag: 'li', className: heading === 'Today' ? 'calendar-day calendar-day-today' : 'calendar-day' });
	group.dataset.date = day.date;
	const events = createElement({ tag: 'ol', className: 'calendar-events' });
	const endingEvents = day.events.length === 0 ? (day.endingEvents ?? []) : [];
	events.append(...day.events.map((event) => createEventRow({ event, date: day.date })), ...endingEvents.map(createEndingRow));
	group.append(createElement({ tag: 'h2', className: 'calendar-day-heading', text: heading }), events);
	return group;
}

function trimOverflowingDays(calendar) {
	while (calendar.children.length > 1 && calendar.scrollHeight > calendar.clientHeight) {
		calendar.lastElementChild.remove();
	}
}

function assignSpanLanes(calendar) {
	const rows = [...calendar.querySelectorAll('.calendar-event-span')];
	const lanes = getSpanLanes(rows.map((row) => ({ firstDay: row.closest('.calendar-day').dataset.date, lastDay: row.dataset.lastDay })));
	rows.forEach((row, index) => row.style.setProperty('--lane', String(lanes[index])));
	calendar.style.setProperty('--span-lane-count', String(lanes.length === 0 ? 0 : Math.max(...lanes) + 1));
}

function createSpanStripe({ row, groups, overlayTop }) {
	const firstDay = row.closest('.calendar-day').dataset.date;
	const lastDay = row.dataset.lastDay;
	const coveredGroups = groups.filter((group) => group.dataset.date >= firstDay && group.dataset.date <= lastDay);
	const isContinuing = lastDay > groups.at(-1).dataset.date;
	const top = row.getBoundingClientRect().top - overlayTop;
	const bottom = coveredGroups.at(-1).getBoundingClientRect().bottom - overlayTop;
	const stripe = createElement({ tag: 'span', className: isContinuing ? 'calendar-span-stripe is-continuing' : 'calendar-span-stripe' });
	stripe.style.setProperty('--lane', row.style.getPropertyValue('--lane'));
	stripe.style.top = `${top}px`;
	stripe.style.height = isContinuing ? `calc(100% - ${top}px)` : `${bottom - top}px`;
	return stripe;
}

function drawSpanStripes(calendar) {
	const overlay = findElement('.calendar-spans');
	const groups = [...calendar.querySelectorAll('.calendar-day')];
	const rows = [...calendar.querySelectorAll('.calendar-event-span')];
	const overlayTop = overlay.getBoundingClientRect().top;
	overlay.replaceChildren(...rows.map((row) => createSpanStripe({ row, groups, overlayTop })));
}

function renderCalendar({ days, calendars, now }) {
	const calendar = findElement('.calendar');
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const upcomingDays = days.filter((day) => parseLocalDate(day.date) >= today);
	if (upcomingDays.length === 0) {
		const hasLoadedCalendar = calendars.some((calendar) => calendar.updatedAt !== null);
		const message = hasLoadedCalendar ? 'Nothing on the calendar this month' : 'Calendar unavailable';
		calendar.replaceChildren(createElement({ tag: 'li', className: 'calendar-empty', text: message }));
		findElement('.calendar-spans').replaceChildren();
		return;
	}
	calendar.replaceChildren(...upcomingDays.map((day) => createDayGroup({ day, now })));
	assignSpanLanes(calendar);
	trimOverflowingDays(calendar);
	drawSpanStripes(calendar);
}

async function loadPhoto(hourKey) {
	const image = new Image();
	image.src = `photo.jpg?hour=${hourKey}`;
	const isLoaded = await image.decode().then(() => true, () => false);
	photo = { hourKey, image: isLoaded ? image : null, renderedKey: null };
}

function drawCroppedPhoto({ image, width, height }) {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
	const sourceWidth = width / scale;
	const sourceHeight = height / scale;
	const sourceX = (image.naturalWidth - sourceWidth) / 2;
	const sourceY = (image.naturalHeight - sourceHeight) * PHOTO_FOCUS_Y;
	const context = canvas.getContext('2d', { willReadFrequently: true });
	context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
	return context.getImageData(0, 0, width, height).data;
}

function createMaskURL({ mask, width, height }) {
	const canvas = document.createElement('canvas');
	canvas.width = width * PHOTO_SAMPLE_SCALE;
	canvas.height = height * PHOTO_SAMPLE_SCALE;
	const context = canvas.getContext('2d');
	context.putImageData(new ImageData(mask, width, height), 0, 0);
	context.globalCompositeOperation = 'copy';
	context.drawImage(canvas, 0, 0, width, height, 0, 0, canvas.width, canvas.height);
	return `url(${canvas.toDataURL('image/png')})`;
}

function renderPhoto(theme) {
	const photoElement = findElement('.board-photo');
	photoElement.hidden = !photo.image;
	if (!photo.image) {
		return;
	}
	const width = Math.ceil(photoElement.clientWidth / PHOTO_SAMPLE_SCALE);
	const height = Math.ceil(photoElement.clientHeight / PHOTO_SAMPLE_SCALE);
	const renderKey = `${photo.hourKey}|${theme}|${width}x${height}`;
	if (photo.renderedKey === renderKey || width === 0 || height === 0) {
		return;
	}
	const pixels = drawCroppedPhoto({ image: photo.image, width, height });
	const primaryLayer = findElement('.board-photo-primary');
	const accentLayer = findElement('.board-photo-accent');
	const { primaryMask, accentMask } = getInkMasks({ pixels, width, height, isDarkPaper: theme === 'night' });
	primaryLayer.style.setProperty('--photo-mask', createMaskURL({ mask: primaryMask, width, height }));
	accentLayer.style.setProperty('--photo-mask', createMaskURL({ mask: accentMask, width, height }));
	photo.renderedKey = renderKey;
}

async function renderPhotoForHour({ now, theme }) {
	const hourKey = String(Math.floor(now.getTime() / HOUR_MS));
	if (photo.hourKey !== hourKey) {
		await loadPhoto(hourKey);
	}
	renderPhoto(theme);
}

function render() {
	const now = new Date();
	const theme = getTheme({ now, sunrise: board?.weather?.sunrise, sunset: board?.weather?.sunset });
	document.documentElement.dataset.theme = theme;
	renderClock(now);
	renderPhotoForHour({ now, theme });
	if (!board) {
		return;
	}
	renderWeather(board.weather);
	renderCalendar({ days: board.days, calendars: board.calendars, now });
	renderStaleNote({ element: findElement('.weather-stale'), updatedAt: board.weatherUpdatedAt, now });
	renderCalendarStaleNote({ calendars: board.calendars, now });
}

async function loadBoard() {
	const response = await fetch('board.json', { cache: 'no-store' }).catch(() => null);
	if (!response?.ok) {
		return;
	}
	board = await response.json();
	render();
}

function tickEachMinute() {
	render();
	const now = new Date();
	const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
	setTimeout(tickEachMinute, msUntilNextMinute + 50);
}

tickEachMinute();
loadBoard();
document.fonts.ready.then(render);
setInterval(loadBoard, BOARD_REFRESH_MS);
