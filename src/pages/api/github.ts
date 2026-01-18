import type { APIRoute } from "astro";
import { Octokit } from "@octokit/rest";

export interface DisplayEvent {
	id: string;
	actor: { login: string; avatar_url: string };
	verb: string;
	object: string;
	description?: string;
	repo: string;
	url: string;
	timestamp: string;
}

const octokit = new Octokit({
	auth: import.meta.env.GITHUB_TOKEN
});

let eventsCache: DisplayEvent[] | null = null;
let eventsCacheTime = 0;
const EVENTS_TTL = 1000 * 60 * 5;

const detailCache = new Map<string, { title: string; body: string; merged?: boolean; url: string }>();

const cleanDescription = (text: string | null | undefined) => (text ? text.replace(/[#*`_]/g, "").trim() : "");

const formatDate = (iso: string) =>
	new Date(iso).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "numeric"
	});

async function fetchDetails(apiUrl: string) {
	if (detailCache.has(apiUrl)) return detailCache.get(apiUrl)!;

	try {
		const res = await octokit.request(`GET ${apiUrl}`);
		const data = {
			title: res.data.title ?? "Untitled",
			body: cleanDescription(res.data.body),
			merged: res.data.merged,
			url: res.data.html_url
		};
		detailCache.set(apiUrl, data);
		return data;
	} catch {
		return { title: "Private or Deleted Content", body: "", url: "#" };
	}
}

export const GET: APIRoute = async () => {
	try {
		if (eventsCache && Date.now() - eventsCacheTime < EVENTS_TTL) {
			return new Response(JSON.stringify(eventsCache), {
				headers: { "Content-Type": "application/json" }
			});
		}

		const res = await octokit.rest.activity.listPublicEventsForUser({
			username: "dsnsgithub",
			per_page: 30,
			headers: { "X-GitHub-Api-Version": "2022-11-28" }
		});

		const allowedActions = ["opened", "closed", "reopened"];
		const ignoredTypes = ["PushEvent", "IssueCommentEvent", "PullRequestReviewCommentEvent", "CommitCommentEvent"];

		const rawEvents = res.data.filter((e) => !ignoredTypes.includes(e.type!));

		const tempEvents: DisplayEvent[] = [];
		const processedPRs = new Set<string>();

		for (const event of rawEvents) {
			const { payload, actor, repo, created_at, id, type } = event;
			if (!created_at || !id) continue;

			const base = {
				id,
				actor: { login: actor.login, avatar_url: actor.avatar_url },
				repo: repo.name,
				timestamp: formatDate(created_at)
			};

			if (type === "PullRequestEvent" || type === "PullRequestReviewEvent") {
				const pr = (payload as any).pull_request;
				const prKey = `${repo.name}#${pr.number}`;
				if (!pr || processedPRs.has(prKey)) continue;

				let verb = "";
				if (type === "PullRequestEvent" && (payload as any).action === "closed" && pr.merged) {
					verb = "merged";
				} else if (type === "PullRequestReviewEvent") {
					const state = (payload as any).review.state?.toLowerCase();
					if (state === "commented") continue;
					verb = state.replace("_", " ");
				} else if (type === "PullRequestEvent" && allowedActions.includes((payload as any).action)) {
					verb = (payload as any).action;
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
				const issue = (payload as any).issue;
				if (!issue) continue;
				const details = await fetchDetails(issue.url);

				tempEvents.push({
					...base,
					verb: (payload as any).action + " issue",
					object: `${details.title} (#${issue.number})`,
					description: details.body,
					url: details.url
				});
			} else if (type === "WatchEvent") {
				tempEvents.push({
					...base,
					verb: "starred",
					object: repo.name,
					url: `https://github.com/${repo.name}`
				});
			} else if (type === "ForkEvent") {
				const forkee = (payload as any).forkee;
				if (!forkee) continue;
				tempEvents.push({
					...base,
					verb: "forked",
					object: repo.name,
					description: `Original repository created by ${forkee.full_name}`,
					url: forkee.html_url
				});
			}
		}

		eventsCache = tempEvents;
		eventsCacheTime = Date.now();

		return new Response(JSON.stringify(tempEvents), {
			headers: { "Content-Type": "application/json" }
		});
	} catch (err) {
		console.error("GitHub API error:", err);
		return new Response(JSON.stringify({ error: "Failed to fetch GitHub activity" }), { status: 500, headers: { "Content-Type": "application/json" } });
	}
};
