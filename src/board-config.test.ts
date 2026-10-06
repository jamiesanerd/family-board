import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseBoardConfig } from './board-config.ts';

const VALID_SETTINGS = {
	calendars: [{ name: 'Family', url: 'https://calendar.google.com/calendar/ical/family/private-abc/basic.ics' }],
	latitude: 40.7,
	longitude: -74,
	temperatureUnit: 'fahrenheit',
	port: 9000
};

describe('parseBoardConfig', () => {
	it('reads a complete config', () => {
		assert.deepEqual(parseBoardConfig(VALID_SETTINGS), VALID_SETTINGS);
	});

	it('reads a webcal link as https', () => {
		const config = parseBoardConfig({ ...VALID_SETTINGS, calendars: [{ name: 'Sam', url: 'webcal://p01-caldav.icloud.com/published/2/abc' }] });
		assert.equal(config.calendars[0].url, 'https://p01-caldav.icloud.com/published/2/abc');
	});

	it('names the calendar whose url is not a link', () => {
		const calendars = [...VALID_SETTINGS.calendars, { name: 'Sam', url: 'not a link' }];
		assert.throws(() => parseBoardConfig({ ...VALID_SETTINGS, calendars }), /calendars\[1\] \("Sam"\): url/);
	});
});
