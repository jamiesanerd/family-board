const FLAT_PHOTO_RANGE = 0.1;
const INK_CURVES = {
	lightPaper: { primary: { from: 0.35, power: 1.2, strength: 0.42 }, accent: { from: 0.05, power: 1.3, strength: 0.32 } },
	darkPaper: { primary: { from: 0.25, power: 1.1, strength: 0.42 }, accent: { from: 0, power: 0.9, strength: 0.3 } }
};

function getLuminances(pixels) {
	const luminances = new Float32Array(pixels.length / 4);
	for (let index = 0; index < luminances.length; index++) {
		const offset = index * 4;
		luminances[index] = (0.299 * pixels[offset] + 0.587 * pixels[offset + 1] + 0.114 * pixels[offset + 2]) / 255;
	}
	return luminances;
}

function stretchContrast(luminances) {
	const sorted = Float32Array.from(luminances).sort();
	const low = sorted[Math.floor(sorted.length * 0.02)];
	const high = sorted[Math.floor(sorted.length * 0.98)];
	if (high - low < FLAT_PHOTO_RANGE) {
		return luminances;
	}
	return luminances.map((luminance) => Math.min(1, Math.max(0, (luminance - low) / (high - low))));
}

function getDensity({ tone, curve }) {
	const ramp = Math.min(1, Math.max(0, (tone - curve.from) / (1 - curve.from)));
	return ramp ** curve.power * curve.strength;
}

export function getInkMasks({ pixels, width, height, isDarkPaper }) {
	const curves = isDarkPaper ? INK_CURVES.darkPaper : INK_CURVES.lightPaper;
	const luminances = stretchContrast(getLuminances(pixels));
	const primaryMask = new Uint8ClampedArray(width * height * 4);
	const accentMask = new Uint8ClampedArray(width * height * 4);
	for (let index = 0; index < width * height; index++) {
		const tone = isDarkPaper ? luminances[index] : 1 - luminances[index];
		primaryMask[index * 4 + 3] = Math.round(getDensity({ tone, curve: curves.primary }) * 255);
		accentMask[index * 4 + 3] = Math.round(getDensity({ tone, curve: curves.accent }) * 255);
	}
	return { primaryMask, accentMask };
}
