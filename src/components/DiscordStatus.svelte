<script lang="ts">
	import { useLanyard, type Activity } from "sk-lanyard";
	import autoAnimate from "@formkit/auto-animate";
	import { onMount } from "svelte";

	import rawGames from "../assets/gameList.json";
	const gameList = rawGames as { [key: string]: string };

	let visible = false;
	let currentTime = new Date().getTime();
	let activity: Activity | null = null;
	let largeImage: string | null = null;
	let smallImage: string | null = null;

	const status = useLanyard({ method: "ws", id: "342874998375186432" });

	function formatTime(milliseconds: number) {
		const minutes = Math.floor(milliseconds / 1000 / 60);
		const seconds = Math.floor((milliseconds / 1000) % 60);

		const paddedMinutes = minutes < 10 ? "0" + minutes : minutes;
		const paddedSeconds = seconds < 10 ? "0" + seconds : seconds;

		return paddedMinutes + ":" + paddedSeconds;
	}

	const internalAssetsLink = "https://cdn.discordapp.com/app-assets/";
	const internalIconsLink = "https://cdn.discordapp.com/app-icons/";
	const externalAssetsLink = "https://media.discordapp.net/external/";

	$: activity = $status?.activities[$status?.activities.length - 1];

	$: largeImage = activity?.assets?.large_image
		? activity?.assets?.large_image.startsWith("mp:external/")
			? `${externalAssetsLink}${activity.assets.large_image.replace("mp:external/", "")}`
			: `${internalAssetsLink}${activity?.application_id}/${activity.assets?.large_image}.png`
		: null;

	largeImage = gameList[activity?.application_id || ""] ? `${internalIconsLink}${activity?.application_id}/${gameList[activity?.application_id || ""]}.png` : largeImage;

	$: smallImage = activity?.assets?.small_image
		? activity?.assets?.small_image.startsWith("mp:external/")
			? `${externalAssetsLink}${activity?.assets.small_image.replace("mp:external/", "")}`
			: `${internalAssetsLink}${activity?.application_id}/${activity?.assets?.small_image}.png`
		: null;

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
			<div class="bg-viola-100 rounded-lg p-8 m-2 shadow-lg">
				<h2 class="text-2xl font-bold mb-2">Status</h2>
				<h3 class="font-bold mb-2 text-md">Listening to Spotify</h3>

				<div class="flex items-center space-x-4">
					<img src={$status.spotify.album_art_url} alt="Album Art" class="w-16 h-16 rounded" />
					<div>
						<h4 class="text-sm w-32 md:w-48 lg:w-32 xl:w-32 2xl:w-48 truncate" title={$status.spotify.song} aria-label={$status.spotify.song}>
							{$status.spotify.song}
						</h4>
						<p class="text-xs w-32 md:w-48 lg:w-32 xl:w-32 2xl:w-48 truncate" title={$status.spotify.artist} aria-label={$status.spotify.artist}>
							by {$status.spotify.artist}
						</p>
						<p class="text-xs w-32 md:w-48 lg:w-32 xl:w-32 2xl:w-48 truncate" title={$status.spotify.album} aria-label={$status.spotify.album}>
							on {$status.spotify.album}
						</p>
					</div>
				</div>

				<div class="flex items-center space-x-2 mt-2">
					<span>{formatTime(Math.min(currentTime - $status.spotify.timestamps.start, $status.spotify.timestamps.end - $status.spotify.timestamps.start))}</span>
					<progress
						value={currentTime - $status.spotify.timestamps.start}
						max={$status.spotify.timestamps.end - $status.spotify.timestamps.start}
						class="w-3/4 rounded-xl [&::-webkit-progress-bar]:rounded-lg [&::-webkit-progress-value]:rounded-lg [&::-webkit-progress-bar]:bg-slate-300 [&::-webkit-progress-value]:bg-viola-400 [&::-moz-progress-bar]:bg-viola-400"
					></progress>
					<span>{formatTime($status.spotify.timestamps.end - $status.spotify.timestamps.start)}</span>
				</div>
			</div>
		{:else}
			<div class="bg-viola-100 rounded-lg p-8 m-2 shadow-lg">
				<h2 class="text-2xl font-bold mb-4">Status</h2>
				<div class="flex items-center space-x-4">
					<div class="flex-shrink-0 relative">
						{#if largeImage}
							<img src={largeImage} alt="large activity icon" class="w-16 h-16 rounded" />
						{/if}
						{#if smallImage && !largeImage}
							<img src={smallImage} alt="activity icon" class="w-16 h-16 rounded" />
						{/if}
						{#if smallImage && largeImage}
							<img src={smallImage} alt="small activity icon" class="w-6 h-6 rounded right-0 bottom-0 absolute ring-3" />
						{/if}
					</div>

					<div>
						<h3 class="text-sm font-bold">{activity.name}</h3>
						<p class="text-xs">{activity.state}</p>
						<p class="text-xs">{activity.details}</p>
						<p class="text-xs">{formatTime(currentTime - activity.created_at)} elapsed</p>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>
