import type { APIRoute } from "astro";
import { hangoutClient, hangoutFailure } from "../../../../lib/eq/hangout-server";

export const prerender = false;
export const GET: APIRoute = async () => {
	try {
		const catalog = await hangoutClient.catalog();
		return Response.json(catalog, { headers: { "Cache-Control": catalog.warnings.length ? "no-store" : "public, max-age=300, s-maxage=3600, stale-while-revalidate=3600" } });
	} catch (error) {
		return hangoutFailure(error);
	}
};
