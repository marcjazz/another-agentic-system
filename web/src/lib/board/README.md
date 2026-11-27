# Vendored `factory-board` TypeScript SDK

Source provenance:
- Repository: `vymalo/factory-board` (`/home/marco/Projects/personnal/factory-board`)
- Commit: `6e1a60d5` (`sdk/ts/src/{index,client,models,queries,runtime,compact}.ts`)
- Schema: `schema/board.cstack` (SHA-256 `6d2214634ba5675f394c377593ef2c236043d356a452d4e5544ef4b4139f12c7`)

Local adjustment:
- `sdk/compact.ts`: uses an indirect specifier (`["@cratestack", "cbor"].join("/")`) with `/* webpackIgnore: true */` so Next.js Turbopack and Vitest do not attempt to statically bundle the optional `@cratestack/cbor` peer dependency when `compactKeys` is `false`.
- `sdk/*.ts`: the generated NodeNext `.js` suffixes on the relative imports are dropped. Turbopack does not rewrite `./client.js` to `client.ts`; the web's `moduleResolution: bundler` resolves the extensionless form.
- `web/biome.json`: excludes `src/lib/board/sdk` matching `src/lib/api/schema.d.ts` (generated code).
