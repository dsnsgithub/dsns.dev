import { z, defineCollection } from "astro:content";

const posts = defineCollection({
	type: "content",
	schema: z.object({
		title: z.string(),
		description: z.string(),
		date: z.string().transform((str) => new Date(str)),
	})
});

export const collections = { posts };
