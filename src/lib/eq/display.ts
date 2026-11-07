import { interpolate, type Curve } from "./dsp";

export interface GraphSettings {
	range: number;
	normalizeDb: number;
	normalizeAt: number;
	smoothing: number;
	offset: number;
}

export const DEFAULT_GRAPH: GraphSettings = { range: 40, normalizeDb: 60, normalizeAt: 1000, smoothing: 5, offset: 0 };

/** A 40 dB scale is the full visible span, not ±40 dB. */
export function graphBounds(graph: GraphSettings) {
	const center = graph.normalizeDb - graph.offset;
	return { min: center - graph.range / 2, max: center + graph.range / 2 };
}

/**
 * Natural cubic smoothing spline in log Hz: solve (R + G D² Gᵀ) z = G y,
 * then return y - D² Gᵀ z. The matrix is symmetric with bandwidth two.
 * Hangout's public headphone graph uses D[i] = level * .002 * 80^(-(i/n)^2).
 * This numeric smoothing control is distinct from fractional-octave EQ fitting.
 * Reference: https://graph.hangout.audio/headphones/ (config_hp_premium.js scale_smoothing = .2).
 */
export function smoothDisplay(curve: Curve, level: number): Curve {
	const n = curve.frequency.length,
		size = n - 2;
	if (level <= 0 || size < 1) return { frequency: curve.frequency, raw: [...curve.raw] };
	const h = curve.frequency.slice(1).map((f, i) => Math.log(f / curve.frequency[i]));
	const variance = curve.frequency.map((_, i) => (level * 0.002 * 80 ** -((i / n) ** 2)) ** 2);
	const g = Array.from({ length: size }, (_, i) => [1 / h[i], -1 / h[i] - 1 / h[i + 1], 1 / h[i + 1]]);
	const diagonal = new Float64Array(size),
		lower1 = new Float64Array(size),
		lower2 = new Float64Array(size),
		work = new Float64Array(size);
	for (let i = 0; i < size; i++) {
		for (let j = Math.max(0, i - 2); j <= i; j++) {
			let value = i === j ? (h[i] + h[i + 1]) / 3 : i === j + 1 ? h[i] / 6 : 0;
			for (let k = i; k <= j + 2; k++) value += g[i][k - i] * variance[k] * g[j][k - j];
			if (i === j) diagonal[i] = value;
			else if (i === j + 1) lower1[i] = value;
			else lower2[i] = value;
		}
		// Banded Cholesky factorization and forward substitution.
		if (i >= 2) lower2[i] /= diagonal[i - 2];
		if (i >= 1) lower1[i] = (lower1[i] - lower2[i] * lower1[i - 1]) / diagonal[i - 1];
		diagonal[i] = Math.sqrt(diagonal[i] - lower1[i] ** 2 - lower2[i] ** 2);
		const rhs = g[i].reduce((sum, coefficient, k) => sum + coefficient * curve.raw[i + k], 0);
		work[i] = (rhs - (i >= 1 ? lower1[i] * work[i - 1] : 0) - (i >= 2 ? lower2[i] * work[i - 2] : 0)) / diagonal[i];
	}
	for (let i = size - 1; i >= 0; i--) {
		work[i] = (work[i] - (i + 1 < size ? lower1[i + 1] * work[i + 1] : 0) - (i + 2 < size ? lower2[i + 2] * work[i + 2] : 0)) / diagonal[i];
	}
	const raw = [...curve.raw];
	for (let i = 0; i < size; i++) for (let k = 0; k < 3; k++) raw[i + k] -= variance[i + k] * g[i][k] * work[i];
	return { frequency: curve.frequency, raw };
}

export function displayCurve(curve: Curve, graph: GraphSettings): Curve {
	const smoothed = smoothDisplay(curve, graph.smoothing);
	const shift = graph.normalizeDb - interpolate(smoothed, graph.normalizeAt);
	return { frequency: smoothed.frequency, raw: smoothed.raw.map((db) => db + shift) };
}
