import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	compatible,
	loadMeasurement,
	measurementInfo,
	measurementUrl,
	mergeCatalogs,
	recommendedTarget,
	validateMeasurement,
	type Catalog,
	type Measurement,
	type Target
} from "../../src/lib/eq/data";
import { averageHangoutChannels, HANGOUT_SOURCE, hangoutGraphUrl, parseHangoutBook, validateHangoutCatalog, type HangoutCatalog } from "../../src/lib/eq/hangout";
import { indexMeasurements, rigMatch, searchMeasurements } from "../../src/lib/eq/search";
import { DEFAULT_SESSION, validateSession } from "../../src/lib/eq/session";

const flat = { frequency: [20, 1000, 20000], raw: [0, 0, 0] };
const targets: Target[] = JSON.parse(readFileSync(new URL("../../public/autoeq/targets.json", import.meta.url), "utf8"));
const book = [{ name: "Truthear", phones: [{ name: "Hexa", file: "Hexa" }] }];
const entries = [...parseHangoutBook(book, "iem-711"), ...parseHangoutBook(book, "iem-5128"), ...parseHangoutBook([{ name: "Sennheiser", phones: [{ name: "HD660S" }] }], "headphones")];
const catalog: HangoutCatalog = { fetchedAt: "2026-11-06T00:00:00.000Z", entries, warnings: [] };
const measurement = (index: number): Measurement => ({ id: entries[index].id, ...measurementInfo(entries[index].id), curve: flat, channels: ["L", "R"], sourceUrl: hangoutGraphUrl(entries[index]) });

describe("Hangout catalogs", () => {
	it("retains pad variants, collaborations, and the scalar suffix that previously hid the 5128 collection", () => {
		const parsed = parseHangoutBook(
			[
				{ name: "Sennheiser", phones: [{ name: "HD650/HD6XX", file: ["HD650 fresh", "HD650 worn"], suffix: ["(Fresh pads)", "(Worn pads)"] }] },
				{
					name: "Samsung",
					phones: [
						{ name: "Galaxy Buds4 Pro", file: "Buds4 Pro", suffix: "(ANC on)" },
						{ name: "EO-IG955", collab: "AKG" }
					]
				},
				{ name: "Sony", phones: [{ name: "IER-Z1R", file: ["IER-Z1R S1", "IER-Z1R S2"], Suffix: ["(Sample 1)", "(Sample 2)"] }] }
			],
			"iem-5128"
		);
		assert.equal(parsed.length, 6);
		assert.equal(measurementInfo(parsed[0].id).name, "Sennheiser HD650/HD6XX (Fresh pads)");
		assert.equal(parsed[1].file, "HD650 worn");
		assert.equal(measurementInfo(parsed[2].id).name, "Samsung Galaxy Buds4 Pro (ANC on)");
		assert.equal(parsed[2].file, "Buds4 Pro");
		assert.equal(measurementInfo(parsed[3].id).name, "Samsung × AKG EO-IG955");
		assert.match(parsed[5].id, /Sony IER-Z1R \(Sample 2\)$/);
	});
	it("distinguishes unnamed variants and deduplicates repeated entries without dropping distinct files", () => {
		const parsed = parseHangoutBook(
			[
				{
					name: "Example",
					phones: [
						{ name: "Model", file: ["Model S1", "Model S2"] },
						{ name: "Model", file: ["Model S1", "Model S2"] },
						{ name: "Other", file: "Other S1" },
						{ name: "Other", file: "Other S2" }
					]
				}
			],
			"headphones"
		);
		assert.equal(parsed.length, 4);
		assert.equal(new Set(parsed.map((e) => e.id)).size, 4);
		assert.match(parsed[0].id, /\(Model S1\)$/);
		assert.deepEqual(
			parsed.map((e) => e.file),
			["Model S1", "Model S2", "Other S1", "Other S2"]
		);
	});
	it("rejects malformed and unsafe catalogs and mismatched rig metadata", () => {
		for (const file of ["../model", "folder/model", "folder\\model", "..", "", "model\nname"]) {
			assert.throws(() => parseHangoutBook([{ name: "Example", phones: [{ name: "Model", file }] }], "headphones"));
		}
		assert.throws(() => parseHangoutBook([], "headphones"));
		assert.throws(() => parseHangoutBook([{ name: "Example", phones: [{ name: "Model", suffix: { bad: true } }] }], "headphones"));
		assert.deepEqual(validateHangoutCatalog(catalog), catalog);
		assert.throws(() => validateHangoutCatalog({ ...catalog, entries: [entries[0], entries[0]] }));
		assert.throws(() => validateHangoutCatalog({ ...catalog, entries: [{ ...entries[0], collection: "iem-5128" }] }));
		assert.throws(() => validateHangoutCatalog({ ...catalog, entries: [{ ...entries[0], collection: "__proto__" }] }));
	});
	it("merges providers independently and routes only listed Hangout models through the local API", () => {
		const autoeq: Catalog = { revision: "a".repeat(40), date: "2025-07-20", paths: ["oratory1990/over-ear/Example"] };
		const merged = mergeCatalogs(autoeq, catalog)!;
		assert.deepEqual(merged.paths, [...autoeq.paths, ...entries.map((e) => e.id)]);
		assert.equal(mergeCatalogs(null, catalog)!.paths.length, 3);
		assert.deepEqual(mergeCatalogs(autoeq, null), autoeq);
		assert.equal(mergeCatalogs(null, null), null);
		const url = new URL(measurementUrl(merged, entries[1].id), "https://example.com");
		assert.equal(url.pathname, "/api/eq/hangout/measurement.json");
		assert.equal(url.searchParams.get("id"), entries[1].id);
		assert.ok(measurementUrl(merged, autoeq.paths[0]).includes(`/AutoEq/${autoeq.revision}/results/`));
		assert.throws(() => measurementUrl(merged, `${HANGOUT_SOURCE}/711 in-ear/Unlisted`));
		assert.throws(() => measurementUrl({ ...merged, hangout: undefined }, entries[0].id));
	});
	it("keeps rig-specific targets and prefers same-rig Crinacle results in search", () => {
		assert.equal(recommendedTarget(targets, measurement(0))!.label, "AutoEq in-ear");
		assert.equal(recommendedTarget(targets, measurement(1))!.label, "JM-1 with Harman filters");
		assert.equal(recommendedTarget(targets, measurement(2))!.label, "Harman over-ear 2018");
		assert.equal(compatible(targets.find((t) => t.label === "Harman in-ear 2019")!, measurement(1)), false);
		const index = indexMeasurements(entries.map((e) => e.id));
		assert.equal(searchMeasurements(index, "hexa", { reference: measurement(1) })[0].id, entries[1].id);
		assert.equal(searchMeasurements(index, "crinacle", { reference: measurement(0), rigPreference: "only" }).length, 1);
		assert.equal(rigMatch(measurement(0), measurement(1)), "different");
		assert.equal(rigMatch(measurement(1), { source: "HypetheSonics", rig: "Bruel & Kjaer 5128", form: "in-ear" }), "different");
	});
	it("preserves curves and provenance through offline setup export and import", () => {
		const session = { ...DEFAULT_SESSION, headphone: measurement(0), targetHeadphone: measurement(1), targetMode: "headphone" as const };
		assert.deepEqual(validateSession(JSON.parse(JSON.stringify(session))), session);
		const variant = { ...entries[2], file: "HD650 S2 (2020) (fresh pads)" };
		assert.equal(new URL(hangoutGraphUrl(variant)).searchParams.get("share"), "HD650_S2_(2020)_(fresh_pads)");
		assert.throws(() => validateMeasurement({ ...measurement(0), sourceUrl: "javascript:alert(1)" }));
		assert.throws(() => validateMeasurement({ ...measurement(0), channels: ["invented"] }));
	});
});

