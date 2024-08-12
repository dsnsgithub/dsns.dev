import type { APIRoute } from "astro";
import whois from "whois-json";

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
	const { domain } = params;
	if (typeof domain != "string") {
		return new Response(JSON.stringify({ error: "Not a valid domain." }), {
			status: 400,
			headers: {
				"Content-Type": "application/json"
			}
		});
	}

	const results = await whois(domain);
	return new Response(JSON.stringify(results), {
		headers: {
			"Content-Type": "application/json"
		}
	});
};
