import { existsSync, readdirSync } from 'node:fs';
import { basename, extname, join, sep } from 'node:path';

const PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png'];
const HOUR_MS = 60 * 60 * 1000;
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function listPhotos(folder: string) {
	if (!existsSync(folder)) {
		return [];
	}
	return readdirSync(folder, { recursive: true, encoding: 'utf8' })
		.filter((path) => !path.split(sep).some((part) => part.startsWith('.')) && PHOTO_EXTENSIONS.includes(extname(path).toLowerCase()))
		.sort((first, second) => first.localeCompare(second))
		.map((path) => join(folder, path));
}

function hashName(name: string) {
	let hash = FNV_OFFSET_BASIS;
	for (const character of name) {
		hash = Math.imul(hash ^ (character.codePointAt(0) ?? 0), FNV_PRIME) >>> 0;
	}
	return hash;
}

export function shufflePhotos(photos: string[]) {
	return photos
		.map((photo) => ({ photo, order: hashName(basename(photo)) }))
		.sort((first, second) => first.order - second.order || first.photo.localeCompare(second.photo))
		.map(({ photo }) => photo);
}

export function pickPhotoForHour({ photos, now }: { photos: string[]; now: Date }) {
	if (photos.length === 0) {
		return null;
	}
	return shufflePhotos(photos)[Math.floor(now.getTime() / HOUR_MS) % photos.length];
}
