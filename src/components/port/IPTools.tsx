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
			{/* Two decimals is about a kilometre — past that the extra digits would
			    dress up a city-level guess as a street-level one. */}
			{geo.latitude != null && geo.longitude != null ? (
				<Row label="Approx. Coordinates" value={<span className="font-mono">{`${geo.latitude.toFixed(2)}, ${geo.longitude.toFixed(2)}`}</span>} />
			) : null}
			{network ? <Row label="Network" value={network} /> : null}
			{geo.connection?.isp && geo.connection.isp !== geo.connection.org ? <Row label="ISP" value={geo.connection.isp} /> : null}
			{geo.timezone?.id ? <Row label="Timezone" value={`${geo.timezone.id}${geo.timezone.utc ? ` (UTC${geo.timezone.utc})` : ""}`} /> : null}
		</div>
	);
}

// Tiles are laid out by hand rather than pulled in through a map library — a
// static, centred view needs nothing more than the Web Mercator projection, and
// it keeps the page dependency-free.
const TILE_SIZE = 256;
const MIN_ZOOM = 2;
const MAX_ZOOM = 14;
const EQUATOR_METRES_PER_PIXEL = 156543.03392;

// Mapbox needs an account, so CARTO's Positron is the default. Set
// PUBLIC_MAPBOX_TOKEN to switch; tiles fall back to CARTO if the token is
// rejected.
const MAPBOX_TOKEN = import.meta.env.PUBLIC_MAPBOX_TOKEN as string | undefined;

function project(lat: number, lon: number, zoom: number) {
	const scale = TILE_SIZE * 2 ** zoom;
	const bounded = Math.max(-85.05112878, Math.min(85.05112878, lat));
	const sin = Math.sin((bounded * Math.PI) / 180);

	return {
		x: ((lon + 180) / 360) * scale,
		y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale
	};
}

