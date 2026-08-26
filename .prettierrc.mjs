/** @type {import("prettier").Config} */
export default {
	tabWidth: 4,
	useTabs: true,
	printWidth: 200,
	trailingComma: "none",
	plugins: ["prettier-plugin-astro", "prettier-plugin-tailwindcss"],
	// Tailwind v4 is configured in CSS, so the class sorter needs the stylesheet entry point.
	tailwindStylesheet: "./src/styles/global.css",
	overrides: [
		{
			files: "*.astro",
			options: {
				parser: "astro"
			}
		},
		{
			files: "*.svelte",
			options: {
				parser: "svelte"
			}
		}
	]
};
