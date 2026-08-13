import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useEffect, useRef, useState } from "react";

interface Geo {
	ip: string;
	success: boolean;
	message?: string;
	type?: string;
	continent?: string;
	country?: string;
	country_code?: string;
	region?: string;
	city?: string;
	postal?: string;
	latitude?: number;
	longitude?: number;
	flag?: { emoji?: string };
	connection?: { asn?: number; org?: string; isp?: string; domain?: string };
	timezone?: { id?: string; utc?: string };
}

interface Resolver {
	ip: string;
	geo?: Geo | null;
	ptr?: string | null;
	loading: boolean;
}

interface Detection {
	ip: string | null;
	done: boolean;
}

// Number of unique subdomains to resolve. Every lookup is answered by ipleak's
// authoritative nameserver, which records whichever resolver asked for it.
const DNS_ROUNDS = 6;
const MAX_RESOLVERS = 16;

/* -------------------------------------------------------------------------- */
/*                                   helpers                                  */
/* -------------------------------------------------------------------------- */

const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

// Expands an IPv6 address to its 32 nibbles, or null if it isn't valid.
function ipv6Nibbles(ip: string): string | null {
	if (!ip.includes(":")) return null;

	const halves = ip.split("::");
	if (halves.length > 2) return null;

	const head = halves[0] ? halves[0].split(":") : [];
	const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];

	let groups: string[];
	if (halves.length === 2) {
		const missing = 8 - head.length - tail.length;
		if (missing < 0) return null;
		groups = [...head, ...Array(missing).fill("0"), ...tail];
	} else {
		groups = ip.split(":");
	}

	if (groups.length !== 8) return null;

	const hex = groups.map((group) => group.padStart(4, "0")).join("");
	if (!/^[0-9a-f]{32}$/i.test(hex)) return null;

	return hex.toLowerCase();
}

function isIP(value: string) {
	return IPV4_RE.test(value) || ipv6Nibbles(value) !== null;
}

// The .arpa zone whose PTR record holds the reverse DNS name for an IP.
function reverseZone(ip: string): string | null {
	if (IPV4_RE.test(ip)) return ip.split(".").reverse().join(".") + ".in-addr.arpa";

	const nibbles = ipv6Nibbles(ip);
	if (!nibbles) return null;

	return nibbles.split("").reverse().join(".") + ".ip6.arpa";
}

async function fetchWithTimeout(url: string, ms: number, init?: RequestInit) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), ms);

	try {
		return await fetch(url, { ...init, signal: controller.signal });
	} finally {
		clearTimeout(timeout);
	}
}

// Keeps concurrent lookups low so we stay well inside the free API rate limits.
function createQueue(limit: number) {
	let active = 0;
	const waiting: (() => void)[] = [];

	const release = () => {
		active--;
		waiting.shift()?.();
	};

	return function enqueue<T>(task: () => Promise<T>): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			const start = () => {
				active++;
				task().then(resolve, reject).finally(release);
			};

			if (active < limit) start();
			else waiting.push(start);
		});
	};
}

const queue = createQueue(4);
const geoCache = new Map<string, Promise<Geo | null>>();
const ptrCache = new Map<string, Promise<string | null>>();

function lookupGeo(ip: string): Promise<Geo | null> {
	const cached = geoCache.get(ip);
	if (cached) return cached;

	const request = queue(async () => {
		try {
			const response = await fetchWithTimeout(`https://ipwho.is/${encodeURIComponent(ip)}`, 10000);
			return (await response.json()) as Geo;
		} catch {
			// Don't cache a transient failure, so a retry can still succeed.
			geoCache.delete(ip);
			return null;
		}
	});

	geoCache.set(ip, request);
	return request;
}

