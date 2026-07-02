import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const posts = defineCollection({
	loader: glob({ pattern: "**/*.mdx", base: "./src/content/posts" }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		date: z.string().transform((str) => new Date(str))
	})
});

export const collections = { posts };
