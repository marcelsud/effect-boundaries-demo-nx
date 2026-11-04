import nx from "@nx/eslint-plugin"
import parser from "@typescript-eslint/parser"

export default [
  { ignores: ["**/dist/**", "**/node_modules/**", ".nx/**"] },
  {
    files: ["**/*.ts"],
    languageOptions: { parser },
    plugins: { "@nx": nx },
    rules: {
      "@nx/enforce-module-boundaries": ["error", {
        allow: [],
        banTransitiveDependencies: true,
        depConstraints: [
          { sourceTag: "scope:catalog", onlyDependOnLibsWithTags: ["scope:logistics", "scope:pricing"] },
          { sourceTag: "scope:logistics", onlyDependOnLibsWithTags: ["scope:logistics"] },
          { sourceTag: "scope:pricing", onlyDependOnLibsWithTags: ["scope:pricing"] },
          { sourceTag: "scope:architecture", onlyDependOnLibsWithTags: ["scope:catalog", "scope:logistics", "scope:pricing"] },
          { sourceTag: "scope:app", onlyDependOnLibsWithTags: ["scope:catalog", "scope:logistics", "scope:pricing"] }
        ]
      }]
    }
  }
]
