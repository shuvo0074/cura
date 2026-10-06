/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#003580",
        secondary: "#F4F6F8",
        accent: "#FFB700",
        action: "#006CE4",
      },
    },
  },
  plugins: [],
}
