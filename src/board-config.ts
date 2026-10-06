import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface CalendarConfig {
	name: string;
	url: string;
}

export interface BoardConfig {
	calendars: CalendarConfig[];
	latitude: number;
	longitude: number;
	temperatureUnit: 'fahrenheit' | 'celsius';
	port: number;
}

const CONFIG_PATH = join(import.meta.dirname, '..', 'board.config.json');
const TEMPERATURE_UNITS = ['fahrenheit', 'celsius'];
const CALENDARS_EXAMPLE = '[{ "name": "Family", "url": "https://…/basic.ics" }]';
const CALENDAR_PROTOCOLS = ['http:', 'https:'];

function configError(problem: string) {
	return new Error(`board.config.json: ${problem}`);
}

function getCalendarLabel({ entry, index }: { entry: unknown; index: number }) {
	const name = typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>).name : undefined;
	return typeof name === 'string' && name.trim() ? `calendars[${index}] (${JSON.stringify(name)})` : `calendars[${index}]`;
}

function calendarURLSetting({ value, label }: { value: unknown; label: string }) {
	const url = typeof value === 'string' ? value.replace(/^webcal:\/\//i, 'https://') : '';
	if (!URL.canParse(url) || !CALENDAR_PROTOCOLS.includes(new URL(url).protocol)) {
		throw configError(`${label}: url must be an iCal link, the secret iCal address from the calendar's settings`);
	}
	return url;
}

function calendarSetting({ entry, index }: { entry: unknown; index: number }) {
	const label = getCalendarLabel({ entry, index });
	if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
		throw configError(`${label} must be an object with a name and a url`);
	}
	const { name, url } = entry as Record<string, unknown>;
	if (typeof name !== 'string' || !name.trim()) {
		throw configError(`${label}: name must be some text, like "Family"`);
	}
	return { name, url: calendarURLSetting({ value: url, label }) };
}

function calendarsSetting(value: unknown) {
	if (!Array.isArray(value) || value.length === 0) {
		throw configError(`calendars must be a list with at least one calendar, like ${CALENDARS_EXAMPLE}`);
	}
	const calendars = value.map((entry, index) => calendarSetting({ entry, index }));
	const names = calendars.map((calendar) => calendar.name);
	const repeatedName = names.find((name, index) => names.indexOf(name) !== index);
	if (repeatedName !== undefined) {
		throw configError(`calendars: the name ${JSON.stringify(repeatedName)} is used twice, each calendar needs its own`);
	}
	return calendars;
}

function coordinateSetting({ settings, key, limit }: { settings: Record<string, unknown>; key: string; limit: number }) {
	const value = settings[key];
	if (typeof value !== 'number' || Math.abs(value) > limit) {
		throw configError(`${key} must be a number, like ${key === 'latitude' ? '40.71' : '-74.01'}`);
	}
	return value;
}

function temperatureUnitSetting(value: unknown) {
	if (value === undefined) {
		return 'fahrenheit';
	}
	if (typeof value !== 'string' || !TEMPERATURE_UNITS.includes(value)) {
		throw configError('temperatureUnit must be "fahrenheit" or "celsius"');
	}
	return value as BoardConfig['temperatureUnit'];
}

function portSetting(value: unknown) {
	if (value === undefined) {
		return 8788;
	}
	if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 65535) {
		throw configError('port must be a number, like 8788');
	}
	return value;
}

export function parseBoardConfig(settings: unknown): BoardConfig {
	if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
		throw configError('should hold one object of settings');
	}
	const record = settings as Record<string, unknown>;
	return {
		calendars: calendarsSetting(record.calendars),
		latitude: coordinateSetting({ settings: record, key: 'latitude', limit: 90 }),
		longitude: coordinateSetting({ settings: record, key: 'longitude', limit: 180 }),
		temperatureUnit: temperatureUnitSetting(record.temperatureUnit),
		port: portSetting(record.port)
	};
}

export function readBoardConfig(path = CONFIG_PATH) {
	const raw = readFileSync(path, 'utf8');
	try {
		return parseBoardConfig(JSON.parse(raw));
	} catch (error) {
		if (error instanceof SyntaxError) {
			throw configError(`isn't valid JSON (${error.message})`);
		}
		throw error;
	}
}
