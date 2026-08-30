import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import icon from "astro-icon";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";
import vercel from "@astrojs/vercel";

// https://astro.build/config
export default defineConfig({
	integrations: [icon(), react(), mdx()],
	adapter: vercel(),
	// Astro 7 defaults to "jsx", which strips the whitespace between inline
	// elements (e.g. the space before a link in a sentence).
	compressHTML: true,
	vite: {
		plugins: [tailwindcss()]
	}
});
