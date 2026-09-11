// Pure logic for the task switcher — no Quickshell imports so it stays testable.
.pragma library

// MRU order of newly fetched clients: the currently focused window (fhid 0,
// which is the one holding SUPER when the switcher opens) goes to the end so
// the cycle starts on the second-most-recent window, matching the macOS
// Cmd+Tab behavior. Everything else sorts ascending by focusHistoryID.
// Returns the flattened window list in cycle order.
function orderClients(clients) {
    const rest = [];
    let active = null;

    for (const c of clients) {
        if (c.pinned) continue;
        const fhid = c.focusHistoryID === undefined ? 0 : c.focusHistoryID;
        if (fhid === 0) {
            active = c;
            continue;
        }
        rest.push(c);
    }

    rest.sort((a, b) => a.focusHistoryID - b.focusHistoryID);

    const ordered = rest;
    if (active) ordered.push(active);
    return ordered;
}

// Group the cycle-ordered windows by workspace (ascending id), preserving the
// global MRU order within each workspace. Returns [{ id, name, entries }].
function groupByWorkspace(ordered) {
    const groups = [];
    const map = {};

    for (const c of ordered) {
        const wsId = c.workspace.id;
        if (!(wsId in map)) {
            map[wsId] = { id: wsId, name: c.workspace.name, entries: [] };
            groups.push(map[wsId]);
        }
        map[wsId].entries.push(c);
    }

    groups.sort((a, b) => a.id - b.id);
    return groups;
}

// Chromium toplevel titles carry a window-suffix for the active tab
// (e.g. "<tab title> - Chromium"). Match a CDP tab title against a window
// title ignoring that suffix, so a multi-window browser resolves each tab to
// the window that actually hosts it.
function tabTitleMatches(winTitle, tabTitle) {
    const w = String(winTitle || "").trim();
    const t = String(tabTitle || "").trim();
    if (!w || !t) return false;
    if (w === t) return true;
    for (const suffix of [" - Chromium", " - chromium", " - Google Chrome", " - google-chrome", " - chrome"]) {
        if (w === t + suffix) return true;
    }
    return false;
}

// Build tab records from a Chrome DevTools Protocol /json/list payload. Each
// page target becomes a card entry (`kind: "tab"`) carrying the data needed to
// activate/close it over CDP. The `browserAddr` field is resolved so that
// activating a tab can also raise the Chromium toplevel that hosts it:
// exact-title match first, then the most-recently-focused Chromium window in
// the caller's window list. Internal pages (chrome://, extension pages, devtools,
// about:) are skipped — they are not meaningful switcher targets.
function tabRecords(tabs, winRecords) {
    if (!Array.isArray(tabs)) return [];

    const windows = (winRecords || []).filter(
        w => w && !w.dead && /chrom(e|ium)/i.test(String(w.cls || ""))
    );
    // ascending focusHistoryID = least-recently-used first, so the last element
    // is the most recently focused window (the CDP-activate fallback).
    windows.sort((a, b) => (a.fhid || 0) - (b.fhid || 0));

    const records = [];
    for (const t of tabs) {
        if (!t || t.type !== "page" || !t.id) continue;
        const url = String(t.url || "");
        if (/^(chrome|chrome-extension|devtools|edge|opera|about):/i.test(url)) continue;

        const title = String(t.title || "").trim() || url || "Chromium";
        let addr = "";
        for (const w of windows) {
            if (tabTitleMatches(w.title, title)) { addr = w.address; break; }
        }
        if (!addr && windows.length) addr = windows[windows.length - 1].address;
        const win = windows.find(w => w.address === addr) || null;

        records.push({
            kind: "tab",
            address: "chromium-tab:" + t.id,
            tabId: t.id,
            title: title,
            url: url,
            faviconUrl: String(t.faviconUrl || ""),
            cls: "chromium",
            browserAddr: addr,
            workspaceId: win ? win.workspaceId : -1,
            workspaceName: win ? win.workspaceName : "-",
            fhid: 0,
            dead: false,
            handle: null
        });
    }
    return records;
}

// Icon cascade: desktop entry by id variants -> StartupWMClass scan ->
// app Name-substring-of-title scan (Chrome PWAs) -> icon theme variants ->
// generic. Mirrors the icon resolution pattern used elsewhere in Omarchy.
function iconPathFor(DesktopEntries, Quickshell, cls, title) {
    const clsLower = String(cls || "").toLowerCase();
    for (const v of [cls, clsLower, cls.replace(/-/g, ""), cls.split(".")[0]]) {
        if (!v) continue;
        const e = DesktopEntries.byId(v);
        if (e && e.icon) return Quickshell.iconPath(e.icon, "application-x-executable");
    }

    const all = DesktopEntries.applications.values;
    for (const e of all) {
        if (e.startupClass && e.startupClass.toLowerCase() === clsLower && e.icon)
            return Quickshell.iconPath(e.icon, "application-x-executable");
    }

    const titleLower = String(title || "").toLowerCase();
    if (titleLower) {
        for (const e of all) {
            const n = String(e.name || "").toLowerCase();
            if (n && titleLower.includes(n) && e.icon)
                return Quickshell.iconPath(e.icon, "application-x-executable");
        }
    }

    for (const v of [cls, clsLower, cls.split("-")[0], cls.split(".").pop()]) {
        if (!v) continue;
        const p = Quickshell.iconPath(v, true);
        if (p) return p;
    }

    return Quickshell.iconPath("application-x-executable");
}
