import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

// eslint-config-next 15.x ships the old (eslintrc) format, so it goes through FlatCompat.
// Spreading it directly made eslint fail to load ("nextVitals is not iterable"): no rule ran.
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

// Travel website (not the shop). Owner decision 2026-11-18: its old problems are warnings until
// the redesign; everything else (POS, /cafe, /staff, lib, shop components) must be clean.
const TRAVEL_SITE = [
  "app/page.tsx", "app/not-found.tsx", "app/sitemap.ts",
  "app/about/**", "app/admin/**", "app/api/admin/**", "app/become-a-guide/**", "app/contact/**",
  "app/destinations/**", "app/experiences/**", "app/guides/**", "app/map/**",
  "components/DestinationMap.tsx", "components/Footer.tsx", "components/HomeClient.tsx",
  "components/InquiryModal.tsx", "components/Navbar.tsx",
];

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    linterOptions: { reportUnusedDisableDirectives: "error" },
    // the shop side: rules Next.js ships as warnings count as errors too
    rules: {
      "react-hooks/exhaustive-deps": "error",
      "jsx-a11y/alt-text": "error",
      // next.config.ts sets images.unoptimized (no image optimiser on Cloudflare Pages), and most
      // images here are camera/blob/data previews: <Image> would change nothing but the markup.
      "@next/next/no-img-element": "off",
      // `const { dropped: _x, ...rest } = obj` is how a field is left out of a copy
      "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true }],
    },
  },
  {
    files: TRAVEL_SITE,
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { ignoreRestSiblings: true }],
      "@next/next/no-html-link-for-pages": "warn",
      "react/no-unescaped-entities": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "jsx-a11y/alt-text": "warn",
    },
  },
  {
    ignores: [".next/**", ".vercel/**", "out/**", "build/**", "next-env.d.ts", "supabase/functions/**", "print-server/**", ".shots-tmp/**"],
  },
];

export default eslintConfig;
