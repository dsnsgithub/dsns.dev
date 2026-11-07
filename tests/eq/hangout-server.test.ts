import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createCipheriv, createHash } from "node:crypto";
import { createHangoutClient, decodeHangoutResponse, HangoutError, hangoutFailure } from "../../src/lib/eq/hangout-server";
import { HANGOUT_COLLECTIONS, type HangoutCollection } from "../../src/lib/eq/hangout";
import { GET as measurementGET } from "../../src/pages/api/eq/hangout/measurement.json";

// Independent OpenSSL-generated vectors: enc -aes-256-cbc -md md5 -S 0102030405060708.
const vector = { s: "0102030405060708", ct: "Zf8hpbcOOj1tIk3RTahAEFQ6E/Bp01XDsk25xHISarG6eBB1X/DmoqAmSm01sqWJ" };
const nonce = "hangout-protocol-fixture";
const fixtureText = "* REW measurement\n20,60\n1000,70\n20000,55\n";
const hour = 60 * 60 * 1000;

function envelope(value: unknown, password: string) {
	const salt = Buffer.from(vector.s, "hex");
	const seed = Buffer.concat([Buffer.from(password), salt]);
	const md5 = (value: Buffer) => createHash("md5").update(value).digest();
	const d1 = md5(seed),
		d2 = md5(Buffer.concat([d1, seed])),
		d3 = md5(Buffer.concat([d2, seed]));
	const cipher = createCipheriv("aes-256-cbc", Buffer.concat([d1, d2]), d3);
	return JSON.stringify({ s: vector.s, ct: Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]).toString("base64") });
}

function mockUpstream() {
	const failures = new Set<HangoutCollection>();
	const catalogCalls: string[] = [],
		channelCalls: string[] = [];
	const passwords = new Set<string>();
	const mock = {
		failures,
		catalogCalls,
		channelCalls,
		passwords,
		reply: (channel: string, _path: string): string | null | Response => `* REW\n20,${channel.startsWith("L") ? 0 : 20}\n1000,10\n20000,5`
	};
	const fetcher = (async (input: RequestInfo | URL, options?: RequestInit) => {
		const url = String(input);
		assert.equal(options?.redirect, "error");
		assert.ok(options?.signal instanceof AbortSignal);
		if (url.endsWith("/phone_book.json")) {
			catalogCalls.push(url);
			const collection = (Object.entries(HANGOUT_COLLECTIONS) as [HangoutCollection, (typeof HANGOUT_COLLECTIONS)[HangoutCollection]][]).find(
				([, group]) => url === `https://graph.hangout.audio/${group.path}/data/phone_book.json`
			)?.[0];
			assert.ok(collection, `Unexpected upstream URL: ${url}`);
			return failures.has(collection) ? new Response("Unavailable", { status: 503 }) : Response.json([{ name: "Example", phones: [{ name: "Model", file: "Model S2 (fresh pads)" }] }]);
		}
		assert.equal(url, "https://graph.hangout.audio/d-c.php");
		assert.equal(options?.method, "POST");
		const headers = new Headers(options?.headers);
		assert.equal(headers.get("Origin"), "https://eq.hangout.audio");
		assert.equal(headers.get("Referer"), "https://eq.hangout.audio/");
		assert.match(headers.get("Content-Type")!, /application\/x-www-form-urlencoded/);
		const fields = new URLSearchParams(String(options?.body));
		assert.match(fields.get("f_p")!, /%2Fdata%2FModel%20S2%20\(fresh%20pads\)%20/);
		const path = decodeURIComponent(fields.get("f_p")!);
		channelCalls.push(path);
		const key = fields.get("k")!;
		assert.ok(key && !passwords.has(key), "Each channel request should use a fresh nonce");
		passwords.add(key);
		const channel = path.match(/ ([LR][1-3]?)\.txt$/)![1];
		const result = mock.reply(channel, path);
		return result instanceof Response ? result : new Response(envelope(result, key));
	}) as typeof fetch;
	return {
		...mock,
		fetcher,
		setReply: (reply: typeof mock.reply) => {
			mock.reply = reply;
		}
	};
}

describe("Hangout public measurement protocol", () => {
	it("decodes independently generated OpenSSL text and missing-sample vectors", () => {
		assert.equal(decodeHangoutResponse(JSON.stringify(vector), nonce), fixtureText);
		assert.equal(decodeHangoutResponse(JSON.stringify({ ...vector, ct: "40lu7MF09AtDAa+Kfi2SLQ==" }), nonce), null);
	});
	it("rejects changed, corrupted, or unexpected responses instead of interpreting them as missing channels", () => {
		for (const body of ["", "<html>blocked</html>", "null", "{}", JSON.stringify({ ...vector, s: "bad" }), JSON.stringify({ ...vector, ct: "invalid" }), envelope({ error: "missing" }, nonce)]) {
			assert.throws(() => decodeHangoutResponse(body, nonce), /unreadable measurement/);
		}
		assert.throws(() => decodeHangoutResponse(JSON.stringify(vector), "wrong-request-nonce"), /unreadable measurement/);
	});
});