function lookupPtr(ip: string): Promise<string | null> {
	const cached = ptrCache.get(ip);
	if (cached) return cached;

	const request = queue(async () => {
		const zone = reverseZone(ip);
		if (!zone) return null;

		try {
			const response = await fetchWithTimeout(`https://cloudflare-dns.com/dns-query?name=${zone}&type=PTR`, 8000, { headers: { accept: "application/dns-json" } });
			const data = await response.json();
			const answer = data?.Answer?.find((record: { type: number }) => record.type === 12);
			return answer?.data ? String(answer.data).replace(/\.$/, "") : null;
		} catch {
			ptrCache.delete(ip);
			return null;
		}
	});

	ptrCache.set(ip, request);
	return request;
}

// Resolves a hostname to an address so the lookup box accepts domains too.
async function resolveHostname(hostname: string): Promise<string | null> {
	for (const type of ["A", "AAAA"]) {
		try {
			const response = await fetchWithTimeout(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`, 8000, {
				headers: { accept: "application/dns-json" }
			});
			const data = await response.json();
			const answer = data?.Answer?.find((record: { type: number }) => record.type === (type === "A" ? 1 : 28));
			if (answer?.data) return String(answer.data);
		} catch {
			// try the next record type
		}
	}

	return null;
}

// Both endpoints are asked at once and the first usable answer wins — without an
// IPv6 route the v6 probe just hangs until it times out, so racing keeps the v4
// result from waiting on it.
async function detectOwnIP(version: 4 | 6): Promise<string | null> {
	const endpoints = version === 4 ? ["https://api.ipify.org?format=json", "https://ipv4.icanhazip.com"] : ["https://api6.ipify.org?format=json", "https://ipv6.icanhazip.com"];

	const attempts = endpoints.map(async (endpoint) => {
		const response = await fetchWithTimeout(endpoint, 6000);
		if (!response.ok) throw new Error(`${endpoint} responded ${response.status}`);

		const body = (await response.text()).trim();
		const ip = body.startsWith("{") ? JSON.parse(body).ip : body;
		if (!ip || !isIP(ip)) throw new Error(`${endpoint} returned no usable address`);

		return ip as string;
	});

	try {
		return await Promise.any(attempts);
	} catch {
		return null;
	}
}

function randomSession() {
	const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
	const bytes = new Uint8Array(40);

	if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
	else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);

	return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function formatLocation(geo?: Geo | null) {
	if (!geo?.success) return null;

	const parts = [geo.city, geo.region, geo.country].filter(Boolean);
	if (parts.length === 0) return null;

	return `${geo.flag?.emoji ? geo.flag.emoji + " " : ""}${parts.join(", ")}`;
}

function formatNetwork(geo?: Geo | null) {
	if (!geo?.success || !geo.connection) return null;

	const { asn, org, isp } = geo.connection;
	const name = org || isp;
	if (!name) return asn ? `AS${asn}` : null;

	return asn ? `${name} (AS${asn})` : name;
}

/* -------------------------------------------------------------------------- */
/*                                 components                                 */
/* -------------------------------------------------------------------------- */

function Row({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div className="flex flex-col gap-0.5 border-b border-viola-200 py-2 last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
			<span className="text-sm text-viola-800/70">{label}</span>
			<span className="break-all font-medium sm:text-right">{value}</span>
		</div>
	);
}

function Card({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
	return (
		<div className="rounded-xl border-2 border-viola-300 bg-viola-50 p-6 shadow-md">
			<h2 className="mb-3 text-2xl font-semibold">{title}</h2>
			{children}
		</div>
	);
}

function GeoDetails({ geo }: { geo: Geo }) {
	const location = formatLocation(geo);
	const network = formatNetwork(geo);

	return (
		<div className="flex flex-col">
			<Row label="IP Address" value={<span className="font-mono">{geo.ip}</span>} />
			{geo.type ? <Row label="Type" value={geo.type} /> : null}
			{location ? <Row label="Location" value={location} /> : null}
			{geo.postal ? <Row label="Postal Code" value={geo.postal} /> : null}
			{geo.latitude != null && geo.longitude != null ? <Row label="Coordinates" value={<span className="font-mono">{`${geo.latitude.toFixed(4)}, ${geo.longitude.toFixed(4)}`}</span>} /> : null}
			{network ? <Row label="Network" value={network} /> : null}
			{geo.connection?.isp && geo.connection.isp !== geo.connection.org ? <Row label="ISP" value={geo.connection.isp} /> : null}
			{geo.timezone?.id ? <Row label="Timezone" value={`${geo.timezone.id}${geo.timezone.utc ? ` (UTC${geo.timezone.utc})` : ""}`} /> : null}
		</div>
	);
}

function LocationMap({ geo }: { geo: Geo }) {
	if (geo.latitude == null || geo.longitude == null) return null;

	const lat = Math.max(-85, Math.min(85, geo.latitude));
	const lon = Math.max(-180, Math.min(180, geo.longitude));
	const bbox = [lon - 0.4, lat - 0.3, lon + 0.4, lat + 0.3].map((value) => value.toFixed(4)).join("%2C");

	return (
		<iframe
			title={`Approximate location of ${geo.ip}`}
			className="mt-4 h-64 w-full rounded-lg border-2 border-viola-300"
			loading="lazy"
			referrerPolicy="no-referrer"
			src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lon}`}
		></iframe>
	);
}

function OwnAddress({ version, state, geo, otherFound }: { version: 4 | 6; state: Detection; geo: Geo | null; otherFound: boolean }) {
	const location = formatLocation(geo);
	const network = formatNetwork(geo);
	const { ip, done } = state;

	// Only claim the other protocol is in use if we actually found an address for
	// it — otherwise both cards would contradict each other.
	const unavailableReason = otherFound
		? version === 6
			? "Your network reached this page over IPv4 only — no IPv6 connectivity was detected."
			: "Your network reached this page over IPv6 only."
		: "Could not detect an address. A VPN, firewall, or blocked request may have interfered.";

	return (
		<div className="flex flex-col rounded-xl border-2 border-viola-300 bg-viola-50 p-6 shadow-md">
			<h3 className="text-sm font-semibold uppercase tracking-wide text-viola-800/70">IPv{version}</h3>

			{!done ? (
				<p className="mt-2 text-xl text-viola-800/60">Detecting…</p>
			) : ip ? (
				<>
					{/* Long IPv6 addresses get a smaller size so they wrap less awkwardly. */}
					<p className={`mt-1 break-all font-mono font-semibold ${ip.length > 24 ? "text-lg md:text-xl" : "text-xl md:text-2xl"}`}>{ip}</p>
					<div className="mt-3 flex flex-col text-sm">
						{location ? <Row label="Location" value={location} /> : null}
						{network ? <Row label="Network" value={network} /> : null}
						{geo?.timezone?.id ? <Row label="Timezone" value={geo.timezone.id} /> : null}
						{geo && !location && !network ? <span className="text-viola-800/60">No location data available.</span> : null}
					</div>
				</>
			) : (
				<>
					<p className="mt-1 text-xl font-semibold text-viola-800/60">Not available</p>
					<p className="mt-2 text-sm text-viola-800/70">{unavailableReason}</p>
				</>
			)}
		</div>
	);
}

export default function IPTools({ children }: { children: JSX.Element }) {
	const [ipv4, setIPv4] = useState<Detection>({ ip: null, done: false });
	const [ipv6, setIPv6] = useState<Detection>({ ip: null, done: false });
	const [ipv4Geo, setIPv4Geo] = useState<Geo | null>(null);
	const [ipv6Geo, setIPv6Geo] = useState<Geo | null>(null);

	const [resolvers, setResolvers] = useState<Record<string, Resolver>>({});
	const [dnsDone, setDNSDone] = useState(false);

	const [query, setQuery] = useState("");
	const [searching, setSearching] = useState(false);
	const [result, setResult] = useState<Geo | null>(null);
	const [resolvedFrom, setResolvedFrom] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const seenResolvers = useRef(new Set<string>());
	const [resolverListRef] = useAutoAnimate();
	const [resultRef] = useAutoAnimate();

	// Detect our own addresses, then geolocate each one. The two protocols are
	// tracked separately so a slow IPv6 probe never holds up the IPv4 result.
	useEffect(() => {
		let cancelled = false;

		const detect = async (version: 4 | 6, setIP: typeof setIPv4, setGeo: typeof setIPv4Geo) => {
			const ip = await detectOwnIP(version);
			if (cancelled) return;

			setIP({ ip, done: true });
			if (ip) lookupGeo(ip).then((geo) => !cancelled && setGeo(geo));
		};

		detect(4, setIPv4, setIPv4Geo);
		detect(6, setIPv6, setIPv6Geo);

		return () => {
			cancelled = true;
		};
	}, []);

	// Detect the resolvers actually used by this browser. Each round asks for a
	// brand new subdomain, so it can't be served from any cache along the way.
	useEffect(() => {
		let cancelled = false;
		const session = randomSession();

		const enrich = async (ip: string) => {
			const [geo, ptr] = await Promise.all([lookupGeo(ip), lookupPtr(ip)]);
			if (cancelled) return;

			setResolvers((previous) => (previous[ip] ? { ...previous, [ip]: { ip, geo, ptr, loading: false } } : previous));
		};

		(async () => {
			for (let round = 1; round <= DNS_ROUNDS; round++) {
				if (cancelled) return;

				try {
					const response = await fetchWithTimeout(`https://${session}-${round}.ipleak.net/dnsdetection/`, 12000, { cache: "no-store" });
					const data = await response.json();
					const found: string[] = data && !Array.isArray(data) && data.ip ? Object.keys(data.ip) : [];
					if (cancelled) return;

					const room = MAX_RESOLVERS - seenResolvers.current.size;
					const fresh = found.filter((ip) => !seenResolvers.current.has(ip)).slice(0, Math.max(0, room));
					if (fresh.length === 0) continue;

					fresh.forEach((ip) => seenResolvers.current.add(ip));
					setResolvers((previous) => {
						const next = { ...previous };
						fresh.forEach((ip) => (next[ip] = { ip, loading: true }));
						return next;
					});
					fresh.forEach(enrich);
				} catch {
					// a failed round just means one fewer sample
				}
			}

			if (!cancelled) setDNSDone(true);
		})();

		return () => {
			cancelled = true;
		};
	}, []);

	async function handleLookup() {
		const raw = query.trim();
		if (!raw || searching) return;

		setSearching(true);
		setError(null);
		setResult(null);
		setResolvedFrom(null);

		try {
			// Accept bare IPs, bracketed IPv6, hostnames, and pasted URLs.
			let target = raw.replace(/^\[|\]$/g, "");
			let from: string | null = null;

			if (!isIP(target)) {
				let hostname = target.split("/")[0];

				if (target.includes("://")) {
					try {
						hostname = new URL(target).hostname.replace(/^\[|\]$/g, "");
					} catch {
						setError("Enter a valid IP address or domain name.");
						return;
					}
				}

				if (!isIP(hostname)) {
					if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(hostname)) {
						setError("Enter a valid IP address or domain name.");
						return;
					}

					const resolved = await resolveHostname(hostname);
					if (!resolved) {
						setError(`Could not resolve ${hostname}.`);
						return;
					}

					target = resolved;
					from = hostname;
				} else {
					target = hostname;
				}
			}

			const geo = await lookupGeo(target);
			if (!geo) {
				setError("Lookup failed. Please try again.");
				return;
			}

			if (!geo.success) {
				setError(geo.message === "Reserved range" ? `${target} is in a reserved/private range and has no public location.` : `No geolocation data found for ${target}.`);
				return;
			}

			setResolvedFrom(from);
			setResult(geo);
		} catch {
			setError("Lookup failed. Please try again.");
		} finally {
			setSearching(false);
		}
	}

	const resolverList = Object.values(resolvers);

	return (
		<div className="rounded-xl bg-viola-100 p-4 shadow-xl lg:p-8">
			<div className="mb-4">
				<h1 className="text-3xl font-semibold">IP &amp; DNS Lookup</h1>
				<h2>See your own address and DNS resolvers, and geolocate any IP or domain.</h2>
			</div>

			<div className="flex flex-col gap-4">
				<Card title="Your IP Address">
					<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
						<OwnAddress version={4} state={ipv4} geo={ipv4Geo} otherFound={ipv6.ip !== null} />
						<OwnAddress version={6} state={ipv6} geo={ipv6Geo} otherFound={ipv4.ip !== null} />
					</div>
				</Card>

				<Card title="Your DNS Resolvers">
					<p className="mb-4 text-sm text-viola-800/70">
						These are the servers that answered DNS queries for your browser. Detected by resolving unique, uncacheable subdomains and recording which resolvers asked for them.
					</p>

					<div ref={resolverListRef}>
						{resolverList.length > 0 ? (
							<div className="overflow-x-auto">
								<table className="w-full table-auto">
									<thead>
										<tr className="border-2 border-viola-300 bg-viola-200">
											<th className="border border-viola-300 px-4 py-2 text-left">IP Address</th>
											<th className="border border-viola-300 px-4 py-2 text-left">Hostname</th>
											<th className="border border-viola-300 px-4 py-2 text-left">Provider</th>
											<th className="border border-viola-300 px-4 py-2 text-left">Location</th>
										</tr>
									</thead>
									<tbody>
										{resolverList.map((resolver) => (
											<tr key={resolver.ip} className="border-2 border-viola-300 bg-viola-100">
												<td className="border border-viola-300 px-4 py-2 font-mono text-sm">{resolver.ip}</td>
												<td className="border border-viola-300 px-4 py-2 font-mono text-sm">{resolver.loading ? "…" : resolver.ptr || "—"}</td>
												<td className="border border-viola-300 px-4 py-2 text-sm">{resolver.loading ? "…" : formatNetwork(resolver.geo) || "Unknown"}</td>
												<td className="border border-viola-300 px-4 py-2 text-sm">{resolver.loading ? "…" : formatLocation(resolver.geo) || "Unknown"}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : dnsDone ? (
							<p className="text-viola-800/60">No resolvers detected. An ad blocker or strict privacy extension may have blocked the test.</p>
						) : (
							<p className="text-viola-800/60">Detecting…</p>
						)}

						{resolverList.length > 0 ? (
							<p className="mt-3 text-sm text-viola-800/70">{dnsDone ? `${resolverList.length} resolver${resolverList.length === 1 ? "" : "s"} detected.` : "Detecting more…"}</p>
						) : null}
					</div>
				</Card>

				<Card title="Geolocate an IP">
					<div className="mb-2 flex flex-row">
						<input
							type="text"
							placeholder="1.1.1.1, 2606:4700::1111, or example.com"
							value={query}
							className="w-5/6 flex-grow rounded-lg border px-6 py-4 text-xl focus:border-viola-500 focus:outline-none"
							onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
							onKeyDown={(e) => e.key === "Enter" && handleLookup()}
						></input>
						<button
							className="ml-4 flex flex-row items-center rounded-xl border-2 border-viola-300 bg-viola-100 p-5 shadow-md disabled:opacity-60"
							onClick={() => handleLookup()}
							disabled={searching}
							aria-label="Look up IP address"
						>
							{children}
							<div className="hidden md:block">{searching ? "…" : "Lookup"}</div>
						</button>
					</div>

					<div ref={resultRef}>
						{error ? <p className="mt-2 text-xl text-red-500">{error}</p> : null}

						{result ? (
							<div className="mt-4">
								{resolvedFrom ? (
									<p className="mb-2 text-sm text-viola-800/70">
										Resolved <span className="font-mono">{resolvedFrom}</span> to <span className="font-mono">{result.ip}</span>.
									</p>
								) : null}

								<GeoDetails geo={result} />
								<LocationMap geo={result} />

								<p className="mt-3 text-sm text-viola-800/70">IP geolocation is approximate — it usually points at the network's registered area, not the device itself.</p>
							</div>
						) : null}
					</div>
				</Card>
			</div>
		</div>
	);
}
