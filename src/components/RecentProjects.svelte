<script lang="ts">
	const languageColors: Record<string, string> = {
		JavaScript: "#f1e05a",
		TypeScript: "#3178c6",
		Python: "#3572A5",
		HTML: "#d35728",
		CSS: "#563d7c",
		Java: "#d14233",
		C: "#555555",
		"C++": "#f34b7d",
		Shell: "#89e051",
		Go: "#00ADD8",
		Rust: "#e45a14",
		Astro: "#5d17ac"
	};

	interface GithubAPIResponse {
		name: string;
		fork: boolean;
		description: string;
		language: string;
		html_url: string;
		pushed_at: string;
	}

	let result: GithubAPIResponse[] = [];
	let delayOver = false;

	(async () => {
		const res = await fetch("https://api.github.com/users/dsnsgithub/repos");
		const data = (await res.json()) as GithubAPIResponse[];
		result = data
			.filter((repo) => !repo.fork)
			.sort((a, b) => new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime())
			.slice(0, 8);
	})();

	setTimeout(() => {
		delayOver = true;
	}, 500);
</script>

{#if !delayOver || !result.length}
	<ul>
		{#each Array(8) as _, i}
			<li class="m-4 h-32 rounded-xl bg-viola-50 p-8">
				<div class="flex justify-between">
					<div class="h-6 w-32 animate-pulse rounded-xl bg-viola-200" />
					<div class="h-6 w-16 animate-pulse rounded-xl bg-viola-200" />
				</div>
				<div class="mt-4 h-10 animate-pulse rounded-xl bg-viola-100" />
			</li>
		{/each}
	</ul>
{:else}
	<ul>
		{#each result as repo}
			<li class="m-4 rounded-xl bg-viola-50 p-8 transition duration-500 hover:scale-[1.01]">
				<a href={repo.html_url} target="_blank" rel="noopener noreferrer" class="block">
					<div class="mb-2 flex flex-wrap justify-between">
						<p class="text-xl font-bold">{repo.name}</p>
						{#if repo.language}
							<div class="flex items-center gap-2 rounded-xl bg-viola-200 px-3 py-1">
								<span class="inline-block h-3 w-3 rounded-full" style="background-color: {languageColors[repo.language] || '#999'}" />
								<span>{repo.language}</span>
							</div>
						{/if}
					</div>
					{#if repo.description}
						<p>{repo.description}</p>
					{/if}
					<p title={new Date(repo.pushed_at).toLocaleString()} class="mt-2 text-sm text-gray-500">
						Last updated: {new Date(repo.pushed_at).toLocaleDateString()}
					</p>
				</a>
			</li>
		{/each}
	</ul>
{/if}