describe("Hangout server client", () => {
	it("deduplicates concurrent requests and honors separate catalog and curve cache lifetimes", async () => {
		const upstream = mockUpstream();
		let time = 0;
		const client = createHangoutClient(upstream.fetcher, () => time);
		const [first, second] = await Promise.all([client.catalog(), client.catalog()]);
		assert.deepEqual(first, second);
		assert.equal(first.entries.length, 3);
		assert.equal(upstream.catalogCalls.length, 3);
		const entry = first.entries.find((e) => e.collection === "iem-5128")!;
		const [left, right] = await Promise.all([client.measurement(entry.id), client.measurement(entry.id)]);
		assert.deepEqual(left, right);
		assert.equal(upstream.channelCalls.length, 2);
		assert.deepEqual(left.channels, ["L", "R"]);
		assert.equal(left.rig, "Bruel & Kjaer 4620 (5128)");
		assert.ok(Math.abs(left.curve.raw[0] - 20 * Math.log10(5.5)) < 1e-10);
		time += hour + 1;
		await client.measurement(entry.id);
		assert.equal(upstream.catalogCalls.length, 6);
		assert.equal(upstream.channelCalls.length, 2);
		time += 24 * hour;
		await client.measurement(entry.id);
		assert.equal(upstream.catalogCalls.length, 9);
		assert.equal(upstream.channelCalls.length, 4);
	});
	it("loads six headphone samples and averages only explicitly available channels", async () => {
		const upstream = mockUpstream();
		upstream.setReply((channel) => (channel === "L1" || channel === "R1" ? fixtureText : null));
		const client = createHangoutClient(upstream.fetcher);
		const entry = (await client.catalog()).entries.find((e) => e.collection === "headphones")!;
		const result = await client.measurement(entry.id);
		assert.equal(upstream.channelCalls.length, 6);
		assert.ok(upstream.channelCalls.every((path) => path.startsWith("headphones/data/")));
		assert.deepEqual(result.channels, ["L1", "R1"]);
		assert.deepEqual(result.curve, { frequency: [20, 1000, 20000], raw: [60, 70, 55] });
		assert.equal(new URL(result.sourceUrl!).searchParams.get("share"), "Model_S2_(fresh_pads)");
	});
	it("reports unavailable samples and retries them instead of caching an empty curve", async () => {
		const upstream = mockUpstream();
		upstream.setReply(() => null);
		const client = createHangoutClient(upstream.fetcher);
		const entry = (await client.catalog()).entries.find((e) => e.collection === "iem-711")!;
		await assert.rejects(client.measurement(entry.id), (error: unknown) => error instanceof HangoutError && error.status === 404);
		upstream.setReply((channel) => (channel === "L" ? fixtureText : null));
		const result = await client.measurement(entry.id);
		assert.deepEqual(result.channels, ["L"]);
		assert.equal(upstream.channelCalls.length, 4);
	});
	it("fails the whole measurement on network, decoding, or invalid-data errors, then allows retry", async () => {
		const upstream = mockUpstream();
		const client = createHangoutClient(upstream.fetcher);
		const entry = (await client.catalog()).entries.find((e) => e.collection === "iem-711")!;
		for (const failure of [new Response("Down", { status: 503 }), new Response("not an envelope"), "20,0\n1000,0", ""]) {
			upstream.setReply((channel) => (channel === "R" ? failure : fixtureText));
			await assert.rejects(client.measurement(entry.id), HangoutError);
		}
		upstream.setReply(() => fixtureText);
		assert.deepEqual((await client.measurement(entry.id)).channels, ["L", "R"]);
		assert.equal(upstream.channelCalls.length, 10);
	});
	it("keeps healthy collections on partial outages, retries after one minute, and retains stale catalogs", async () => {
		const upstream = mockUpstream();
		upstream.failures.add("iem-5128");
		let time = 0;
		const client = createHangoutClient(upstream.fetcher, () => time);
		const partial = await client.catalog();
		assert.equal(partial.entries.length, 2);
		assert.match(partial.warnings[0], /4620.*temporarily unavailable/);
		await client.catalog();
		assert.equal(upstream.catalogCalls.length, 3);
		upstream.failures.clear();
		time += 60_001;
		const complete = await client.catalog();
		assert.equal(complete.entries.length, 3);
		assert.deepEqual(complete.warnings, []);
		for (const collection of Object.keys(HANGOUT_COLLECTIONS) as HangoutCollection[]) upstream.failures.add(collection);
		time += hour + 1;
		const stale = await client.catalog();
		assert.deepEqual(stale.entries, complete.entries);
		assert.equal(stale.warnings.length, 3);
		assert.ok(stale.warnings.every((warning) => warning.includes("last cached catalog")));
	});
	it("returns a recoverable error when all catalogs fail and never fetches unlisted curves", async () => {
		const upstream = mockUpstream();
		for (const collection of Object.keys(HANGOUT_COLLECTIONS) as HangoutCollection[]) upstream.failures.add(collection);
		const client = createHangoutClient(upstream.fetcher);
		await assert.rejects(client.catalog(), (error: unknown) => error instanceof HangoutError && error.status === 503);
		upstream.failures.clear();
		const catalog = await client.catalog();
		await assert.rejects(client.measurement(`${catalog.entries[0].id} /../../secret`), (error: unknown) => error instanceof HangoutError && error.status === 404);
		await assert.rejects(client.measurement("https://example.com/secret"), HangoutError);
		await assert.rejects(client.measurement(""), (error: unknown) => error instanceof HangoutError && error.status === 400);
		assert.equal(upstream.channelCalls.length, 0);
	});
});

describe("Hangout HTTP errors", () => {
	it("returns JSON with no-store for a missing measurement ID and hides internal errors", async () => {
		const response = await measurementGET({ url: new URL("https://example.com/api/eq/hangout/measurement.json") } as Parameters<typeof measurementGET>[0]);
		assert.equal(response.status, 400);
		assert.equal(response.headers.get("Cache-Control"), "no-store");
		assert.deepEqual(await response.json(), { error: "A measurement ID is required." });
		const internal = hangoutFailure(new Error("internal stack / file path"));
		assert.equal(internal.status, 502);
		assert.ok(!(await internal.text()).includes("internal stack"));
	});
});