function metresPerPixel(lat: number, zoom: number) {
	return (EQUATOR_METRES_PER_PIXEL * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

// How much ground the answer really covers. These databases resolve an address
// to a city or a network's registered area, never to a street, so the radius
// follows how specific the response managed to be.
function accuracyRadiusKm(geo: Geo) {
	if (geo.city) return 25;
	if (geo.region) return 75;
	if (geo.country) return 250;
	return 500;
}

function LocationMap({ geo }: { geo: Geo }) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [size, setSize] = useState({ width: 0, height: 0 });
	const [zoomOffset, setZoomOffset] = useState(0);
	const [mapboxFailed, setMapboxFailed] = useState(false);

	// Each new lookup starts framed on its own area again.
	useEffect(() => setZoomOffset(0), [geo.ip]);

	useEffect(() => {
		const element = containerRef.current;
		if (!element) return;

		const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
		measure();

		const observer = new ResizeObserver(measure);
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	if (geo.latitude == null || geo.longitude == null) return null;

	const { width, height } = size;
	const radiusKm = accuracyRadiusKm(geo);
	const radiusMetres = radiusKm * 1000;

	// Frame the view on the area itself: pick the zoom that leaves the region
	// covering roughly half the shorter side, so the surrounding context stays
	// visible and the answer never reads as a single spot.
	const shortestSide = Math.min(width || 320, height || 256);
	const fittedZoom = Math.log2((EQUATOR_METRES_PER_PIXEL * Math.cos((geo.latitude * Math.PI) / 180) * shortestSide) / (4 * radiusMetres));
	const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(fittedZoom) + zoomOffset));

	const radiusPixels = radiusMetres / metresPerPixel(geo.latitude, zoom);
	const useMapbox = Boolean(MAPBOX_TOKEN) && !mapboxFailed;

	const centre = project(geo.latitude, geo.longitude, zoom);
	const left = centre.x - width / 2;
	const top = centre.y - height / 2;
	const tileCount = 2 ** zoom;

	const tiles: { key: string; src: string; x: number; y: number }[] = [];
	if (width > 0 && height > 0) {
		for (let tx = Math.floor(left / TILE_SIZE); tx <= Math.floor((left + width) / TILE_SIZE); tx++) {
			for (let ty = Math.floor(top / TILE_SIZE); ty <= Math.floor((top + height) / TILE_SIZE); ty++) {
				if (ty < 0 || ty >= tileCount) continue;

				// Wrap horizontally so the map doesn't tear at the date line.
				const wrapped = ((tx % tileCount) + tileCount) % tileCount;
				const subdomain = "abc"[Math.abs(tx + ty) % 3];

				tiles.push({
					key: `${zoom}/${tx}/${ty}`,
					src: useMapbox
						? `https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/${TILE_SIZE}/${zoom}/${wrapped}/${ty}@2x?access_token=${MAPBOX_TOKEN}`
						: `https://${subdomain}.basemaps.cartocdn.com/light_all/${zoom}/${wrapped}/${ty}@2x.png`,
					x: tx * TILE_SIZE - left,
					y: ty * TILE_SIZE - top
				});
			}
		}
	}

	return (
		<div className="mt-4 overflow-hidden rounded-xl border-2 border-viola-300 shadow-md">
			<div ref={containerRef} className="relative h-64 w-full bg-viola-100 md:h-80">
				{tiles.map((tile) => (
					<img
						key={tile.key}
						src={tile.src}
						alt=""
						draggable={false}
						onError={useMapbox ? () => setMapboxFailed(true) : undefined}
						className="pointer-events-none absolute select-none"
						style={{ left: tile.x, top: tile.y, width: TILE_SIZE, height: TILE_SIZE }}
					/>
				))}

				{/* Soft edge fade so the tiles melt into the card instead of ending abruptly. */}
				<div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_28px_rgba(59,28,36,0.13)]"></div>

				{/* The answer is a region, not a point, so it's drawn as a haze that
				    fades out with no border to trace — there is no exact spot to mark. */}
				<div
					className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
					style={{
						width: radiusPixels * 2,
						height: radiusPixels * 2,
						background:
							"radial-gradient(circle, rgba(168,90,114,0.30) 0%, rgba(168,90,114,0.24) 28%, rgba(168,90,114,0.14) 52%, rgba(168,90,114,0.05) 74%, rgba(168,90,114,0.01) 88%, rgba(168,90,114,0) 100%)",
						filter: `blur(${Math.max(6, radiusPixels * 0.09)}px)`
					}}
				></div>

				<div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-lg border border-viola-300 bg-white/85 shadow-md backdrop-blur-sm">
					<button
						type="button"
						onClick={() => setZoomOffset((current) => current + 1)}
						disabled={zoom >= MAX_ZOOM}
						aria-label="Zoom in"
						className="h-8 w-8 text-lg leading-none text-viola-900 transition hover:bg-viola-100 disabled:opacity-40"
					>
						+
					</button>
					<button
						type="button"
						onClick={() => setZoomOffset((current) => current - 1)}
						disabled={zoom <= MIN_ZOOM}
						aria-label="Zoom out"
						className="h-8 w-8 border-t border-viola-200 text-lg leading-none text-viola-900 transition hover:bg-viola-100 disabled:opacity-40"
					>
						−
					</button>
				</div>

				<div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-white/85 px-2.5 py-1.5 text-xs shadow-sm backdrop-blur-sm">
					<span className="h-3 w-3 shrink-0 rounded-full bg-viola-500/40"></span>
					<span className="text-viola-900/80">Likely somewhere in this area (~{radiusKm} km)</span>
				</div>

				<div className="absolute bottom-0 right-0 rounded-tl-md bg-white/75 px-1.5 py-0.5 text-[10px] text-viola-900/60">
					<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="hover:underline">
						© OpenStreetMap
					</a>{" "}
					{useMapbox ? (
						<a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noreferrer" className="hover:underline">
							© Mapbox
						</a>
					) : (
						<a href="https://carto.com/attributions" target="_blank" rel="noreferrer" className="hover:underline">
							© CARTO
						</a>
					)}
				</div>
			</div>
		</div>
	);
}

