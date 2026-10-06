import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { getUpcomingDays, type BoardDay } from './calendar.ts';

function readFixture(name: string) {
	return readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8');
}

function getTitlesByDate(days: BoardDay[]) {
	return Object.fromEntries(days.map((day) => [day.date, day.events.map((event) => event.title)]));
}

const FRIDAY_NOON = new Date('2026-10-02T12:00:00-04:00');
const familyWeek = getUpcomingDays({ icsTexts: [readFixture('family.ics')], now: FRIDAY_NOON, dayCount: 7 });
const familyTitles = getTitlesByDate(familyWeek);

describe('getUpcomingDays', () => {
	it('lists each day that has events, in order, within the window', () => {
		assert.deepEqual(Object.keys(familyTitles), ['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-08']);
	});

	it('skips a cancelled occurrence and shows a moved one at its new time', () => {
		assert.equal(familyTitles['2026-10-05'], undefined);
		const bookClubTitles = familyWeek.flatMap((day) => day.events).map((event) => event.title).filter((title) => title.startsWith('Book club'));
		assert.deepEqual(bookClubTitles, ['Book club (moved)']);
	});

	it('keeps a daily event at the same local hour across the end of daylight saving', () => {
		const days = getUpcomingDays({ icsTexts: [readFixture('daily-walk.ics')], now: new Date('2026-10-30T06:00:00-04:00'), dayCount: 5 });
		assert.deepEqual(
			days.map((day) => new Date(day.events[0].startsAt).getHours()),
			[9, 9, 9, 9, 9]
		);
	});

	it('merges events from every calendar into one ordered day list', () => {
		const days = getUpcomingDays({ icsTexts: [readFixture('family.ics'), readFixture('school.ics')], now: FRIDAY_NOON, dayCount: 7 });
		assert.deepEqual(getTitlesByDate(days)['2026-10-03'], ['Car wash', 'Piano lesson', 'Call with Sam']);
	});

	it('says the link may have been reset when a calendar answers with a web page', () => {
		assert.throws(
			() => getUpcomingDays({ icsTexts: ['<!doctype html><html><body>Sign in</body></html>'], now: FRIDAY_NOON, dayCount: 7 }),
			/the link may have been reset/
		);
	});
});
