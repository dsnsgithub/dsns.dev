import type { APIRoute } from "astro";
import { HangoutError, hangoutClient, hangoutFailure } from "../../../../lib/eq/hangout-server";

export const prerender = false;
export const GET: APIRoute = async ({ url }) => {
	try {
		const id = url.searchParams.get("id");
		if (!id) throw new HangoutError("A measurement ID is required.", 400);
		return Response.json(await hangoutClient.measurement(id), { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" } });
	} catch (error) {
		return hangoutFailure(error);
	}
};
