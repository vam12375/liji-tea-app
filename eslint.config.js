//https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    settings: {
      "import/parsers": {
        "@typescript-eslint/parser": [".ts", ".tsx"],
      },
 "import/resolver": {
        typescript: {
          project: "./tsconfig.json",
        },
        node: {
          extensions: [".js", ".jsx", ".ts", ".tsx"],
        },
      },
      "import/core-modules": ["jsr:@supabase/supabase-js@2"],
    },
ignores: ["dist/*", ".expo/*", ".expo/**"],
  },
  {
    files: ["supabase/functions/**/*.ts"],
    rules: {
      "import/first": "off",
      "unicode-bom": "off",
    },
  },
]);
