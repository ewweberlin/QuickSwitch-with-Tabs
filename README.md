# QuickSwitch — macOS-style task switcher for Omarchy/Hyprland

A beautiful, themed window/task switcher in the style of the macOS app switcher, built as an
[Omarchy](https://omarchy.org/) shell plugin (QML hosted by the long-running
`omarchy-shell` Quickshell process).

<img width="2248" height="722" alt="screenshot-2026-09-04_03-21-39" src="https://github.com/user-attachments/assets/0e77e772-13e6-4798-ae91-3ad1c6844d77" />


## Features

- **SUPER+TAB** opens the switcher.
- tap **TAB (or Arrow Keys)** repeatedly while holding SUPER to advance the selection (most-recently-used order, current window skipped).
- **Mouse hover** highlights an item; **click** activates it.
- **SUPER+Q** quits the highlighted app.
- **Release SUPER** to activate the selected window — which switches you to
  that window's **workspace**.
- **Chromium tabs** appear as their own cards (site favicon + Chromium icon).
  Selecting one activates the **exact tab** and raises the browser window;
  **SUPER+Q** closes the tab while the switcher is open.
- Every item is a **still window snapshot** (captured when the switcher opens)
  with the **app icon in the top-left corner**, arranged in a horizontal strip
  centered on the screen.
- Compatible with **Omarchy Themes**. 

## Requirements

- Omarchy with the Quickshell shell (`omarchy-shell`)
- Hyprland ≥ 0.56 (Lua config) with the `hyprland-toplevel-export` /
  screencopy support for live previews
- `hyprctl` on PATH
- **Optional — Chromium tabs:** Chromium running with a
  `--remote-debugging-port` flag (the plugin auto-detects the port; see below)

## Installation

Install it from this repository with the official Omarchy tooling:

```sh
omarchy plugin add https://github.com/ewweberlin/QuickSwitch-with-Tabs.git --enable
```

This clones the repo into `~/.config/omarchy/plugins/`, and enables it.

Bindings (enables SUPER + TAB) — add this line to `~/.config/hypr/bindings.lua`:

```lua
dofile(os.getenv("HOME") .. "/.config/omarchy/plugins/ewweberlin.quickswitch/task-switch-bindings.lua")
```

Restart the shell, reload Hyprland and Bindings:

```sh
omarchy restart shell
hyprctl reload
hyprctl configerrors   # should be clean
hyprctl globalshortcuts
```

The `SUPER + TAB` shortcut should appear in `hyprctl globalshortcuts`.

### Optional — enable Chromium tabs

If you use Chromium and want its open tabs in the switcher, see the
[Chromium tabs](#chromium-tabs) section: append `--remote-debugging-port=9222`
to `~/.config/chromium-flags.conf` and fully restart Chromium. No setup at all
is needed for the plain (windows-only) switcher.

### Removal

```sh
omarchy plugin remove ewweberlin.quickswitch     # or: provide id interactively
omarchy plugin disable ewweberlin.quickswitch    # disable without deleting
```

`plugin remove` unloads and disables the plugin, then handles each install
flavor: it **unlinks** a symlinked checkout (source stays in place), **deletes**
a cloned install, or **backs up** a plain folder. `plugin add` installs from
git can be updated later with:

```sh
omarchy plugin update ewweberlin.quickswitch
```


## Behavior details

- **SUPER+TAB was already bound** in Omarchy to **"Next workspace"**
  (`hl.dsp.focus e+1`). The bindings file unbinds it first, so SUPER+TAB now
  opens the switcher. The other workspace-shortcuts (`SUPER+SHIFT+TAB`,
  `SUPER+CTRL+TAB`) are untouched.
- **SUPER+Q** quits the highlighted app only while the switcher is open. For a
  global close-this-window, **SUPER+W** already does that everywhere.
- Releasing SUPER with **no item highlighted / pointer outside** the strip
  (Esc, or clicking empty space) closes without changing focus.
- Colors come from the shell `Color` singleton, so the switcher follows the
  active Omarchy theme automatically.

## Chromium tabs

Chromium does not expose individual tabs through Hyprland, so the switcher reads
them over the **Chrome DevTools Protocol (CDP)** HTTP endpoint. This needs
Chromium to be launched with a remote debugging port:

```text
--remote-debugging-port=9222
```

On Omarchy/Arch, Chromium reads flags from `~/.config/chromium-flags.conf` — add
the line there, then **fully quit and restart Chromium** (the flag is only read
at launch). The plugin then auto-detects the live port (`DevToolsActivePort` up
first, else a `/proc` scan, else `9222`), and:

- lists every `page` target from `GET /json/list` (internal pages like
  `chrome://` are skipped, as are DevTools/extension targets),
- renders each tab as a card with its **site favicon** + the Chromium icon,
- activates the **exact tab** (`GET /json/activate/<id>`) and raises the hosting
  window when you switch to it,
- closes the tab (`GET /json/close/<id>`) for **SUPER+Q**.

No Chromium, or no debug port → the switcher behaves exactly as before (windows
only). Tabs are appended after windows in cycle order.

> **Security note:** a `--remote-debugging-port` exposes an unauthenticated
> control channel on localhost — it can read and steer the browser. It is not
> reachable from the network, but any local process could talk to it. Only
> enable it if you accept that (a local tab switcher that can't reach the port
> is the usual trade-off).

