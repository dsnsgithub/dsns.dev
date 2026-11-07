import { createDecipheriv, createHash, randomUUID } from "node:crypto";
import { measurementInfo, type Measurement } from "./data";
import { parseCurve, type Curve } from "./dsp";
import { averageHangoutChannels, HANGOUT_COLLECTIONS, hangoutGraphUrl, parseHangoutBook, type HangoutCatalog, type HangoutCollection, type HangoutEntry } from "./hangout";

export class HangoutError extends Error {
	constructor(
		message: string,
		readonly status = 502
	) {
		super(message);
	}
}

/** Decode the public EQ tool's CryptoJS envelope using the nonce sent with that request.
 * MD5 here is the upstream EVP_BytesToKey wire format, not a new password scheme.
 * Protocol: https://eq.hangout.audio/graphtool.js (getFileData).
 */
export function decodeHangoutResponse(body: string, nonce: string): string | null {
	try {
		const envelope = JSON.parse(body);
		if (!envelope || typeof envelope.ct !== "string" || !/^[a-f0-9]{16}$/i.test(envelope.s)) throw new Error("Invalid envelope");
		const salt = Buffer.from(envelope.s, "hex");
		let material = Buffer.alloc(0),
			block = Buffer.alloc(0);
		while (material.length < 48) {
			block = createHash("md5")
				.update(Buffer.concat([block, Buffer.from(nonce), salt]))
				.digest();
			material = Buffer.concat([material, block]);
		}
		const decipher = createDecipheriv("aes-256-cbc", material.subarray(0, 32), material.subarray(32, 48));
		const decoded: unknown = JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ct, "base64")), decipher.final()]).toString("utf8"));
		if (decoded !== null && typeof decoded !== "string") throw new Error("Invalid response");
		return decoded;
	} catch {
		throw new HangoutError("Hangout.Audio returned an unreadable measurement. Its data interface may have changed.");
	}
}

const HOUR = 60 * 60 * 1000;
type ChannelData = { curve: Curve; channels: string[] };

/** Per-process caches complement the endpoint's CDN cache; only selected curves are fetched. */
export function createHangoutClient(fetcher: typeof fetch = fetch, now = Date.now) {
	let catalogCache: { until: number; value: HangoutCatalog } | undefined;
	let catalogPending: Promise<HangoutCatalog> | undefined;
	const curveCache = new Map<string, { until: number; value: ChannelData }>();
	const pendingCurves = new Map<string, Promise<ChannelData>>();
	const upstream = async (url: string, options: RequestInit = {}) => {
		try {
			const response = await fetcher(url, { ...options, signal: AbortSignal.timeout(12000), redirect: "error" });
			if (!response.ok) throw new HangoutError(`Hangout.Audio could not serve this data (HTTP ${response.status}). Try again later or import a measurement.`);
			const text = await response.text();
			if (!text || text.length > 2_000_000) throw new HangoutError("Hangout.Audio returned an empty or oversized response.");
			return text;
		} catch (error) {
			if (error instanceof HangoutError) throw error;
			throw new HangoutError("Could not reach Hangout.Audio. Try again later or import a measurement.", 503);
		}
	};

	const catalog = async (): Promise<HangoutCatalog> => {
		if (catalogCache && catalogCache.until > now()) return catalogCache.value;
		if (catalogPending) return catalogPending;
		catalogPending = (async () => {
			const collections = Object.keys(HANGOUT_COLLECTIONS) as HangoutCollection[];
			const results = await Promise.allSettled(
				collections.map(async (collection) => {
					const book = JSON.parse(await upstream(`https://graph.hangout.audio/${HANGOUT_COLLECTIONS[collection].path}/data/phone_book.json`));
					return parseHangoutBook(book, collection);
				})
			);
			const entries: HangoutEntry[] = [],
				warnings: string[] = [];
			results.forEach((result, i) => {
				if (result.status === "fulfilled") entries.push(...result.value);
				else {
					const previous = catalogCache?.value.entries.filter((entry) => entry.collection === collections[i]) ?? [];
					entries.push(...previous);
					warnings.push(`${HANGOUT_COLLECTIONS[collections[i]].rig}: ${previous.length ? "using the last cached catalog" : "catalog temporarily unavailable"}.`);
				}
			});
			if (!entries.length) throw new HangoutError("Hangout.Audio's measurement catalogs are temporarily unavailable. AutoEq measurements are still available.", 503);
			const value = { fetchedAt: new Date(now()).toISOString(), entries, warnings };
			catalogCache = { value, until: now() + (warnings.length ? 60_000 : HOUR) };
			return value;
		})();
		try {
			return await catalogPending;
		} finally {
			catalogPending = undefined;
		}
	};

	const channels = async (entry: HangoutEntry): Promise<ChannelData> => {
		const key = `${entry.collection}:${entry.file}`;
		const cached = curveCache.get(key);
		if (cached && cached.until > now()) return cached.value;
		const pending = pendingCurves.get(key);
		if (pending) return pending;
		const promise = (async () => {
			const group = HANGOUT_COLLECTIONS[entry.collection];
			const measurements = await Promise.all(
				group.channels.map(async (channel) => {
					const nonce = randomUUID();
					// The current public EQ tool uses this origin and a doubly encoded form field.
					const body = await upstream("https://graph.hangout.audio/d-c.php", {
						method: "POST",
						headers: { Origin: "https://eq.hangout.audio", Referer: "https://eq.hangout.audio/", "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
						body: new URLSearchParams({ f_p: encodeURIComponent(`${group.path}/data/${entry.file} ${channel}.txt`), k: nonce })
					});
					const text = decodeHangoutResponse(body, nonce);
					if (text === null) return null; // Upstream explicitly marks an unavailable sample.
					try {
						return { channel, curve: parseCurve(text) };
					} catch {
						throw new HangoutError(`Hangout.Audio returned invalid ${channel} measurement data for this model.`);
					}
				})
			);
			const available = measurements.filter((m): m is NonNullable<typeof m> => m !== null);
			if (!available.length) throw new HangoutError("This model is in Hangout.Audio's catalog, but its channel measurements are unavailable.", 404);
			const value = { curve: averageHangoutChannels(available.map((m) => m.curve)), channels: available.map((m) => m.channel) };
			curveCache.delete(key);
			curveCache.set(key, { until: now() + 24 * HOUR, value });
			while (curveCache.size > 64) curveCache.delete(curveCache.keys().next().value!);
			return value;
		})();
		pendingCurves.set(key, promise);
		try {
			return await promise;
		} finally {
			pendingCurves.delete(key);
		}
	};

	const measurement = async (id: string): Promise<Measurement> => {
		if (!id || id.length >= 1000) throw new HangoutError("Choose a measurement from the Hangout.Audio catalog.", 400);
		const entry = (await catalog()).entries.find((candidate) => candidate.id === id);
		if (!entry) throw new HangoutError("This measurement is no longer listed in Hangout.Audio's catalog. Refresh the catalog and try again.", 404);
		return { ...measurementInfo(entry.id), id, ...(await channels(entry)), sourceUrl: hangoutGraphUrl(entry) };
	};
	return { catalog, measurement };
}

export const hangoutClient = createHangoutClient();

export function hangoutFailure(error: unknown): Response {
	return Response.json(
		{ error: error instanceof HangoutError ? error.message : "Could not load Hangout.Audio data. Try again later." },
		{
			status: error instanceof HangoutError ? error.status : 502,
			headers: { "Cache-Control": "no-store" }
		}
	);
}
