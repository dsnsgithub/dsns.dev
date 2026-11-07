import { parseCurve, validateCurve, type Curve } from "./dsp";
import { HANGOUT_SOURCE, targetMeasurementInfo, type HangoutCatalog } from "./hangout";

export interface Catalog {
	revision: string;
	date: string;
	paths: string[];
	hangout?: HangoutCatalog;
}
export interface MeasurementInfo {
	source: string;
	form: string;
	rig: string;
}
export interface Measurement extends MeasurementInfo {
	id: string;
	name: string;
	curve: Curve;
	sourceUrl?: string;
	channels?: string[];
}
interface Compatibility {
	source: string;
	form: string;
	rig?: string;
}
export interface Target {
	label: string;
	compatible: Compatibility[];
	recommended: Compatibility[];
	bassBoost: { fc: number; q: number; gain: number };
	fr: Curve;
}

export function measurementInfo(path: string): MeasurementInfo & { name: string } {
	const [source, group, ...rest] = path.split("/");
	const form = group.match(/(?:in-ear|over-ear|earbud)$/)?.[0] ?? "unknown";
	return { source, form, rig: group.replace(/\s*(in-ear|over-ear|earbud)$/, ""), name: rest.join("/") };
}

export function measurementLabel(path: string): string {
	const m = measurementInfo(path);
	return `${m.name} · ${m.source} · ${m.rig || m.form}`;
}

export function compatible(target: Target, measurement: Measurement): boolean {
	const info = targetMeasurementInfo(measurement);
	return target.compatible.some((c) => c.source === info.source && c.form === info.form && (!c.rig || c.rig === info.rig));
}

export function recommendedTarget(targets: Target[], measurement: Measurement): Target | undefined {
	const info = targetMeasurementInfo(measurement);
	return targets.find((t) => t.recommended.some((c) => c.source === info.source && c.form === info.form && (!c.rig || c.rig === info.rig))) ?? targets.find((t) => compatible(t, measurement));
}

export function mergeCatalogs(autoeq: Catalog | null, hangout: HangoutCatalog | null): Catalog | null {
	if (!autoeq && !hangout) return null;
	return {
		revision: autoeq?.revision ?? "",
		date: autoeq?.date ?? "",
		paths: [...new Set([...(autoeq?.paths ?? []), ...(hangout?.entries.map((entry) => entry.id) ?? [])])],
		...(hangout ? { hangout } : {})
	};
}

export function measurementUrl(catalog: Catalog, id: string): string {
	if (!catalog.paths.includes(id)) throw new Error("This measurement is not in the catalog.");
	if (id.startsWith(`${HANGOUT_SOURCE}/`)) {
		if (!catalog.hangout?.entries.some((entry) => entry.id === id)) throw new Error("This measurement is not in the Hangout.Audio catalog.");
		return `/api/eq/hangout/measurement.json?${new URLSearchParams({ id })}`;
	}
	const encoded = id.split("/").map(encodeURIComponent).join("/");
	return `https://raw.githubusercontent.com/jaakkopasanen/AutoEq/${catalog.revision}/results/${encoded}/${encodeURIComponent(measurementInfo(id).name)}.csv`;
}

export async function fetchText(url: string, signal?: AbortSignal, timeoutMs = 15000): Promise<string> {
	const timeout = AbortSignal.timeout(timeoutMs);
	const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
	if (!response.ok) {
		const body = await response.json().catch(() => null);
		throw new Error(typeof body?.error === "string" && body.error.length < 500 ? body.error : `Could not load measurement data (${response.status}). Try again or import a CSV.`);
	}
	return response.text();
}

const cache = new Map<string, Measurement>();
export async function loadMeasurement(catalog: Catalog, id: string, signal?: AbortSignal): Promise<Measurement> {
	if (!catalog.paths.includes(id)) throw new Error("Choose a measurement from the catalog.");
	const isHangout = id.startsWith(`${HANGOUT_SOURCE}/`);
	const key = `${isHangout ? catalog.hangout?.fetchedAt : catalog.revision}:${id}`;
	const cached = cache.get(key);
	if (cached) return cached;
	const url = id === "oratory1990/over-ear/Sennheiser HD 650" ? "/autoeq/sennheiser-hd-650.csv" : measurementUrl(catalog, id);
	const text = await fetchText(url, signal, isHangout ? 30000 : 15000);
	const measurement = isHangout ? validateMeasurement(JSON.parse(text)) : { ...measurementInfo(id), id, curve: parseCurve(text) };
	if (!measurement || measurement.id !== id) throw new Error("The measurement response did not match the selected model.");
	cache.set(key, measurement);
	return measurement;
}

export function validateMeasurement(value: unknown): Measurement | null {
	if (value === null || value === undefined) return null;
	const m = value as Measurement;
	if (![m.id, m.name, m.source, m.form, m.rig].every((s) => typeof s === "string" && s.length < 1000)) throw new Error("Invalid measurement metadata.");
	if (m.sourceUrl !== undefined && (typeof m.sourceUrl !== "string" || m.sourceUrl.length > 2000 || !/^https:\/\/graph\.hangout\.audio\/(headphones|iem\/711|iem\/5128)\/\?share=/.test(m.sourceUrl)))
		throw new Error("Invalid measurement source link.");
	if (m.channels !== undefined && (!Array.isArray(m.channels) || !m.channels.length || m.channels.length > 6 || !m.channels.every((c) => /^(L|R)[1-3]?$/.test(c))))
		throw new Error("Invalid measurement channels.");
	return {
		id: m.id,
		name: m.name,
		source: m.source,
		form: m.form,
		rig: m.rig,
		curve: validateCurve(m.curve),
		...(m.sourceUrl ? { sourceUrl: m.sourceUrl } : {}),
		...(m.channels ? { channels: [...m.channels] } : {})
	};
}
