import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // La clave secreta de Supabase solo puede usarse desde estos archivos.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/server/repositories/food-cache-writer.ts", "src/server/account/delete-account.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/server/supabase/admin",
              message: "La clave secreta saltea RLS: solo se usa en los archivos permitidos (ver docs/SEGURIDAD.md).",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
