export interface Curve {
	frequency: number[];
	raw: number[];
}

export type FilterType = "peaking" | "lowshelf" | "highshelf" | "lowpass" | "highpass";
export interface Band {
	type: FilterType;
	freq: number;
	gain: number;
	q: number;
	enabled: boolean;
}

export interface FitOptions {
	count: number;
	strength: number;
	maxBoost: number;
	maxCut: number;
	minFreq: number;
	maxFreq: number;
	smoothing: number;
	normalizeAt: number;
}

export const DEFAULT_FIT: FitOptions = {
	count: 10,
	strength: 100,
	maxBoost: 6,
	maxCut: 12,
	minFreq: 20,
	maxFreq: 10000,
	smoothing: 1 / 6,
	normalizeAt: 1000
};
export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
export const logFrequencies = (count = 256, max = 20000, min = 20) => Array.from({ length: count }, (_, i) => min * (max / min) ** (i / (count - 1)));

export function validateCurve(value: unknown): Curve {
	const c = value as Curve | undefined;
	if (!c || !Array.isArray(c.frequency) || !Array.isArray(c.raw) || c.frequency.length !== c.raw.length || c.frequency.length < 2 || c.frequency.length > 20000) {
		throw new Error("A curve needs at least two frequency / dB pairs (maximum 20,000).");
	}
	const pairs = c.frequency.map((f, i) => [f, c.raw[i]]);
	if (pairs.some(([f, db]) => !Number.isFinite(f) || !Number.isFinite(db) || f < 1 || f > 100000 || Math.abs(db) > 300)) {
		throw new Error("Use finite frequencies from 1–100,000 Hz and levels from −300 to +300 dB.");
	}
	pairs.sort((a, b) => a[0] - b[0]);
	if (pairs.some(([f], i) => i > 0 && f === pairs[i - 1][0])) throw new Error("Each frequency must appear only once.");
	if (pairs[0][0] > 100 || pairs.at(-1)![0] < 10000) throw new Error("The curve must cover at least 100 Hz–10 kHz.");
	return { frequency: pairs.map((p) => p[0]), raw: pairs.map((p) => p[1]) };
}

