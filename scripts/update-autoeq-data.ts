import { mkdir, writeFile } from "node:fs/promises";

// Run explicitly to refresh a reviewed snapshot; never needed at build or request time.
const revision = process.argv[2];
if (!revision || !/^[a-f0-9]{40}$/.test(revision)) throw new Error("Usage: bun scripts/update-autoeq-data.ts <40-character AutoEq commit SHA>");
const root = `https://raw.githubusercontent.com/jaakkopasanen/AutoEq/${revision}`;
async function get(url: string) {
	const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
	if (!response.ok) throw new Error(`${response.status} loading ${url}`);
	return response.text();
}
const [index, targetText, license, example, commitText] = await Promise.all([
	get(`${root}/results/INDEX.md`),
	get(`${root}/webapp/data/targets.json`),
	get(`${root}/LICENSE`),
	get(`${root}/results/oratory1990/over-ear/Sennheiser%20HD%20650/Sennheiser%20HD%20650.csv`),
	get(`https://api.github.com/repos/jaakkopasanen/AutoEq/commits/${revision}`)
]);
const indexedPaths = [
	...new Set(
		index.split("\n").flatMap((line) => {
			const match = line.match(/^- \[(.*)\]\(\.\/(.*)\) by (.*)$/);
			return match ? [decodeURIComponent(match[2])] : [];
		})
	)
];
// The results index includes preset-only entries (notably Crinacle) with no raw CSV.
// Inspect each source's tree so every selectable result actually has measurement data.
interface TreeEntry {
	path: string;
	sha: string;
	type: string;
}
async function tree(sha: string, recursive = false): Promise<TreeEntry[]> {
	const data = JSON.parse(await get(`https://api.github.com/repos/jaakkopasanen/AutoEq/git/trees/${sha}${recursive ? "?recursive=1" : ""}`));
	if (data.truncated || !Array.isArray(data.tree)) throw new Error("Incomplete upstream tree; no files were changed.");
	return data.tree;
}
const rootTree = await tree(revision);
const resultsTree = rootTree.find((entry) => entry.path === "results" && entry.type === "tree");
if (!resultsTree) throw new Error("Missing results tree; no files were changed.");
const sources = (await tree(resultsTree.sha)).filter((entry) => entry.type === "tree");
const sourceFiles = await Promise.all(
	sources.map(async (source) => (await tree(source.sha, true)).filter((entry) => entry.type === "blob" && entry.path.endsWith(".csv")).map((entry) => `${source.path}/${entry.path}`))
);
const files = new Set(sourceFiles.flat());
const paths = indexedPaths.filter((path) => files.has(`${path}/${path.split("/").at(-1)}.csv`));
if (paths.length < 1000) throw new Error("Unexpected catalog format; no files were changed.");
const upstream = JSON.parse(targetText) as import("../src/lib/eq/data").Target[];
const targets = upstream.map((t) => ({ label: t.label, compatible: t.compatible, recommended: t.recommended, bassBoost: t.bassBoost, fr: { frequency: t.fr.frequency, raw: t.fr.raw } }));
const date = JSON.parse(commitText).commit.author.date.slice(0, 10);
const directory = new URL("../public/autoeq/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL("catalog.json", directory), JSON.stringify({ revision, date, paths }) + "\n");
await writeFile(new URL("targets.json", directory), JSON.stringify(targets) + "\n");
await writeFile(new URL("LICENSE.txt", directory), license);
await writeFile(new URL("sennheiser-hd-650.csv", directory), example);
console.log(`Saved ${paths.length} profiles and ${targets.length} targets from ${revision} (${date}). Update public/autoeq/README.md to match the reviewed snapshot.`);