function OwnAddress({ version, state, geo, otherFound, onLocate }: { version: 4 | 6; state: Detection; geo: Geo | null; otherFound: boolean; onLocate: (ip: string) => void }) {
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

					<button
						type="button"
						onClick={() => onLocate(ip)}
						className="mt-4 flex select-none flex-row items-center gap-1.5 self-start rounded-lg border border-viola-300 bg-viola-100 px-3 py-1.5 text-sm font-medium transition hover:bg-viola-200"
					>
						<svg viewBox="0 0 24 24" className="h-4 w-4 text-viola-600" fill="currentColor" aria-hidden="true">
							<path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
						</svg>
						Locate on map
					</button>
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
	const inputTouched = useRef(false);
	const prefilled = useRef(false);
	const lookupCardRef = useRef<HTMLDivElement>(null);
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

	// Seed the lookup box with the visitor's own address so the section opens on
	// something meaningful. Their geo result is already cached from the detection
	// above, so this costs no extra request.
	useEffect(() => {
		if (prefilled.current || inputTouched.current) return;

		const own = ipv4.ip ?? (ipv4.done ? ipv6.ip : null);
		if (!own) return;

		prefilled.current = true;
		setQuery(own);
		handleLookup(own);
	}, [ipv4, ipv6]);

	function locateAddress(ip: string) {
		inputTouched.current = true;
		handleLookup(ip);
		lookupCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
	}

	// `input` lets the IP cards drive a lookup directly, rather than going through
	// the query state and waiting a render for it to land.
	async function handleLookup(input?: string) {
		const raw = (input ?? query).trim();
		if (!raw || searching) return;

		if (input !== undefined) setQuery(raw);

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
	const isOwnResult = result != null && (result.ip === ipv4.ip || result.ip === ipv6.ip);

	return (
		<div className="rounded-xl bg-viola-100 p-4 shadow-xl lg:p-8">
			<div className="mb-4">
				<h1 className="text-3xl font-semibold">IP &amp; DNS Lookup</h1>
				<h2>See your own address and DNS resolvers, and geolocate any IP or domain.</h2>
			</div>

			<div className="flex flex-col gap-4">
				<Card title="Your IP Address">
					<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
						<OwnAddress version={4} state={ipv4} geo={ipv4Geo} otherFound={ipv6.ip !== null} onLocate={locateAddress} />
						<OwnAddress version={6} state={ipv6} geo={ipv6Geo} otherFound={ipv4.ip !== null} onLocate={locateAddress} />
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

				<div ref={lookupCardRef}>
					<Card title="Geolocate an IP">
						<div className="mb-2 flex flex-row">
							<input
								type="text"
								placeholder="1.1.1.1, 2606:4700::1111, or example.com"
								value={query}
								className="w-5/6 flex-grow rounded-lg border px-6 py-4 text-xl focus:border-viola-500 focus:outline-none"
								onInput={(e) => {
									inputTouched.current = true;
									setQuery((e.target as HTMLInputElement).value);
								}}
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

									{isOwnResult ? (
										<p className="mb-3 inline-flex items-center gap-1.5 rounded-lg bg-viola-200 px-3 py-1 text-sm font-medium">
											<svg viewBox="0 0 24 24" className="h-4 w-4 text-viola-600" fill="currentColor" aria-hidden="true">
												<path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
											</svg>
											This is your own address
										</p>
									) : null}

									<GeoDetails geo={result} />
									<LocationMap geo={result} />

									<p className="mt-3 text-sm text-viola-800/70">
										IP geolocation resolves to a region, not an address. It reflects where the network block is registered, which can sit far from whoever is using it — and a VPN
										or mobile carrier moves it further still.
									</p>
								</div>
							) : null}
						</div>
					</Card>
				</div>
			</div>
		</div>
	);
}
