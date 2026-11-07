import { measurementInfo, type MeasurementInfo } from "./data";

export type RigPreference = "prefer" | "only" | "all";
export type RigMatch = "same-rig-source" | "same-rig" | "same-set" | "unknown" | "different";

// Blank rig fields are not evidence that two measurements used the same rig.
export function rigMatch(source: MeasurementInfo, target: MeasurementInfo): RigMatch {
	if (source.form === "unknown" || target.form === "unknown" || source.source === "Imported" || target.source === "Imported") return "unknown";
	if (source.form !== target.form) return "different";
	if (source.rig && target.rig) {
		if (searchText(source.rig) !== searchText(target.rig)) return "different";
		return source.source === target.source ? "same-rig-source" : "same-rig";
	}
	if (!source.rig && !target.rig && source.source === target.source) return "same-set";
	return "unknown";
}

export const RIG_LABELS: Record<RigMatch, string> = {
	"same-rig-source": "Same rig & source",
	"same-rig": "Same rig · different source",
	"same-set": "Same set · rig unspecified",
	unknown: "Rig match unverified",
	different: "Different rig / fit type"
};
const rigRank: Record<RigMatch, number> = { "same-rig-source": 0, "same-rig": 1, "same-set": 2, unknown: 3, different: 4 };

/** Treat HD650, HD-650 and HD 650 alike, without guessing different model numbers. */
export function searchText(text: string): string {
	return text
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/([a-z])(\d)/g, "$1 $2")
		.replace(/(\d)([a-z])/g, "$1 $2")
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

interface SearchEntry extends MeasurementInfo {
	id: string;
	name: string;
	model: string;
	compact: string;
	words: string[];
	metadata: string[];
}

export function indexMeasurements(paths: string[]): SearchEntry[] {
	return paths.map((id) => {
		const info = measurementInfo(id),
			model = searchText(info.name);
		return { id, ...info, model, compact: model.replaceAll(" ", ""), words: model.split(" "), metadata: searchText(`${info.source} ${info.rig} ${info.form}`).split(" ") };
	});
}

function oneTypo(a: string, b: string): boolean {
	if (a.length < 4 || b.length < 4 || /\d/.test(a + b) || Math.abs(a.length - b.length) > 1) return false;
	let i = 0;
	while (i < a.length && a[i] === b[i]) i++;
	if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
	return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

export interface SearchOptions {
	reference?: MeasurementInfo | null;
	rigPreference?: RigPreference;
	source?: string;
	form?: string;
}

export function searchMeasurements(index: SearchEntry[], query: string, options: SearchOptions = {}) {
	const normalized = searchText(query),
		terms = normalized.split(" ").filter(Boolean),
		compact = normalized.replaceAll(" ", "");
	return index
		.flatMap((entry) => {
			if ((options.source && options.source !== entry.source) || (options.form && options.form !== entry.form)) return [];
			const match = options.reference ? rigMatch(options.reference, entry) : null;
			if (options.rigPreference === "only" && match && rigRank[match] > 2) return [];
			const compactMatch = compact.length > 0 && entry.compact.includes(compact);
			let score = 0;
			for (const term of terms) {
				if (entry.words.includes(term)) continue;
				if (entry.words.some((w) => w.startsWith(term))) {
					score += 2;
					continue;
				}
				if (compactMatch) {
					score += 2;
					continue;
				}
				if (entry.metadata.some((word) => word === term || (!/\d/.test(term) && word.startsWith(term)))) {
					score += 8;
					continue;
				}
				if (entry.words.some((w) => oneTypo(term, w))) {
					score += 20;
					continue;
				}
				return [];
			}
			// Exact names / model suffixes outrank variants, even if a variant has a better rig match.
			if (compact && (entry.compact === compact || entry.model.endsWith(` ${normalized}`) || (compactMatch && entry.compact.endsWith(compact)))) score -= 5;
			return [{ ...entry, match, score }];
		})
		.sort(
			(a, b) =>
				a.score - b.score ||
				(options.rigPreference !== "all" && a.match && b.match ? rigRank[a.match] - rigRank[b.match] : 0) ||
				a.name.localeCompare(b.name, undefined, { numeric: true }) ||
				a.id.localeCompare(b.id)
		);
}
