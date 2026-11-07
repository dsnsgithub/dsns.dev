import { DEFAULT_FIT, sanitizeBand, validateCurve, type Band, type Curve, type FitOptions } from "./dsp";
import { validateMeasurement, type Measurement } from "./data";
import type { AudioSettings } from "./audio";
import { DEFAULT_GRAPH, type GraphSettings } from "./display";
import type { RigPreference } from "./search";

export interface Session {
	version: 2;
	headphone: Measurement | null;
	targetHeadphone: Measurement | null;
	customTarget: Curve;
	targetMode: "preference" | "headphone" | "custom";
	targetName: string;
	bass: number;
	treble: number;
	tilt: number;
	fit: FitOptions;
	bands: Band[];
	audio: AudioSettings;
	overlays: { measured: boolean; target: boolean; predicted: boolean; eq: boolean; spectrum: boolean };
	graph: GraphSettings;
	rigPreference: RigPreference;
	spectrum: "input" | "output";
	detail: number;
}

export const DEFAULT_SESSION: Session = {
	version: 2,
	headphone: null,
	targetHeadphone: null,
	customTarget: { frequency: [20, 100, 1000, 3000, 6000, 10000, 20000], raw: [0, 0, 0, 0, 0, 0, 0] },
	targetMode: "preference",
	targetName: "Harman over-ear 2018",
	bass: 0,
	treble: 0,
	tilt: 0,
	fit: DEFAULT_FIT,
	bands: [],
	audio: { enabled: true, autoGain: true, matchBypass: true, preamp: 0 },
	overlays: { measured: true, target: true, predicted: true, eq: true, spectrum: true },
	graph: DEFAULT_GRAPH,
	rigPreference: "prefer",
	spectrum: "output",
	detail: 13
};

export function validateSession(value: unknown): Session {
	if (!value || typeof value !== "object") throw new Error("Invalid preset file.");
	const s = value as Omit<Session, "version"> & { version: number };
	if (![1, 2].includes(s.version) || !s.fit || !s.audio || !s.overlays || !Array.isArray(s.bands) || s.bands.length > 24)
		throw new Error("Unsupported or incomplete preset. Use an /eq JSON preset with up to 24 bands.");
	const range = (n: number, lo: number, hi: number) => {
		if (!Number.isFinite(n) || n < lo || n > hi) throw new Error("A preset setting is outside its supported range.");
		return n;
	};
	const flag = (b: boolean) => {
		if (typeof b !== "boolean") throw new Error("Invalid preset switch.");
		return b;
	};
	if (!["preference", "headphone", "custom"].includes(s.targetMode) || !["input", "output"].includes(s.spectrum) || typeof s.targetName !== "string" || s.targetName.length > 200)
		throw new Error("Invalid target or spectrum setting.");
	const fit: FitOptions = {
		count: range(s.fit.count, 3, 20),
		strength: range(s.fit.strength, 0, 100),
		maxBoost: range(s.fit.maxBoost, 0, 12),
		maxCut: range(s.fit.maxCut, 0, 24),
		minFreq: range(s.fit.minFreq, 20, 10000),
		maxFreq: range(s.fit.maxFreq, 100, 20000),
		smoothing: range(s.fit.smoothing, 0, 1),
		normalizeAt: range(s.fit.normalizeAt, 20, 10000)
	};
	if (fit.minFreq >= fit.maxFreq || !Number.isInteger(fit.count) || !Number.isInteger(s.detail)) throw new Error("Invalid correction range or band count.");
	// Old setups retain their measurements and audible EQ, and receive the new display defaults.
	const g = s.version === 1 ? DEFAULT_GRAPH : s.graph;
	const rigPreference = s.version === 1 ? "prefer" : s.rigPreference;
	if (!g || !["prefer", "only", "all"].includes(rigPreference)) throw new Error("Invalid graph or measurement search settings.");
	return {
		version: 2,
		headphone: validateMeasurement(s.headphone),
		targetHeadphone: validateMeasurement(s.targetHeadphone),
		customTarget: validateCurve(s.customTarget),
		targetMode: s.targetMode,
		targetName: s.targetName,
		bass: range(s.bass, -12, 12),
		treble: range(s.treble, -12, 12),
		tilt: range(s.tilt, -2, 2),
		fit,
		bands: s.bands.map(sanitizeBand),
		audio: { enabled: flag(s.audio.enabled), autoGain: flag(s.audio.autoGain), matchBypass: flag(s.audio.matchBypass), preamp: range(s.audio.preamp, -24, 12) },
		overlays: { measured: flag(s.overlays.measured), target: flag(s.overlays.target), predicted: flag(s.overlays.predicted), eq: flag(s.overlays.eq), spectrum: flag(s.overlays.spectrum) },
		graph: {
			range: range(g.range, 10, 120),
			normalizeDb: range(g.normalizeDb, -100, 150),
			normalizeAt: range(g.normalizeAt, 20, 10000),
			smoothing: range(g.smoothing, 0, 20),
			offset: range(g.offset, -60, 60)
		},
		rigPreference,
		spectrum: s.spectrum,
		detail: range(s.detail, 8, 15)
	};
}
