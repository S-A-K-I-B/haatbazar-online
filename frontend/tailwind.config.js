/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/pages/**/*.{js,ts,jsx,tsx}", "./src/components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        haat: {
          green: "#046A38",
          greenDark: "#0A2E1C",
          red: "#E53935",
          cream: "#FBF7EE",
          ink: "#1B3A4B",
          terracotta: "#C1652F",
          gold: "#D4A017",
        },
      },
      fontFamily: {
        display: ["'Baloo Da 2'", "sans-serif"],
        body: ["'Hind Siliguri'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
