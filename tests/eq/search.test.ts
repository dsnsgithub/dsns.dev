import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { measurementInfo, type Catalog } from "../../src/lib/eq/data";
import { indexMeasurements, rigMatch, searchMeasurements } from "../../src/lib/eq/search";

const catalog: Catalog = JSON.parse(readFileSync(new URL("../../public/autoeq/catalog.json", import.meta.url), "utf8"));
const index = indexMeasurements(catalog.paths);
const ids = (query: string) => searchMeasurements(index, query).map((m) => m.id);

describe("measurement search", () => {
	it("finds the same models with or without punctuation and spaces", () => {
		assert.deepEqual(ids("HD650"), ids("hd-650"));
		assert.deepEqual(ids("hd650"), ids("HD 650"));
		assert.ok(ids("hd650").includes("oratory1990/over-ear/Sennheiser HD 650"));
		assert.ok(ids("wh1000xm5").includes("oratory1990/over-ear/Sony WH-1000XM5"));
		assert.ok(ids("air pods pro").some((id) => id.endsWith("/Apple AirPods Pro")));
	});
	it("tolerates brand typos and accents without guessing model numbers", () => {
		assert.deepEqual(ids("sennheisser hd650"), ids("Sennheiser HD650"));
		assert.deepEqual(ids("sennhieser hd650"), ids("Sennheiser HD650"));
		assert.deepEqual(ids("Sénnheiser HD650"), ids("Sennheiser HD650"));
		assert.equal(ids("sennheiser hd659").length, 0);
		assert.ok(
			ids("wh1000xm5").every((id) => id.includes("WH-1000XM5")),
			"a rig number (5128) must not match model number 5"
		);
	});
	it("ranks exact models ahead of variants and supports source / fit filters", () => {
		const matches = searchMeasurements(index, "HD650");
		assert.equal(matches[0].name, "Sennheiser HD 650");
		assert.ok(matches.at(-1)!.name.includes("balanced"));
		const filtered = searchMeasurements(index, "sennheiser", { source: "oratory1990", form: "over-ear" });
		assert.ok(filtered.length > 0);
		assert.ok(filtered.every((m) => m.source === "oratory1990" && m.form === "over-ear"));
		assert.ok(searchMeasurements(index, "rtings 5128").every((m) => m.source === "Rtings" && m.rig.includes("5128")));
	});
	it("does not truncate the result set at 100", () => {
		assert.equal(searchMeasurements(index, "").length, catalog.paths.length);
		assert.ok(searchMeasurements(index, "sennheiser").length > 100);
	});
});

describe("rig preference", () => {
	const paths = [
		"A/Other rig over-ear/Example Model",
		"B/Bruel & Kjaer 5128 over-ear/Example Model",
		"Rtings/Bruel & Kjaer 5128 over-ear/Example Model",
		"Rtings/Bruel & Kjaer 5128 in-ear/Example Model",
		"C/over-ear/Example Model",
		"Rtings/Bruel & Kjaer 5128 over-ear/Example Model Wireless"
	];
	const reference = measurementInfo("Rtings/Bruel & Kjaer 5128 over-ear/My Headphone");
	it("prefers the same rig, fit type, and source; preserves exact-model relevance", () => {
		const matches = searchMeasurements(indexMeasurements(paths), "example model", { reference });
		assert.equal(matches[0].id, paths[2]);
		assert.equal(matches[1].id, paths[1]);
		assert.equal(matches.at(-1)!.name, "Example Model Wireless");
		assert.equal(searchMeasurements(indexMeasurements(paths), "example model", { reference, rigPreference: "all" })[0].id, paths[0]);
	});
	it("offers a strict matching filter with honest unknown-rig handling", () => {
		const matches = searchMeasurements(indexMeasurements(paths), "", { reference, rigPreference: "only" });
		assert.deepEqual(new Set(matches.map((m) => m.id)), new Set([paths[1], paths[2], paths[5]]));
		const oratory = measurementInfo("oratory1990/over-ear/Sennheiser HD 650");
		assert.equal(rigMatch(oratory, measurementInfo("oratory1990/over-ear/Sennheiser HD 600")), "same-set");
		assert.equal(rigMatch(oratory, measurementInfo("Innerfidelity/over-ear/Sennheiser HD 600")), "unknown");
		assert.equal(rigMatch({ ...oratory, source: "Imported", form: "unknown" }, { ...oratory, source: "Imported", form: "unknown" }), "unknown");
		const fallback = searchMeasurements(index, "hd600", { reference: oratory });
		assert.equal(fallback[0].source, "oratory1990");
		assert.equal(fallback[0].match, "same-set");
	});
});
