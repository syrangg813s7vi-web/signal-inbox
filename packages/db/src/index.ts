export interface DatabaseModulePlaceholder {
  readonly scope: "schema" | "migrations" | "client";
}

export const databaseModuleScopes: DatabaseModulePlaceholder["scope"][] = [
  "schema",
  "migrations",
  "client"
];
