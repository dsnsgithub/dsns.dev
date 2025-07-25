<script lang="ts">
	import { useLanyard, type Activity } from "sk-lanyard";
	import autoAnimate from "@formkit/auto-animate";
	import { onMount } from "svelte";

	import rawGames from "../assets/gameList.json";
	const gameList = rawGames as { [key: string]: string };

	function formatTime(milliseconds: number) {
		const totalSeconds = Math.floor(milliseconds / 1000);

		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;

		const paddedMinutes = minutes < 10 ? "0" + minutes : minutes;
		const paddedSeconds = seconds < 10 ? "0" + seconds : seconds;

		if (hours > 0) return hours + ":" + paddedMinutes + ":" + paddedSeconds;
		return paddedMinutes + ":" + paddedSeconds;
	}

	function handleExternalLinks(image: string | undefined) {
		if (!image) return null;
		return image.startsWith("mp:external/") ? `${externalAssetsLink}${image.replace("mp:external/", "")}` : `${internalAssetsLink}${activity?.application_id}/${image}.png`;
	}

	let visible = false;
	let currentTime = new Date().getTime();
	let activity: Activity | null = null;
	let largeImage: string | null = null;
	let smallImage: string | null = null;

	const status = useLanyard({ method: "ws", id: "342874998375186432" });

	const internalAssetsLink = "https://cdn.discordapp.com/app-assets/";
	const internalIconsLink = "https://cdn.discordapp.com/app-icons/";
	const externalAssetsLink = "https://media.discordapp.net/external/";

	$: activity = $status?.activities[$status?.activities.length - 1];

	$: largeImage = gameList[activity?.application_id || ""]
		? `${internalIconsLink}${activity?.application_id}/${gameList[activity?.application_id || ""]}.png`
		: handleExternalLinks(activity?.assets?.large_image);

	$: smallImage = handleExternalLinks(activity?.assets?.small_image);

	setTimeout(() => {
		visible = true;
	}, 500);

	onMount(() => {
		const interval = setInterval(() => {
			currentTime = new Date().getTime();
		}, 1000);

		return () => {
			clearInterval(interval);
		};
	});
</script>

<div use:autoAnimate={{ duration: 500 }}>
	{#if $status && visible && $status.activities && $status.activities.length > 0 && activity}
		{#if $status.spotify && $status.spotify.timestamps.end}
			<div class="m-2 rounded-lg bg-viola-100 p-8 shadow-lg">
				<h2 class="mb-2 text-2xl font-bold">Status</h2>
				<h3 class="text-md mb-2 font-bold">Listening to Spotify</h3>

				<div class="flex items-center space-x-4">
					<img src={$status.spotify.album_art_url} alt="Album Art" class="h-16 w-16 rounded" />
					<div>
						<h4 class="w-32 truncate text-sm md:w-48 lg:w-32 xl:w-32 2xl:w-48" title={$status.spotify.song} aria-label={$status.spotify.song}>
							{$status.spotify.song}
						</h4>
						<p class="w-32 truncate text-xs md:w-48 lg:w-32 xl:w-32 2xl:w-48" title={$status.spotify.artist} aria-label={$status.spotify.artist}>
							by {$status.spotify.artist}
						</p>
						<p class="w-32 truncate text-xs md:w-48 lg:w-32 xl:w-32 2xl:w-48" title={$status.spotify.album} aria-label={$status.spotify.album}>
							on {$status.spotify.album}
						</p>
					</div>
				</div>

				<div class="mt-2 flex items-center">
					<!-- current time -->
					<span class="relative inline-block text-left tabular-nums">
						<span aria-hidden="true" class="invisible block">00:00</span>
						<span class="absolute inset-0">
							{formatTime(Math.min(currentTime - $status.spotify.timestamps.start, $status.spotify.timestamps.end - $status.spotify.timestamps.start))}
						</span>
					</span>

					<div class="mx-1 h-3 flex-1 overflow-hidden rounded-xl bg-slate-300">
						<div
							class="h-full rounded-xl bg-viola-400"
							style="width: {((currentTime - $status.spotify.timestamps.start) / ($status.spotify.timestamps.end - $status.spotify.timestamps.start)) * 100}%"
						></div>
					</div>

					<!-- total time -->
					<span class="relative inline-block text-right tabular-nums">
						<span aria-hidden="true" class="invisible block">00:00</span>
						<span class="absolute inset-0">
							{formatTime($status.spotify.timestamps.end - $status.spotify.timestamps.start)}
						</span>
					</span>
				</div>
			</div>
		{:else}
			<div class="m-2 rounded-lg bg-viola-100 p-8 shadow-lg">
				<h2 class="mb-4 text-2xl font-bold">Status</h2>
				<div class="flex items-center space-x-4">
					<div class="relative flex-shrink-0">
						{#if largeImage}
							<img src={largeImage} alt="Large Activity Icon" class="h-16 w-16 rounded" />
						{/if}
						{#if !largeImage && !smallImage && activity?.emoji?.name}
							<span class="text-3xl">{activity.emoji.name}</span>
						{/if}
						{#if smallImage && !largeImage}
							<img src={smallImage} alt="Activity Icon" class="h-16 w-16 rounded" />
						{/if}
						{#if smallImage && largeImage}
							<img src={smallImage} alt="Small Activity Icon" class="ring-3 absolute bottom-0 right-0 h-6 w-6 rounded" />
						{/if}
					</div>

					<div>
						<h3 class="text-sm font-bold">{activity.name}</h3>
						<p class="text-xs">
							{#if activity.state}
								{activity.state}
							{/if}
						</p>
						<p class="text-xs">
							{#if activity.details}
								{activity.details}
							{/if}
						</p>
						<p class="text-xs">{formatTime(currentTime - activity.created_at)} elapsed</p>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>
