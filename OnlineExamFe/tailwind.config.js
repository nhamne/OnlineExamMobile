/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './index.{js,jsx,ts,tsx}', './**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        "surface-variant": "#e0e2ec",
        "primary": "#005bbf",
        "outline": "#727785",
        "on-surface": "#191c23",
        "surface-dim": "#d8d9e3",
        "surface-container-lowest": "#ffffff",
        "surface-tint": "#005bc0",
        "on-surface-variant": "#414754",
        "primary-container": "#1a73e8",
        "background": "#f9f9ff",
        "surface-container-low": "#f2f3fd",
        "surface-container-highest": "#e0e2ec",
        "outline-variant": "#c1c6d6",
        "surface-container": "#ecedf7",
        "surface": "#f9f9ff",
        "surface-container-low": "#f2f3fd",
        "surface-container-lowest": "#ffffff",
        "surface-container-high": "#e6e8f2",
        "surface-container-highest": "#e0e2ec",
        "outline-variant": "#c1c6d6",
        "primary": "#005bbf",
        "secondary": "#006e2c",
        "tertiary": "#9e4300",
        "on-surface": "#191c23",
        "on-surface-variant": "#414754",
      },
      fontFamily: {
        body: ["Inter"],
      }

    },
  },
  plugins: [],
};
