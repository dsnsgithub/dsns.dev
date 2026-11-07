import { interpolate, logFrequencies, validateCurve, type Curve } from "./dsp";
import type { MeasurementInfo } from "./data";

export const HANGOUT_SOURCE = "Crinacle (Hangout.Audio)";
export const HANGOUT_COLLECTIONS = {
	headphones: { path: "headphones", rig: "GRAS 43AG-7", targetRig: "GRAS 43AG-7", form: "over-ear", channels: ["L1", "L2", "L3", "R1", "R2", "R3"] },
	"iem-711": { path: "iem/711", rig: "711", targetRig: "711", form: "in-ear", channels: ["L", "R"] },
	"iem-5128": { path: "iem/5128", rig: "Bruel & Kjaer 4620 (5128)", targetRig: "Bruel & Kjaer 4620", form: "in-ear", channels: ["L", "R"] }
} as const;
export type HangoutCollection = keyof typeof HANGOUT_COLLECTIONS;
export interface HangoutEntry {
	id: string;
	collection: HangoutCollection;
	file: string;
}
export interface HangoutCatalog {
	fetchedAt: string;
	entries: HangoutEntry[];
	warnings: string[];
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const label = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length < 350 && !/[\x00-\x1f]/.test(value);
export const validHangoutFile = (value: unknown): value is string => label(value) && !/[/\\]/.test(value) && value !== "." && value !== "..";

/** Keep each pad, mode, and sample variant tied to its actual upstream filename. */
export function parseHangoutBook(value: unknown, collection: HangoutCollection): HangoutEntry[] {
	if (!Array.isArray(value) || value.length > 2000) throw new Error("Invalid Hangout.Audio measurement catalog.");
	const group = HANGOUT_COLLECTIONS[collection];
	const entries = new Map<string, HangoutEntry>();
	for (const brand of value) {
		if (!record(brand) || !label(brand.name) || !Array.isArray(brand.phones)) throw new Error("Invalid Hangout.Audio brand entry.");
		for (const item of brand.phones) {
			const phone = typeof item === "string" ? { name: item, file: item } : item;
			if (!record(phone) || !label(phone.name)) throw new Error("Invalid Hangout.Audio model entry.");
			const files = Array.isArray(phone.file) ? phone.file : [phone.file ?? phone.name];
			const suffix = phone.suffix ?? phone.Suffix;
			// Upstream uses a string for some single-file models, and "Suffix" in older entries.
			const suffixes = typeof suffix === "string" ? [suffix] : (suffix ?? []);
			if (!files.length || files.length > 100 || !Array.isArray(suffixes) || !suffixes.every((s) => typeof s === "string" && s.length < 350 && !/[\x00-\x1f]/.test(s)))
				throw new Error("Invalid Hangout.Audio variants.");
			files.forEach((file, i) => {
				if (!validHangoutFile(file)) throw new Error("Invalid Hangout.Audio measurement filename.");
				const suffix = Array.isArray(suffixes) && typeof suffixes[i] === "string" ? suffixes[i] : files.length > 1 ? `(${file})` : "";
				const name = [brand.name, label(phone.collab) ? `× ${phone.collab}` : "", phone.name, suffix].filter(Boolean).join(" ").trim();
				let id = `${HANGOUT_SOURCE}/${group.rig} ${group.form}/${name}`;
				if (entries.has(id) && entries.get(id)!.file !== file) id += ` (${file})`;
				if (id.length >= 1000) throw new Error("Hangout.Audio model name is too long.");
				entries.set(id, { id, collection, file });
			});
		}
	}
	if (!entries.size || entries.size > 10000) throw new Error("The Hangout.Audio catalog is empty or unexpectedly large.");
	return [...entries.values()];
}

export function hangoutGraphUrl(entry: HangoutEntry): string {
	const url = new URL(`https://graph.hangout.audio/${HANGOUT_COLLECTIONS[entry.collection].path}/`);
	url.searchParams.set("share", entry.file.replaceAll(" ", "_"));
	return url.href;
}

export function validateHangoutCatalog(value: unknown): HangoutCatalog {
	if (
		!record(value) ||
		typeof value.fetchedAt !== "string" ||
		!Number.isFinite(Date.parse(value.fetchedAt)) ||
		!Array.isArray(value.entries) ||
		!value.entries.length ||
		value.entries.length > 30000 ||
		!Array.isArray(value.warnings) ||
		!value.warnings.every((w) => typeof w === "string" && w.length < 500)
	)
		throw new Error("Invalid Hangout.Audio catalog response.");
	const entries = value.entries.map((entry) => {
		if (
			!record(entry) ||
			typeof entry.collection !== "string" ||
			!Object.hasOwn(HANGOUT_COLLECTIONS, entry.collection) ||
			!validHangoutFile(entry.file) ||
			typeof entry.id !== "string" ||
			entry.id.length >= 1000
		)
			throw new Error("Invalid Hangout.Audio measurement entry.");
		const collection = entry.collection as HangoutCollection,
			group = HANGOUT_COLLECTIONS[collection];
		if (!entry.id.startsWith(`${HANGOUT_SOURCE}/${group.rig} ${group.form}/`)) throw new Error("Invalid Hangout.Audio rig metadata.");
		return { id: entry.id, collection, file: entry.file };
	});
	if (new Set(entries.map((entry) => entry.id)).size !== entries.length) throw new Error("Duplicate Hangout.Audio measurement IDs.");
	return { fetchedAt: value.fetchedAt, entries, warnings: value.warnings as string[] };
}

/** Map the new source label to the existing AutoEq target compatibility metadata. */
export function targetMeasurementInfo(measurement: MeasurementInfo): MeasurementInfo {
	if (measurement.source !== HANGOUT_SOURCE) return measurement;
	const group = Object.values(HANGOUT_COLLECTIONS).find((g) => g.rig === measurement.rig && g.form === measurement.form);
	return group ? { source: "crinacle", form: group.form, rig: group.targetRig } : measurement;
}

/** Hangout averages amplitude, rather than averaging dB or summing stereo channels. */
export function averageHangoutChannels(curves: Curve[]): Curve {
	if (!curves.length) throw new Error("Hangout.Audio has no available channel measurements for this model.");
	const lo = Math.max(...curves.map((c) => c.frequency[0]));
	const hi = Math.min(...curves.map((c) => c.frequency.at(-1)!));
	if (lo >= hi) throw new Error("The channel measurements do not overlap.");
	let frequency = [...new Set(curves.flatMap((c) => c.frequency).filter((f) => f >= lo && f <= hi))].sort((a, b) => a - b);
	if (frequency.length > 20000) frequency = logFrequencies(4096, hi, lo);
	return validateCurve({ frequency, raw: frequency.map((f) => 20 * Math.log10(curves.reduce((sum, c) => sum + 10 ** (interpolate(c, f) / 20), 0) / curves.length)) });
}
