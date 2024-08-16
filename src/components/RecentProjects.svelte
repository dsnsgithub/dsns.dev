<script lang="ts">
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
		const res = await fetch("https://cors.dsns.dev/api.github.com/users/dsnsgithub/repos");
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
			<li class="m-4 p-8 bg-viola-50 rounded-xl h-32">
				<div class="flex justify-between">
					<div class="bg-viola-200 w-32 h-6 rounded-xl animate-pulse" />
					<div class="bg-viola-200 w-16 h-6 rounded-xl animate-pulse" />
				</div>
				<div class="bg-viola-100 h-10 mt-4 rounded-xl animate-pulse" />
			</li>
		{/each}
	</ul>
{:else}
	<ul>
		{#each result as repo}
			<li class="m-4 p-8 bg-viola-50 rounded-xl hover:scale-[1.01] transition duration-500">
				<a href={repo.html_url} target="_blank" rel="noopener noreferrer" class="block">
					<div class="flex justify-between">
						<p class="text-xl font-bold">{repo.name}</p>
						{#if repo.language}
							<div class="bg-viola-200 p-2 rounded-xl">{repo.language}</div>
						{/if}
					</div>
					{#if repo.description}
						<p>{repo.description}</p>
					{/if}
					<p title={new Date(repo.pushed_at).toLocaleString()}>
						Last updated: {new Date(repo.pushed_at).toLocaleDateString()}
					</p>
				</a>
			</li>
		{/each}
	</ul>
{/if}
