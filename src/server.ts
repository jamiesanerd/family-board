import { readFileSync } from 'node:fs';
import { createServer, type ServerResponse } from 'node:http';
import { extname, join } from 'node:path';
import { readBoardConfig } from './board-config.ts';
import { createBoardState } from './board-state.ts';
import { listPhotos, pickPhotoForHour } from './photo-library.ts';
import { CONTENT_TYPES, findPublicFile } from './public-files.ts';
import { fetchCalendarText } from './calendar.ts';
import { fetchWeather } from './weather.ts';

const REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const PHOTO_FOLDER = join(import.meta.dirname, '..', 'photos');
const PHOTO_CONTENT_TYPES: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };

function loadConfig() {
	try {
		return readBoardConfig();
	} catch (error) {
		const isMissing = (error as NodeJS.ErrnoException).code === 'ENOENT';
		console.error(isMissing ? 'board.config.json is missing, copy board.config.example.json to start' : (error as Error).message);
		process.exit(1);
	}
}

const config = loadConfig();
const calendarURLs = new Map(config.calendars.map((calendar) => [calendar.name, calendar.url]));
const boardState = createBoardState(config.calendars.map((calendar) => calendar.name));

function loadCalendar(name: string) {
	const url = calendarURLs.get(name);
	if (!url) {
		return Promise.reject(new Error('not in board.config.json'));
	}
	return fetchCalendarText(url);
}

async function refreshBoard() {
	const problems = await boardState.refresh({
		loadCalendar,
		loadWeather: () => fetchWeather(config),
		now: new Date()
	});
	for (const problem of problems) {
		console.error(`refresh failed, ${problem}`);
	}
}

function send({ response, status, type, body }: { response: ServerResponse; status: number; type: string; body: string | Buffer }) {
	response.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
	response.end(body);
}

const server = createServer((request, response) => {
	const { pathname } = new URL(request.url ?? '/', 'http://localhost');
	if (request.method !== 'GET') {
		send({ response, status: 405, type: CONTENT_TYPES['.txt'], body: 'only GET' });
		return;
	}
	if (pathname === '/board.json') {
		send({ response, status: 200, type: 'application/json', body: JSON.stringify(boardState.snapshot(new Date())) });
		return;
	}
	if (pathname === '/photo.jpg') {
		const photo = pickPhotoForHour({ photos: listPhotos(PHOTO_FOLDER), now: new Date() });
		if (!photo) {
			send({ response, status: 404, type: CONTENT_TYPES['.txt'], body: 'no photos' });
			return;
		}
		send({ response, status: 200, type: PHOTO_CONTENT_TYPES[extname(photo).toLowerCase()], body: readFileSync(photo) });
		return;
	}
	const path = findPublicFile(pathname);
	if (!path) {
		send({ response, status: 404, type: CONTENT_TYPES['.txt'], body: 'not found' });
		return;
	}
	send({ response, status: 200, type: CONTENT_TYPES[extname(path)], body: readFileSync(path) });
});

server.listen(config.port, () => {
	console.log(`family board on http://localhost:${config.port}`);
});
await refreshBoard();
setInterval(refreshBoard, REFRESH_INTERVAL_MS);
