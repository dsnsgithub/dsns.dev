<script lang="ts">
	import { Octokit } from "@octokit/core";
	import { onMount } from "svelte";

	type DisplayEvent = {
		id: string;
		actor: { login: string; avatar_url: string };
		verb: string;
		object: string;
		description?: string;
		repo: string;
		url: string;
		timestamp: string;
	};

	let loading = true;
	let events: DisplayEvent[] = [];

	const octokit = new Octokit();
	const detailCache = new Map<string, { title: string; body: string; merged?: boolean }>();

	function cleanDescription(text: string | null) {
		if (!text) return "";
		return text.replace(/[#*`_]/g, "").trim();
	}

	async function fetchDetails(apiUrl: string) {
		if (detailCache.has(apiUrl)) return detailCache.get(apiUrl)!;
		try {
			const res = await octokit.request(`GET ${apiUrl}`);
			const data = {
				title: res.data.title || "Untitled",
				body: cleanDescription(res.data.body),
				merged: res.data.merged,
				url: res.data.html_url
			};
			detailCache.set(apiUrl, data);
			return data;
		} catch {
			return { title: "Private or Deleted Content", body: "" };
		}
	}

	function formatDate(isoString: string) {
		return new Date(isoString).toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
			hour: "numeric",
			minute: "numeric"
		});
	}

	async function run() {
		try {
			const res = await octokit.request("GET /users/{username}/events/public", {
				username: "dsnsgithub",
				headers: { "X-GitHub-Api-Version": "2022-11-28" }
			});

			const allowedActions = ["opened", "closed", "reopened"];
			const ignoredTypes = ["PushEvent", "IssueCommentEvent", "PullRequestReviewCommentEvent", "CommitCommentEvent"];
			const rawEvents = res.data.filter((e) => !ignoredTypes.includes(e.type));

			const processedPRs = new Set<string>();
			const tempEvents: DisplayEvent[] = [];

			for (const event of rawEvents) {
				const { payload, actor, repo, created_at, id, type } = event;
				const base = { id, actor, repo: repo.name, timestamp: formatDate(created_at) };

				if (type === "PullRequestEvent" || type === "PullRequestReviewEvent") {
					const pr = payload.pull_request;
					const prKey = `${repo.name}#${pr.number}`;
					if (processedPRs.has(prKey)) continue;

					let verb = "";

					if (type === "PullRequestEvent" && payload.action === "closed" && pr.merged) {
						verb = "merged";
					} else if (type === "PullRequestReviewEvent") {
						const state = payload.review.state.toLowerCase();
						if (state === "commented") continue;
						verb = state.replace("_", " ");
					} else if (type === "PullRequestEvent" && allowedActions.includes(payload.action)) {
						verb = payload.action;
					} else {
						continue;
					}

					const details = await fetchDetails(pr.url);
					processedPRs.add(prKey);

					tempEvents.push({
						...base,
						verb: verb + " pull request",
						object: `${details.title} (#${pr.number})`,
						description: details.body,
						url: details.url
					});
				} else if (type === "IssuesEvent") {
					const details = await fetchDetails(payload.issue.url);

					tempEvents.push({
						...base,
						verb: payload.action + " issue",
						object: `${details.title} (#${payload.issue.number})`,
						description: details.body,
						url: details.url
					});
				} else if (type === "WatchEvent") {
					tempEvents.push({ ...base, verb: "starred", object: repo.name, url: `https://github.com/${repo.name}` });
				} else if (type === "ForkEvent") {
					tempEvents.push({ ...base, verb: "forked", object: repo.name, description: `Original repository created by ${payload.forkee.full_name}`, url: payload.forkee.html_url });
				}
			}
			events = tempEvents;
		} catch (e) {
			console.error("Error:", e);
		} finally {
			loading = false;
		}
	}

	onMount(run);
</script>

{#if loading}
	<div class="flex flex-col space-y-3">
		{#each Array(8) as _}
			<div class="mx-2 animate-pulse rounded-xl bg-viola-50 p-4 sm:mx-4 sm:p-5">
				<div class="flex items-start space-x-3 sm:space-x-4">
					<div class="h-8 w-8 shrink-0 rounded-full bg-viola-200 sm:h-10 sm:w-10" />

					<div class="min-w-0 flex-1">
						<div class="mb-1 flex flex-col sm:mb-0 sm:flex-row sm:items-center sm:justify-between">
							<div class="h-4 w-3/4 rounded bg-viola-200 sm:w-1/2" />
							<div class="mt-2 h-3 w-16 rounded bg-viola-100 sm:mt-0" />
						</div>

						<div class="mt-3 space-y-2">
							<div class="h-3 w-full rounded bg-viola-100/70" />
							<div class="h-3 w-5/6 rounded bg-viola-100/70" />
						</div>

						<div class="mt-4 h-3 w-24 rounded bg-viola-200/60" />
					</div>
				</div>
			</div>
		{/each}
	</div>
{:else}
	<div class="flex flex-col space-y-3">
		{#each events as item (item.id)}
			<div class="group mx-2 rounded-xl border border-transparent bg-viola-50 p-4 transition-all hover:border-viola-200 hover:bg-viola-100/40 sm:mx-4 sm:p-5">
				<a href={item.url} target="_blank" rel="noopener noreferrer" class="flex items-start space-x-3 sm:space-x-4">
					<img src={item.actor.avatar_url} alt="" class="h-8 w-8 shrink-0 rounded-full border-2 border-white shadow-sm sm:h-10 sm:w-10" />

					<div class="min-w-0 flex-1">
						<div class="mb-1 flex flex-col sm:mb-0 sm:flex-row sm:items-center sm:justify-between">
							<p class="text-sm font-bold leading-tight text-gray-900">
								{item.actor.login}
								<span class="mx-0.5 font-normal text-gray-500">{item.verb}</span>
								<span class="break-words text-viola-700">{item.object}</span>
							</p>
							<span class="mt-1 shrink-0 text-[10px] text-gray-400 sm:mt-0 sm:text-xs">
								{item.timestamp}
							</span>
						</div>

						{#if item.description}
							<div class="description-fade mt-2">
								<p class="line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-gray-600">
									{item.description}
								</p>
							</div>
						{/if}

						<p class="mt-2 truncate text-[10px] font-semibold tracking-wide text-viola-700/80 sm:text-[11px]">
							{item.repo}
						</p>
					</div>
				</a>
			</div>
		{/each}
	</div>
{/if}

<style>
	.description-fade p {
		mask-image: linear-gradient(to bottom, black 70%, transparent 100%);
		-webkit-mask-image: linear-gradient(to bottom, black 70%, transparent 100%);
		overflow: hidden;
	}
</style>