/** AutoEq CSV (raw column), REW/Squig text, or two-column CSV/TSV. */
export function parseCurve(text: string): Curve {
	if (text.length > 2_000_000) throw new Error("Curve files must be smaller than 2 MB.");
	const frequency: number[] = [],
		raw: number[] = [];
	let levelColumn = 1,
		frequencyColumn = 0;
	for (const line of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
		const clean = line.trim();
		if (!clean || /^[#*]/.test(clean) || clean.startsWith("//")) continue;
		const cells = clean.split(/[,;\t ]+/).map((s) => s.replace(/^"|"$/g, ""));
		if (/^frequency|^freq\b/i.test(cells[0])) {
			const lower = cells.map((s) => s.toLowerCase());
			frequencyColumn = 0;
			const rawIndex = lower.indexOf("raw");
			levelColumn = rawIndex >= 0 ? rawIndex : 1;
			continue;
		}
		if (!/^[+\-\d.]/.test(cells[0])) continue; // REW metadata
		const f = Number(cells[frequencyColumn]),
			db = Number(cells[levelColumn]);
		if (cells.length < 2 || !Number.isFinite(f) || !Number.isFinite(db)) throw new Error("Invalid row: expected frequency in Hz and a level in dB.");
		frequency.push(f);
		raw.push(db);
	}
	return validateCurve({ frequency, raw });
}

export function interpolate(curve: Curve, frequency: number): number {
	const xs = curve.frequency,
		ys = curve.raw;
	if (frequency <= xs[0]) return ys[0];
	if (frequency >= xs[xs.length - 1]) return ys[ys.length - 1];
	let lo = 0,
		hi = xs.length - 1;
	while (hi - lo > 1) {
		const mid = (lo + hi) >> 1;
		if (xs[mid] <= frequency) lo = mid;
		else hi = mid;
	}
	const t = Math.log(frequency / xs[lo]) / Math.log(xs[hi] / xs[lo]);
	return ys[lo] + t * (ys[hi] - ys[lo]);
}

export function normalize(curve: Curve, at = 1000): Curve {
	const offset = interpolate(curve, at);
	return { frequency: curve.frequency, raw: curve.raw.map((db) => db - offset) };
}

export function smooth(values: number[], frequencies: number[], octaves: number): number[] {
	if (octaves <= 0) return [...values];
	const logs = frequencies.map(Math.log2),
		sigma = octaves / 2;
	return values.map((_, i) => {
		let sum = 0,
			weight = 0;
		for (let j = 0; j < values.length; j++) {
			const distance = (logs[j] - logs[i]) / sigma;
			if (Math.abs(distance) > 3) continue;
			const w = Math.exp(-0.5 * distance ** 2);
			sum += values[j] * w;
			weight += w;
		}
		return sum / weight;
	});
}

// RBJ biquads, matching Web Audio (shelves have S=1; pass-filter Q is linear here).
export function coefficients(band: Band, sampleRate: number): number[] {
	const w = (2 * Math.PI * clamp(band.freq, 1, sampleRate * 0.49)) / sampleRate;
	const c = Math.cos(w),
		s = Math.sin(w),
		A = 10 ** (band.gain / 40);
	const alpha = s / (2 * band.q),
		shelfAlpha = s / Math.SQRT2;
	const k = 2 * Math.sqrt(A) * shelfAlpha;
	switch (band.type) {
		case "peaking":
			return [1 + alpha * A, -2 * c, 1 - alpha * A, 1 + alpha / A, -2 * c, 1 - alpha / A];
		case "lowshelf":
			return [A * (A + 1 - (A - 1) * c + k), 2 * A * (A - 1 - (A + 1) * c), A * (A + 1 - (A - 1) * c - k), A + 1 + (A - 1) * c + k, -2 * (A - 1 + (A + 1) * c), A + 1 + (A - 1) * c - k];
		case "highshelf":
			return [A * (A + 1 + (A - 1) * c + k), -2 * A * (A - 1 + (A + 1) * c), A * (A + 1 + (A - 1) * c - k), A + 1 - (A - 1) * c + k, 2 * (A - 1 - (A + 1) * c), A + 1 - (A - 1) * c - k];
		case "lowpass":
			return [(1 - c) / 2, 1 - c, (1 - c) / 2, 1 + alpha, -2 * c, 1 - alpha];
		case "highpass":
			return [(1 + c) / 2, -(1 + c), (1 + c) / 2, 1 + alpha, -2 * c, 1 - alpha];
	}
}

export function responseAt(coeff: number[], f: number, sampleRate: number): number {
	const [b0, b1, b2, a0, a1, a2] = coeff,
		w = (2 * Math.PI * f) / sampleRate;
	const c = Math.cos(w),
		c2 = Math.cos(2 * w),
		s = Math.sin(w),
		s2 = Math.sin(2 * w);
	const num = (b0 + b1 * c + b2 * c2) ** 2 + (b1 * s + b2 * s2) ** 2;
	const den = (a0 + a1 * c + a2 * c2) ** 2 + (a1 * s + a2 * s2) ** 2;
	return 10 * Math.log10(Math.max(1e-12, num) / Math.max(1e-12, den));
}

export function bandResponse(band: Band, frequencies: number[], sampleRate = 48000): number[] {
	if (!band.enabled) return frequencies.map(() => 0);
	const coeff = coefficients(band, sampleRate);
	return frequencies.map((f) => responseAt(coeff, f, sampleRate));
}

export function combinedResponse(bands: Band[], frequencies: number[], sampleRate = 48000): number[] {
	const total = frequencies.map(() => 0);
	for (const band of bands) bandResponse(band, frequencies, sampleRate).forEach((db, i) => (total[i] += db));
	return total;
}

/** Shared by playback and export, including overlapping boosts and pass-filter resonance. */
export function correctionPreamp(bands: Band[], preamp: number, autoGain: boolean, sampleRate = 48000): number {
	if (!autoGain) return preamp;
	const max = sampleRate * 0.499;
	// Shelves and overlapping broad filters can peak below the displayed 20 Hz floor.
	const frequencies = [0, ...logFrequencies(4096, max, 1), sampleRate / 2];
	for (const band of bands) if (band.enabled) frequencies.push(Math.min(band.freq, sampleRate * 0.49));
	const peak = Math.max(0, ...combinedResponse(bands, frequencies, sampleRate));
	return preamp - (peak > 1e-6 ? peak + 1 : 0);
}

export function preferenceCurve(base: Curve, bass: number, treble: number, tilt: number, sampleRate = 48000): Curve {
	const makeShelf = (type: FilterType, freq: number, gain: number): Band => ({ type, freq, gain, q: Math.SQRT1_2, enabled: true });
	const low = bandResponse(makeShelf("lowshelf", 105, bass), base.frequency, sampleRate);
	const high = bandResponse(makeShelf("highshelf", 6000, treble), base.frequency, sampleRate);
	return { frequency: base.frequency, raw: base.raw.map((db, i) => db + low[i] + high[i] + tilt * Math.log2(base.frequency[i] / 1000)) };
}

export function correctionCurve(source: Curve, target: Curve, options: FitOptions, frequencies: number[]): number[] {
	const src = normalize(source, options.normalizeAt),
		dst = normalize(target, options.normalizeAt);
	const delta = frequencies.map((f) => ((interpolate(dst, f) - interpolate(src, f)) * options.strength) / 100);
	const smoothed = smooth(delta, frequencies, options.smoothing);
	return frequencies.map((f, i) => {
		if (f < options.minFreq || f > options.maxFreq || f < source.frequency[0] || f > source.frequency.at(-1)! || f < target.frequency[0] || f > target.frequency.at(-1)!) return 0;
		// A gentle treble taper avoids chasing narrow, fit-dependent upper-treble notches.
		const taper = clamp(Math.log2(options.maxFreq / f) / (1 / 3), 0, 1);
		return clamp(smoothed[i], -options.maxCut, options.maxBoost) * taper;
	});
}

/** Bounded, browser-local least-squares fit; these are editable PEQ approximations. */
export function fitEQ(source: Curve, target: Curve, options: FitOptions, sampleRate = 48000): Band[] {
	const frequencies = logFrequencies(160, Math.min(20000, sampleRate * 0.49));
	const desired = correctionCurve(source, target, options, frequencies);
	if (options.strength === 0 || desired.every((v) => Math.abs(v) < 0.05)) return [];
	const bands: Band[] = [],
		total = frequencies.map(() => 0);
	const score = (response: number[], remainder: number[]) => response.reduce((sum, db, i) => sum + (db - remainder[i]) ** 2, 0);
	for (let n = 0; n < options.count; n++) {
		const remainder = desired.map((db, i) => db - total[i]);
		const candidates = remainder
			.map((v, i) => ({ v, i }))
			.filter(({ i }) => frequencies[i] >= options.minFreq && frequencies[i] <= options.maxFreq)
			.sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
			.slice(0, 6);
		let best: Band | undefined,
			bestResponse: number[] = [],
			bestScore = score(
				total.map(() => 0),
				remainder
			);
		for (const { v, i } of candidates)
			for (const q of [0.4, 0.7, 1, 1.5, 2.5, 4, 6])
				for (const scale of [0.6, 1]) {
					const band: Band = { type: "peaking", freq: frequencies[i], gain: clamp(v * scale, -options.maxCut, options.maxBoost), q, enabled: true };
					const response = bandResponse(band, frequencies, sampleRate),
						cost = score(response, remainder);
					if (cost < bestScore - 0.001) {
						best = band;
						bestResponse = response;
						bestScore = cost;
					}
				}
		if (!best || Math.abs(best.gain) < 0.1) break;
		bands.push(best);
		bestResponse.forEach((db, i) => (total[i] += db));
	}
	// Refine each band against the remaining cascade, including overlapping responses.
	for (const step of [1, 0.5, 0.25])
		for (let index = 0; index < bands.length; index++) {
			const old = bandResponse(bands[index], frequencies, sampleRate);
			const remainder = desired.map((db, i) => db - total[i] + old[i]);
			let best = bands[index],
				bestResponse = old,
				bestScore = score(old, remainder);
			for (const freqScale of [2 ** (-0.2 * step), 1, 2 ** (0.2 * step)])
				for (const qScale of [2 ** (-0.5 * step), 1, 2 ** (0.5 * step)])
					for (const gainStep of [-step, 0, step]) {
						const band = {
							...bands[index],
							freq: clamp(bands[index].freq * freqScale, options.minFreq, Math.min(options.maxFreq, sampleRate * 0.49)),
							q: clamp(bands[index].q * qScale, 0.3, 8),
							gain: clamp(bands[index].gain + gainStep, -options.maxCut, options.maxBoost)
						};
						const response = bandResponse(band, frequencies, sampleRate),
							cost = score(response, remainder);
						if (cost < bestScore) {
							best = band;
							bestResponse = response;
							bestScore = cost;
						}
					}
			bands[index] = best;
			bestResponse.forEach((db, i) => (total[i] += db - old[i]));
		}
	// Limits apply to the combined curve, not merely each filter's gain knob.
	const dense = logFrequencies(1024, Math.min(20000, sampleRate * 0.49));
	for (let attempt = 0; attempt < 16; attempt++) {
		const response = combinedResponse(bands, dense, sampleRate);
		const peak = Math.max(0, ...response),
			cut = -Math.min(0, ...response);
		if (peak <= options.maxBoost + 0.01 && cut <= options.maxCut + 0.01) break;
		const scale = Math.min(1, peak ? options.maxBoost / peak : 1, cut ? options.maxCut / cut : 1) * 0.995;
		bands.forEach((b) => (b.gain *= scale));
	}
	return bands.filter((b) => Math.abs(b.gain) >= 0.05).sort((a, b) => a.freq - b.freq);
}

export function sanitizeBand(value: unknown): Band {
	const b = value as Band;
	if (
		!b ||
		!["peaking", "lowshelf", "highshelf", "lowpass", "highpass"].includes(b.type) ||
		![b.freq, b.gain, b.q].every(Number.isFinite) ||
		b.freq < 20 ||
		b.freq > 20000 ||
		Math.abs(b.gain) > 24 ||
		b.q < 0.1 ||
		b.q > 18 ||
		typeof b.enabled !== "boolean"
	) {
		throw new Error("Invalid EQ band. Use 20–20,000 Hz, ±24 dB, and Q 0.1–18.");
	}
	return { type: b.type, freq: b.freq, gain: b.gain, q: b.q, enabled: b.enabled };
}
