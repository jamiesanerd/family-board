import { type BoardConfig } from './board-config.ts';

export interface WeatherDescription {
	label: string;
	iconName: string | null;
}

export interface ForecastDay extends WeatherDescription {
	date: string;
	high: number;
	low: number;
}

export interface AirQuality {
	index: number;
	category: string;
	isUnhealthy: boolean;
}

export interface BoardWeather {
	current: WeatherDescription & { temperature: number };
	today: { high: number; low: number };
	sunrise: string;
	sunset: string;
	forecast: ForecastDay[];
	airQuality: AirQuality | null;
}

interface OpenMeteoResponse {
	current: { temperature_2m: number; weather_code: number; is_day?: number };
	daily: {
		time: string[];
		weather_code: number[];
		temperature_2m_max: number[];
		temperature_2m_min: number[];
		sunrise: string[];
		sunset: string[];
	};
}

const FORECAST_DAY_COUNT = 4;
const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const OPEN_METEO_AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const UNHEALTHY_FOR_SENSITIVE_GROUPS_AT = 101;
const AIR_QUALITY_CATEGORIES = [
	{ upTo: 50, category: 'Good' },
	{ upTo: 100, category: 'Moderate' },
	{ upTo: 150, category: 'Unhealthy for sensitive groups' },
	{ upTo: 200, category: 'Unhealthy' },
	{ upTo: 300, category: 'Very unhealthy' },
	{ upTo: Infinity, category: 'Hazardous' }
];
const NIGHT_ICON_NAMES: Record<string, string> = { sun: 'moon', 'cloud-sun': 'cloud-moon' };

const WEATHER_DESCRIPTIONS: Record<number, WeatherDescription> = {
	0: { label: 'Clear', iconName: 'sun' },
	1: { label: 'Mostly clear', iconName: 'sun' },
	2: { label: 'Partly cloudy', iconName: 'cloud-sun' },
	3: { label: 'Cloudy', iconName: 'cloud' },
	45: { label: 'Fog', iconName: 'cloud-fog' },
	48: { label: 'Freezing fog', iconName: 'cloud-fog' },
	51: { label: 'Light drizzle', iconName: 'cloud-rain' },
	53: { label: 'Drizzle', iconName: 'cloud-rain' },
	55: { label: 'Heavy drizzle', iconName: 'cloud-rain' },
	56: { label: 'Freezing drizzle', iconName: 'cloud-rain' },
	57: { label: 'Freezing drizzle', iconName: 'cloud-rain' },
	61: { label: 'Light rain', iconName: 'cloud-rain' },
	63: { label: 'Rain', iconName: 'cloud-rain' },
	65: { label: 'Heavy rain', iconName: 'cloud-rain' },
	66: { label: 'Freezing rain', iconName: 'cloud-rain' },
	67: { label: 'Freezing rain', iconName: 'cloud-rain' },
	71: { label: 'Light snow', iconName: 'snowflake' },
	73: { label: 'Snow', iconName: 'snowflake' },
	75: { label: 'Heavy snow', iconName: 'snowflake' },
	77: { label: 'Snow grains', iconName: 'snowflake' },
	80: { label: 'Light showers', iconName: 'cloud-rain' },
	81: { label: 'Showers', iconName: 'cloud-rain' },
	82: { label: 'Heavy showers', iconName: 'cloud-rain' },
	85: { label: 'Snow showers', iconName: 'snowflake' },
	86: { label: 'Heavy snow showers', iconName: 'snowflake' },
	95: { label: 'Thunderstorm', iconName: 'zap' },
	96: { label: 'Thunderstorm with hail', iconName: 'zap' },
	99: { label: 'Thunderstorm with hail', iconName: 'zap' }
};

export function describeWeatherCode({ code, isDaytime }: { code: number; isDaytime: boolean }) {
	const description = WEATHER_DESCRIPTIONS[code] ?? { label: 'Unknown', iconName: null };
	if (isDaytime || !description.iconName) {
		return description;
	}
	return { ...description, iconName: NIGHT_ICON_NAMES[description.iconName] ?? description.iconName };
}

export function describeAirQuality(index: number) {
	const { category } = AIR_QUALITY_CATEGORIES.find(({ upTo }) => index <= upTo) ?? AIR_QUALITY_CATEGORIES[AIR_QUALITY_CATEGORIES.length - 1];
	return { index, category, isUnhealthy: index >= UNHEALTHY_FOR_SENSITIVE_GROUPS_AT };
}

function isOpenMeteoResponse(json: unknown): json is OpenMeteoResponse {
	const response = json as Partial<OpenMeteoResponse> | null;
	return typeof response?.current?.temperature_2m === 'number' && Array.isArray(response.daily?.time) && response.daily.time.length > FORECAST_DAY_COUNT;
}

export function parseOpenMeteo(json: unknown) {
	if (!isOpenMeteoResponse(json)) {
		throw new Error('weather response is missing current or daily data');
	}
	const { current, daily } = json;
	const forecast = daily.time.slice(1, FORECAST_DAY_COUNT + 1).map((date, index) => ({
		date,
		high: Math.round(daily.temperature_2m_max[index + 1]),
		low: Math.round(daily.temperature_2m_min[index + 1]),
		...describeWeatherCode({ code: daily.weather_code[index + 1], isDaytime: true })
	}));
	const weather: BoardWeather = {
		current: {
			temperature: Math.round(current.temperature_2m),
			...describeWeatherCode({ code: current.weather_code, isDaytime: current.is_day !== 0 })
		},
		today: { high: Math.round(daily.temperature_2m_max[0]), low: Math.round(daily.temperature_2m_min[0]) },
		sunrise: daily.sunrise[0],
		sunset: daily.sunset[0],
		forecast,
		airQuality: null
	};
	return weather;
}

export function parseAirQuality(json: unknown) {
	const index = (json as { current?: { us_aqi?: unknown } } | null)?.current?.us_aqi;
	if (typeof index !== 'number') {
		throw new Error('air quality response is missing us_aqi');
	}
	return describeAirQuality(Math.round(index));
}

async function fetchJSON(url: URL) {
	const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
	if (!response.ok) {
		throw new Error(`${url.hostname} answered ${response.status}`);
	}
	return response.json();
}

async function fetchAirQuality({ latitude, longitude }: Pick<BoardConfig, 'latitude' | 'longitude'>) {
	const url = new URL(OPEN_METEO_AIR_QUALITY_URL);
	url.search = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), current: 'us_aqi', timezone: 'auto' }).toString();
	return parseAirQuality(await fetchJSON(url));
}

export async function fetchWeather({ latitude, longitude, temperatureUnit }: Pick<BoardConfig, 'latitude' | 'longitude' | 'temperatureUnit'>) {
	const url = new URL(OPEN_METEO_URL);
	url.search = new URLSearchParams({
		latitude: String(latitude),
		longitude: String(longitude),
		current: 'temperature_2m,weather_code,is_day',
		daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset',
		forecast_days: String(FORECAST_DAY_COUNT + 1),
		timezone: 'auto',
		temperature_unit: temperatureUnit
	}).toString();
	const [weather, airQuality] = await Promise.all([
		fetchJSON(url).then(parseOpenMeteo),
		fetchAirQuality({ latitude, longitude }).catch(() => null)
	]);
	return { ...weather, airQuality };
}
