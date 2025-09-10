const config = {
  plugins: [
    [
      "@tailwindcss/postcss",
      {
        // Limit Tailwind's file scanning to the project to avoid EPERM scandir on Windows special folders
        content: [
          "./app/**/*.{ts,tsx,js,jsx,mdx}",
          "./components/**/*.{ts,tsx,js,jsx}",
          "./pages/**/*.{ts,tsx,js,jsx}",
          "./src/**/*.{ts,tsx,js,jsx}",
          "./index.html",
        ],
      },
    ],
  ],
};

export default config;
