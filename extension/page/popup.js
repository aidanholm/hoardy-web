/*
 * The settings popup page.
 *
 * Copyright (c) 2023-2024 Jan Malakhovski <oxij@oxij.org>
 *
 * This file is a part of `hoardy-web` project.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";

let dbody = document.body;

const tagNames = ["common", "main", "bg", "this", "class", "pr", "run", "ui", "all"];

function showTab(name) {
    //implySetConditionalClass(dbody, "more", "hidden", !condition);
    //implySetConditionalClass(dbody, "less", "hidden", condition);

    for (let node of document.getElementById("tags").getElementsByClassName("active"))
        node.classList.remove("active");
    document.getElementById(`showTag-${name}`).classList.add("active");

    if (name == "all") {
        for (let tn of tagNames)
            for (let node of document.getElementsByClassName(`tag-${tn}`))
                node.classList.remove("hidden");
    } else {
        for (let tn of tagNames)
            for (let node of document.getElementsByClassName(`tag-${tn}`))
                node.classList.add("hidden");

        for (let node of document.getElementsByClassName(`tag-${name}`))
            node.classList.remove("hidden");
    }

    if (name !== "common")
        for (let node of dbody.getElementsByTagName("input")) {
            let ti = node.getAttribute("tabindex");
            if (ti !== null && ti != -1) {
                node.removeAttribute("tabindex");
                node.setAttribute("less-tabindex", ti);
            }
        }
    else
        for (let node of dbody.getElementsByTagName("input")) {
            let ti = node.getAttribute("less-tabindex");
            if (ti !== null)
                node.setAttribute("tabindex", ti);
        }
}

function present(obj) {
    for (let [k, v] of Object.entries(obj)) {
        let typ = typeof v;
        if (typ === "number") {
            if (k.endsWith("_size"))
                obj[k] = byteLengthToString(v);
            else
                obj[k] = countToString(v);
        }
    }
    return obj;
}

async function popupMain() {
    implySetConditionalOff(dbody, "on-firefox", useDebugger);
    implySetConditionalOff(dbody, "on-chromium", !useDebugger);
    implySetConditionalOff(dbody, "on-desktop", isMobile);
    implySetConditionalOff(dbody, "on-mobile", !isMobile);

    let hash = document.location.hash.substr(1);
    let tabId;
    let windowId;

    let tabbing = false;
    if (hash === "options") {
        document.getElementById("tags").style.display = "none";
        document.getElementById("this-tab-options").style.display = "none";
        document.getElementById("this-tab-children-options").style.display = "none";
    } else if (hash == "all") {
        document.getElementById("tags").style.display = "none";
    } else {
        let tab = await getActiveTab();
        if (tab !== null) {
            windowId = tab.windowId;
            tabId = getStateTabIdOrTabId(tab);
        } else {
            // This happens when the user opens the "Help" page from the
            // settings menu on Fenix. Disabling `tabbing` will make the page
            // useless, so we fake these values instead.
            windowId = 0;
            tabId = 0;
        }
        tabbing = true;
    }

    // generate UI
    let body = document.getElementById("body");
    makeUI(body);

    let shortcuts = await getShortcuts();
    addHelp(body, shortcuts
            , (help, shortcut) => shortcut ? `(\`${shortcut}\`) ${help}` : `(unbound) ${help}`);

    // allow to un-highlight currently highlighted node
    dbody.addEventListener("click", (event) => {
        highlightNode(null);
    });

    // emoji labels for the UI buttons
    let emojiButtons = {
        reloadSelf: "（🌟ω🌟）",
        snapshotAll: "📸",
        replayAll: "⏏",
        forgetHistory: "🧹",
        showState: "📜",
        runActions: "🟢",
        cancelActions: "🟥",
        exportAsAll: "💾",
        retryFailed: "♻",
        retryUnarchived: "♻",
        stashAll: "💾",
        retryUnstashed: "♻",
        collectAllInLimbo: "✔",
        discardAllInLimbo: "✖",
        unmarkAllProblematic: "🧹",
        stopAllInFlight: "⏹",
        snapshotTab: "📸",
        replayTabBack: "⏮",
        //replayTabForward: "⏭",
        forgetTabHistory: "🧹",
        showTabState: "📜",
        collectAllTabInLimbo: "✔",
        discardAllTabInLimbo: "✖",
        unmarkAllTabProblematic: "🧹",
        stopTabInFlight: "⏹",
    };

    // populate with the original values from the ./popup.html
    let emojiButtonsOriginals = {};
    for (let k of Object.keys(emojiButtons)) {
        let node = document.getElementById(k);
        emojiButtonsOriginals[k] = node.value;
    }

    // sync config state and UI state
    let pureTextState = true;
    function resetPureText(config) {
        if (pureTextState == config.pureText)
            return;

        if (config.pureText)
            setUI(document, undefined, emojiButtonsOriginals);
        else
            setUI(document, undefined, emojiButtons);

        pureTextState = config.pureText;
    }

    async function replaceWith(open, prefix, id, isHelp) {
        if (isMobile) {
            let config = await browser.runtime.sendMessage(["getConfig"]);
            let spawn = config.spawnNewTabs;
            await open(prefix, id, tabId, spawn);
            if (spawn && config.invisibleUINotify)
                // Firefox on Android does not switch to new tabs opened from the settings
                browser.notifications.create("pageSpawnedAway", {
                    title: "Hoardy-Web: REMINDER",
                    message: escapeNotification(config, "The newly spawned page might be hidden. See the list of open tabs or the list open private tabs, depending on the browser's mode." + annoyingNotification(config, "Generate notifications about > ... mobile UI quirks")),
                    iconUrl: iconURL("main", 128),
                    type: "basic",
                }).catch(logError);
            else if (!spawn && isHelp && config.invisibleUINotify)
                // Firefox on Android does not switch to new tabs opened from the settings
                browser.notifications.create("pageNotSpawnedAway", {
                    title: "Hoardy-Web: REMINDER",
                    message: escapeNotification(config, `To make the search work on the "Help" page, enable "User Interface and Accessibility > Spawn internal pages in new tabs" option, open the "Help" page again, and then switch to the newly spawned tab.` + annoyingNotification(config, "Generate notifications about > ... mobile UI quirks")),
                    iconUrl: iconURL("main", 128),
                    type: "basic",
                }).catch(logError);
        } else {
            await open(prefix, id, tabId);
            window.close();
        }
    }

    async function resetAndReplace(reset, open, ...args) {
        // reset given config setting
        await browser.runtime.sendMessage(["setConfig", reset]);
        // and then replace this page with
        await replaceWith(open, ...args);
    }

    let versionButton = document.getElementById("version");
    versionButton.value = "v" + manifest.version;
    versionButton.onclick = catchAll(() => resetAndReplace({ seenChangelog: true }, showChangelog, "", ""));

    let helpButton = document.getElementById("showHelp");
    helpButton.onclick = catchAll(() => resetAndReplace({ seenHelp: true }, showHelp, "", "", true));
    // NB: `spawn = true` here because otherwise on Fenix a large chunk of the
    // page will be taken by the navigation toolbar and there will be no
    // search function, which is very useful there.

    let reloadSelfButton = buttonToMessage("reloadSelf");
    buttonToMessage("cancelReloadSelf");
    buttonToAction("showState", catchAll(() => replaceWith(showState, "", "top")));
    buttonToMessage("forgetHistory",           () => ["forgetHistory", null]);
    buttonToMessage("snapshotAll",             () => ["snapshot", null]);
    buttonToMessage("replayAll",               () => ["replay", null, null]);
    buttonToMessage("exportAsAll",             () => ["exportAs", null]);
    buttonToMessage("collectAllInLimbo",       () => ["popInLimbo", true, null, null]);
    buttonToMessage("discardAllInLimbo",       () => ["popInLimbo", false, null, null]);
    buttonToMessage("unmarkAllProblematic",    () => ["unmarkProblematic", null, null]);
    buttonToMessage("stopAllInFlight",         () => ["stopInFlight", null]);

    buttonToAction("showTabState", catchAll(() => replaceWith(showState, `?tab=${tabId}`, "top")));
    buttonToMessage("forgetTabHistory",        () => ["forgetHistory", tabId]);
    buttonToMessage("snapshotTab",             () => ["snapshot", tabId]);
    buttonToMessage("replayTabBack",           () => ["replay", tabId, false]);
    //buttonToMessage("replayTabForward",        () => ["replay", tabId, true]);
    buttonToMessage("collectAllTabInLimbo",    () => ["popInLimbo", true, null, tabId]);
    buttonToMessage("discardAllTabInLimbo",    () => ["popInLimbo", false, null, tabId]);
    buttonToMessage("unmarkAllTabProblematic", () => ["unmarkProblematic", null, tabId]);
    buttonToMessage("stopTabInFlight",         () => ["stopInFlight", tabId]);

    buttonToMessage("runActions");
    buttonToMessage("cancelActions");
    buttonToMessage("deleteErrored");
    buttonToMessage("retryFailed");
    buttonToMessage("retryUnarchived");
    buttonToMessage("stashAll");
    buttonToMessage("retryUnstashed");
    buttonToAction("showSaved",    catchAll(() => replaceWith(showSaved, "", "top")));

    buttonToAction("resetPersistentStats", catchAll(() => {
        if (!window.confirm("Really?"))
            return;

        browser.runtime.sendMessage(["resetPersistentStats"]).catch(logError);
    }));
    buttonToAction("resetConfig", catchAll(() => {
        if (!window.confirm("Really?"))
            return;

        browser.runtime.sendMessage(["resetConfig"]).catch(logError);
    }));

    for (let tn of tagNames)
      buttonToAction(`showTag-${tn}`, catchAll(() => {
          showTab(tn);
          broadcast(["popupResized"]);
      }));

    let config;

    async function updateConfig(nconfig) {
        if (nconfig === undefined)
            config = await browser.runtime.sendMessage(["getConfig"]);
        else
            config = nconfig;

        setUI(document, "config", config, (newconfig, path) => {
            switch (path) {
            case "config.workOffline":
                if (newconfig.workOfflineImpure)
                    newconfig.collecting = !newconfig.workOffline;
                break;
            case "config.root.workOffline":
                if (newconfig.workOfflineImpure)
                    newconfig.root.collecting = !newconfig.root.workOffline;
                break;
            case "config.background.workOffline":
                if (newconfig.workOfflineImpure)
                    newconfig.background.collecting = !newconfig.background.workOffline;
                break;
            case "config.extension.workOffline":
                if (newconfig.workOfflineImpure)
                    newconfig.extension.collecting = !newconfig.extension.workOffline;
                break;
            case "config.autoPopInLimboCollect":
                newconfig.autoPopInLimboDiscard = newconfig.autoPopInLimboDiscard && !newconfig.autoPopInLimboCollect;
                break;
            case "config.autoPopInLimboDiscard":
                newconfig.autoPopInLimboCollect = newconfig.autoPopInLimboCollect && !newconfig.autoPopInLimboDiscard;
                break;
            }
            browser.runtime.sendMessage(["setConfig", newconfig]).catch(logError);
        });

        setRootClasses(config);
        resetPureText(config);
        setConditionalClass(versionButton, "attention", !config.seenChangelog);
        setConditionalClass(helpButton, "attention", !config.seenHelp);

        implySetConditionalOff(dbody, "on-seasonal", !config.seasonal);
        implySetConditionalOff(dbody, "on-collecting", !config.collecting);
        implySetConditionalOff(dbody, "on-stash", !config.stash);
        implySetConditionalOff(dbody, "on-archive", !config.archive);
        implySetConditionalOff(dbody, "on-exportAs", !(config.archive && config.archiveExportAs));
        implySetConditionalOff(dbody, "on-exportAsBundle", !config.exportAsBundle);
        implySetConditionalOff(dbody, "on-useHTTP", !(config.archive && config.archiveSubmitHTTP
                                                      || config.replaySubmitHTTP));
        implySetConditionalOff(dbody, "on-LS", !config.stash && !(config.archive && config.archiveSaveLS));
        implySetConditionalOff(dbody, "on-auto", !config.autoUnmarkProblematic && !config.autoPopInLimboCollect && !config.autoPopInLimboDiscard);
        implySetConditionalOff(dbody, "on-problematicNotify", !config.problematicNotify);
        implySetConditionalOff(dbody, "on-limboNotify", !config.limboNotify);
    }

    async function updateStats(stats) {
        if (stats === undefined)
            stats = await browser.runtime.sendMessage(["getStats"]);
        setUI(document, "stats", present(stats));

        setConditionalClass(reloadSelfButton, "attention", stats.update_available);
        implySetConditionalClass(dbody, "on-reload",  "hidden", !hash && !(stats.update_available || config.debugging));
        implySetConditionalClass(dbody, "on-pending", "hidden", !stats.reload_pending);
        implySetConditionalOff(dbody, "on-replay", !(config.replaySubmitHTTP !== false && stats.can_replay));
    }

    async function updateTabConfig(tabconfig) {
        if (tabconfig === undefined)
            tabconfig = await browser.runtime.sendMessage(["getTabConfig", tabId]);
        setUI(document, "tabconfig", tabconfig, (newtabconfig, path) => {
            switch (path) {
            case "tabconfig.snapshottable":
                newtabconfig.children.snapshottable = newtabconfig.snapshottable;
                break;
            case "tabconfig.replayable":
                newtabconfig.children.replayable = newtabconfig.replayable;
                break;
            case "tabconfig.workOffline":
                if (config.workOfflineImpure)
                    newtabconfig.collecting = !newtabconfig.workOffline;
                newtabconfig.children.workOffline = newtabconfig.workOffline;
                if (config.workOfflineImpure)
                    newtabconfig.children.collecting = newtabconfig.collecting;
                break;
            case "tabconfig.children.workOffline":
                if (config.workOfflineImpure)
                    newtabconfig.children.collecting = !newtabconfig.children.workOffline;
                break;
            case "tabconfig.collecting":
                newtabconfig.children.collecting = newtabconfig.collecting;
                break;
            case "tabconfig.problematicNotify":
                newtabconfig.children.problematicNotify = newtabconfig.problematicNotify;
                break;
            case "tabconfig.limbo":
                newtabconfig.children.limbo = newtabconfig.limbo;
                break;
            case "tabconfig.negLimbo":
                newtabconfig.children.negLimbo = newtabconfig.negLimbo;
                break;
            case "tabconfig.stashLimbo":
                newtabconfig.children.stashLimbo = newtabconfig.stashLimbo;
                break;
            case "tabconfig.bucket":
                newtabconfig.children.bucket = newtabconfig.bucket;
                break;
            }
            browser.runtime.sendMessage(["setTabConfig", tabId, newtabconfig]).catch(logError);
        });
    }

    async function updateTabStats(tabstats) {
        if (tabstats === undefined)
            tabstats = await browser.runtime.sendMessage(["getTabStats", tabId]);

        setUI(document, "tabstats", present(tabstats));
    }

    // set default UI state
    showTab(!!hash ? "all" : "common");

    async function processUpdate(update) {
        let [what, arg1, arg2] = update;
        switch (what) {
        case "updateConfig":
            await updateConfig(arg1);
            break;
        case "updateStats":
            await updateStats(arg1);
            break;
        case "updateTabConfig":
            if (tabbing && (arg1 === null || arg1 === tabId))
                await updateTabConfig(arg2);
            break;
        case "updateTabStats":
            if (tabbing && (arg1 === null || arg1 === tabId))
                await updateTabStats(arg2);
            break;
        case "switchTab":
            // the tab was switched
            if (arg1 === windowId)
                tabId = arg2;
            break;
        default:
            await handleDefaultUpdate(update, "popup", () => showTab("all"));
        }
    }

    await subscribeToExtension(catchAll(processUpdate), catchAll(async (willReset) => {
        await updateConfig();
        await updateStats();
        if (willReset()) return;
        if (tabbing) {
            await updateTabConfig();
            await updateTabStats();
        }
    }), (event) => {
        let cmd = event[0];
        return !(cmd.startsWith("update") || cmd === "switchTab");
    }, setPageLoading, setPageSettling);

    // show UI
    setPageLoaded();

    // highlight current target
    // NB: not using showAll and hideAll here, so that unhighlight will not shrink the UI
    focusHashNode();

    // notify the others we are done here
    broadcast(["popupResized"]);
}

document.addEventListener("DOMContentLoaded", () => popupMain().catch(setPageError), setPageError);
