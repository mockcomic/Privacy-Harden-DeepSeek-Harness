---
kind: upgrade-guide
description: "The app, desktop shell, and documentation website are English only."
---

# English replaces the Chinese locale

## Change

Releases through v0.2.1-alpha.2 ship Simplified Chinese and English for the Web and Desktop interface, Desktop shell prompts, and the documentation website. Chinese is the website default, and English pages are under `/en/`.

The next release ships English only. The in-app language setting is gone. A saved `locale.preference` of `zh` opens in English. Documentation pages are served at the site root, and `/en/` routes are not published. Package `locale/zh.json` files and `*.zh.md` documents are not part of the release.

## Migration

1. Remove `zh` from `locale.preference` in the Host settings document if you set it. The key is optional; leaving `zh` still opens English.
2. Open documentation at `/guide/` rather than `/en/guide/`.
3. Confirm the Web or Desktop UI shows English labels and no language picker.
