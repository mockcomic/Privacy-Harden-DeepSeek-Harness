# English-only documentation

Repository documentation, the documentation website, and product UI copy are English. Do not add `*.zh.md` counterparts, `*.i18n.yaml` pairing records, or a second UI locale.

`pnpm run verify-translation-pairing` rejects any `*.zh.md` or `*.i18n.yaml` file outside ignored dependency trees. Frozen Agent Notes under `.agents/notes/archived/` keep their sealed English bytes, including a historical language-switcher line; their Chinese siblings are not part of the archive.

Client UI strings stay in typed English dictionaries and reach components through `t`. The shipped locale set is English.
