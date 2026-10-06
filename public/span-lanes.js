export function getSpanLanes(spans) {
	const laneLastDays = [];
	return spans.map(({ firstDay, lastDay }) => {
		const freeLane = laneLastDays.findIndex((laneLastDay) => laneLastDay < firstDay);
		const lane = freeLane === -1 ? laneLastDays.length : freeLane;
		laneLastDays[lane] = lastDay;
		return lane;
	});
}
