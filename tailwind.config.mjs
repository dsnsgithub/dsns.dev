import defaultTheme from "tailwindcss/defaultTheme";

/** @type {import('tailwindcss').Config} */
export default {
	content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
	theme: {
		extend: {
			colors: {
				viola: {
					50: "#faf5f7",
					100: "#f6edf1",
					200: "#eedce3",
					300: "#e2bfcd",
					400: "#c98aa2",
					500: "#bd7790",
					600: "#a85a72",
					700: "#8f475b",
					800: "#773d4c",
					900: "#653642",
					950: "#3b1c24"
				}
			},
			fontFamily: {
				sans: ["DM Sans Variable", ...defaultTheme.fontFamily.sans]
			}
		}
	},
	plugins: [require("tailwind-scrollbar")({ nocompatible: true, preferredStrategy: "pseudoelements" }), require("@tailwindcss/typography")]
};