describe("Hangout channel averaging", () => {
	it("averages amplitude, not dB or stereo power, and leaves a single channel's level unchanged", () => {
		const louder = { ...flat, raw: [20, 20, 20] };
		const average = averageHangoutChannels([flat, louder]);
		assert.ok(average.raw.every((db) => Math.abs(db - 20 * Math.log10(5.5)) < 1e-10));
		assert.deepEqual(averageHangoutChannels([louder]), louder);
	});
	it("interpolates different grids in log frequency over their shared measured coverage", () => {
		const average = averageHangoutChannels([
			{ frequency: [20, 200, 2000, 20000], raw: [0, 20, 40, 60] },
			{ frequency: [100, 1000, 10000, 30000], raw: [0, 0, 0, 0] }
		]);
		assert.deepEqual(average.frequency, [100, 200, 1000, 2000, 10000, 20000]);
		assert.ok(Math.abs(average.raw[0] - 20 * Math.log10(3)) < 1e-10);
		assert.ok(Math.abs(average.raw[3] - 20 * Math.log10(50.5)) < 1e-10);
		assert.throws(() => averageHangoutChannels([]));
		assert.throws(() =>
			averageHangoutChannels([
				{ frequency: [20, 100], raw: [0, 0] },
				{ frequency: [1000, 20000], raw: [0, 0] }
			])
		);
	});
});

describe("browser measurement loading", () => {
	it("loads and caches Hangout JSON while retaining the AutoEq raw CSV path", async () => {
		const originalFetch = globalThis.fetch;
		const merged = mergeCatalogs({ revision: "b".repeat(40), date: "", paths: ["oratory1990/over-ear/Loader example"] }, catalog)!;
		const urls: string[] = [];
		globalThis.fetch = (async (input) => {
			urls.push(String(input));
			return String(input).startsWith("/api/") ? Response.json(measurement(0)) : new Response("frequency,equalized,raw\n20,90,1\n1000,90,2\n20000,90,3");
		}) as typeof fetch;
		try {
			assert.deepEqual(await loadMeasurement(merged, entries[0].id), measurement(0));
			await loadMeasurement(merged, entries[0].id);
			const autoeq = await loadMeasurement(merged, merged.paths[0]);
			assert.deepEqual(autoeq.curve.raw, [1, 2, 3]);
			assert.equal(urls.length, 2);
			assert.ok(urls[0].startsWith("/api/eq/hangout/measurement.json?"));
			assert.ok(urls[1].startsWith("https://raw.githubusercontent.com/jaakkopasanen/AutoEq/"));
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
	it("rejects mismatched responses and surfaces upstream errors without caching them", async () => {
		const originalFetch = globalThis.fetch;
		const merged = mergeCatalogs(null, catalog)!;
		try {
			globalThis.fetch = (async () => Response.json(measurement(0))) as typeof fetch;
			await assert.rejects(loadMeasurement(merged, entries[1].id), /did not match/);
			globalThis.fetch = (async () => Response.json({ error: "Hangout.Audio is unavailable; retry later." }, { status: 503 })) as typeof fetch;
			await assert.rejects(loadMeasurement(merged, entries[1].id), /Hangout.Audio is unavailable/);
			globalThis.fetch = (async () => Response.json(measurement(1))) as typeof fetch;
			assert.deepEqual(await loadMeasurement(merged, entries[1].id), measurement(1));
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
