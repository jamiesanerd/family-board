import { existsSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';

const PUBLIC_FOLDER = resolve(import.meta.dirname, '..', 'public');

export const CONTENT_TYPES: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.woff2': 'font/woff2',
	'.txt': 'text/plain; charset=utf-8'
};

function decodePathname(pathname: string) {
	try {
		return decodeURIComponent(pathname);
	} catch {
		return null;
	}
}

export function findPublicFile(pathname: string) {
	const decodedPathname = decodePathname(pathname);
	if (decodedPathname === null) {
		return null;
	}
	const relativePath = decodedPathname === '/' ? 'index.html' : decodedPathname.replace(/^\/+/, '');
	const path = resolve(PUBLIC_FOLDER, relativePath);
	const isInsidePublic = path.startsWith(PUBLIC_FOLDER + sep);
	if (!isInsidePublic || !CONTENT_TYPES[extname(path)] || !existsSync(path) || !statSync(path).isFile()) {
		return null;
	}
	return path;
}
