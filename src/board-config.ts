import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface BoardConfig {
	calendarURL: string;
	latitude: number;
	longitude: number;
	temperatureUnit: 'fahrenheit' | 'celsius';
	port: number;
}

const CONFIG_PATH = join(import.meta.dirname, '..', 'board.config.json');
const TEMPERATURE_UNITS = ['fahrenheit', 'celsius'];

function configError(problem: string) {
	return new Error(`board.config.json: ${problem}`);
}

function calendarURLSetting(value: unknown) {
	if (typeof value !== 'string' || !URL.canParse(value)) {
		throw configError('calendarURL must be the secret iCal address from Google Calendar settings');
	}
	return value;
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
		calendarURL: calendarURLSetting(record.calendarURL),
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
