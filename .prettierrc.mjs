/** @type {import("prettier").Config} */
export default {
	tabWidth: 4,
	useTabs: true,
	printWidth: 200,
	trailingComma: "none",
	plugins: ["prettier-plugin-astro", "prettier-plugin-tailwindcss"],
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
