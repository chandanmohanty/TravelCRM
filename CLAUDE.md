## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)

Known limitations (read these before trusting god-node lists):
- The AST extractor's symbol resolver does not track types, scopes, or imports. For methods with common verb names (`.Get()`, `.Add()`, `.Filter()`, `.Handle()`, `.Update()`, `.Delete()`, `.List()`, `.Create()`), the reported degree is unreliable — the resolver picks one arbitrary winner among same-named symbols and attributes all calls to it. This applies both within a language (e.g. an `Array.prototype.filter(...)` call resolving to a user-defined `filter()` method on a component) and across languages (e.g. an Angular `httpClient.get(...)` call resolving to a C# `Controller.Get()` action method).
- When reading `GRAPH_REPORT.md` god-node lists, trust distinctively-named symbols (e.g. `IRequestHandler`, `SaveChangesAsync`, `TestFakes.HasPermission`, `AvailabilityCalculator`) and discount verb-named ones — especially when they appear to bridge unrelated communities. A verb-named symbol bridging seven different feature areas is almost always a name-collision artifact, not real architecture.
- Same-language same-name collisions inside the codebase ARE fixable in code: rename the colliding symbol to something distinctive, or delete it if it's dead code. (Example: `AvailabilityResult.Ok()`/`Fail()` were renamed to `Available()`/`Unavailable()` in commit 2b86881; the same-named factories on `ApiEnvelope` were dead and removed in 1eee8f7.) Cross-language collisions (TS-to-C# or vice versa) cannot be fixed in code because both names are framework-correct in their own languages.
