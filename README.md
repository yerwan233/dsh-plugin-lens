# dsh-plugin-lens

An enhancement layer for the official DSH **Plugins** page: it adds an
**Overview** tab and a **Source** block on every bundle's detail page.

插件管理的增强层：在官方「插件」页加「总览」标签，在详情页加「来源归属」区块。

It does **not** modify the desktop core, the sidebar, or the official
install / uninstall / upgrade / configure flows — those stay where they are.

## What the Overview tab gives you

- **Stats bar**: total, local lab, packed, built-in, error, disabled, uninstalled.
- **Search** across name, version, description, source, component names,
  aliases, notes, category names and tags (space-separated terms are ANDed).
- **Filters**: all / error / disabled / local lab / packed / built-in /
  uninstalled. Uninstalled placeholders stay hidden until you ask for them.
- **Categories**: your own categories, a package can belong to several (up to
  24), rename and delete without touching packages.
- **Grouping**: by category / source / purpose (8 groups) / status / none, all
  collapsible.
- **Sorting and paging**: name, status, source, version, component count or a
  custom order; 20 / 50 / 100 rows per page.
- **Compact rows**: status dot, alias, version, source badge, component and
  running counts, inline edit, enable/disable.
- **Inline editing**: alias, multi-line note, purpose, categories, tags, pin,
  reset to default; drag rows to set a custom order.
- **Sidebar entry management**: show or hide any plugin's sidebar entry from
  the overview (local to this machine).
- **Uninstall placeholders**: a removed bundle keeps its row and your local
  settings, and comes back when you reinstall it.
- **Detail block**: source type, original declaration, local path (copyable),
  runtime summary, override rows, readonly reason, error code.

## Requirements

- DSH desktop with the plugin manager.
- Node.js 22+ inside the DSH runtime.
- No third-party runtime dependencies (only the `react` the host provides).

## Install

1. Open DSH desktop → **Plugins → Add plugin**.
2. Enter `dsh-plugin-lens` (or a Git URL / local path to this package).
3. Quit the app from the tray and relaunch.

The Host half is a single composition row; all the work is in the browser
module. Host changes can be hot-reloaded by toggling the plugin, client changes
need a page refresh.

## Where the state lives

- UI state (search, filter, grouping, sort, page, collapse, alias, note,
  purpose, pin, custom order): `localStorage` key `dsh-plugin-lens.v1.ui`.
- Bundle history used for uninstall placeholders:
  `localStorage` key `dsh-plugin-lens.v1.history`.
- Sidebar hiding tags matching `button[class*="panelRow"]` with
  `data-plugin-center-hidden`, kept in place by a `MutationObserver` plus a
  1.5 s poll, because the core exposes no API to unregister another plugin's
  slot.

## Design constraints

- Registers only two officially declared slots: `plugins.tab`
  (id `plugin-center`, order `-2`) and `plugins.detail.section`
  (id `plugin-center-source`, order `80`).
- Only `require('react')`; colours come from `--dsw-alias-*` tokens; CSS is
  prefixed `dpc-` and injected once.
- Reads through `ctx.remote.pluginManager.listBundles() / listPlugins()` and
  toggles through `setBundleEnabled()`.

## Known limitations

- Hiding a sidebar entry is DOM-based and re-applies on a 1.5 s timer; a core
  UI change can break the row selector.
- Categories, tags, notes, aliases and ordering are local to this machine
  (`localStorage`), they are not synchronised anywhere.
- An "uninstalled" row is only a placeholder; it never reinstalls anything.
- Introductions fall back to a built-in English→Chinese table; packages it does
  not know keep their English description.

## License

MIT. See [LICENSE](LICENSE).
