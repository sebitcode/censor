(() => {
  "use strict";

  const {
    normalizeHost,
    normalizeRule,
    normalizeSettings
  } = globalThis.CensorRules;
  const form = document.querySelector("#rule-form");
  const scopeSelect = document.querySelector("#scope");
  const termInput = document.querySelector("#term");
  const replacementInput = document.querySelector("#replacement");
  const ruleGroups = document.querySelector("#rule-groups");
  const status = document.querySelector("#status");

  let settings = normalizeSettings();
  let currentHost = "";
  let currentPageTitle = "";
  const expandedScopes = new Set();
  let hasInitializedExpandedScopes = false;

  form.addEventListener("submit", handleSubmit);
  ruleGroups.addEventListener("click", handleRuleAction);
  chrome.storage.onChanged.addListener(handleStorageChange);
  initialize();

  async function initialize() {
    try {
      const [stored, tabs] = await Promise.all([
        chrome.storage.sync.get({ rules: [], settings: null }),
        chrome.tabs.query({ active: true, currentWindow: true })
      ]);
      const [activeTab] = tabs;

      currentHost = getHostFromTab(activeTab);
      currentPageTitle = typeof activeTab?.title === "string" ? activeTab.title.trim() : "";
      settings = normalizeSettings(stored.settings ?? { globalRules: stored.rules });

      if (!stored.settings && Array.isArray(stored.rules)) {
        await chrome.storage.sync.set({ settings });
      }

      renderScopeOptions();
      renderSections();
      termInput.focus();
    } catch (error) {
      setStatus("Could not load saved rules.", true);
      console.error(error);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const rule = normalizeRule({
      replacement: replacementInput.value,
      term: termInput.value
    });

    if (!rule) {
      setStatus("Enter both a word and a replacement.", true);
      return;
    }

    const scope = scopeSelect.value;

    if (scope !== "global" && scope !== currentHost) {
      setStatus("Select a valid rule scope.", true);
      return;
    }

    const existingRules = getRulesForScope(scope);
    const existingIndex = existingRules.findIndex(
      (currentRule) => currentRule.term.toLowerCase() === rule.term.toLowerCase()
    );
    const nextRules = [...existingRules];

    if (existingIndex === -1) {
      nextRules.push(rule);
    } else {
      nextRules[existingIndex] = rule;
    }

    settings = updateScopeRules(scope, nextRules);
    await persistSettings(existingIndex === -1 ? "Rule added." : "Rule updated.");
    form.reset();
    renderScopeOptions(scope);
    termInput.focus();
  }

  async function handleRuleAction(event) {
    const removeButton = event.target.closest("[data-remove-scope]");

    if (!removeButton) {
      return;
    }

    const scope = removeButton.dataset.removeScope;
    const index = Number(removeButton.dataset.removeIndex);
    const nextRules = getRulesForScope(scope).filter((_rule, ruleIndex) => ruleIndex !== index);

    settings = updateScopeRules(scope, nextRules);
    await persistSettings("Rule removed.");
  }

  async function persistSettings(successMessage) {
    try {
      await chrome.storage.sync.set({ settings });
      renderSections();
      const applied = await applySettingsToActiveTab();
      setStatus(applied ? successMessage : `${successMessage} This page cannot be modified.`, !applied);
    } catch (error) {
      setStatus("Could not save the rules.", true);
      console.error(error);
    }
  }

  function handleStorageChange(changes, areaName) {
    if (areaName !== "sync" || !changes.settings) {
      return;
    }

    settings = normalizeSettings(changes.settings.newValue);
    renderSections();
  }

  function renderScopeOptions(selectedScope = scopeSelect.value) {
    scopeSelect.replaceChildren();

    const globalOption = document.createElement("option");
    globalOption.value = "global";
    globalOption.textContent = "All pages (global)";
    scopeSelect.append(globalOption);

    if (currentHost) {
      const siteOption = document.createElement("option");
      siteOption.value = currentHost;
      siteOption.textContent = `Current site — ${currentHost}`;
      scopeSelect.append(siteOption);
    }

    const availableScopes = [...scopeSelect.options].map((option) => option.value);
    scopeSelect.value = availableScopes.includes(selectedScope)
      ? selectedScope
      : currentHost || "global";
  }

  function renderSections() {
    if (!hasInitializedExpandedScopes) {
      expandedScopes.add(currentHost || "global");
      hasInitializedExpandedScopes = true;
    }

    ruleGroups.replaceChildren();
    renderSection(
      "All pages (global)",
      "Applies to every site.",
      "global",
      settings.globalRules
    );

    if (currentHost) {
      renderSection(
        `Current site — ${currentHost}`,
        currentPageTitle || "Applies only to this site.",
        currentHost,
        settings.siteRules[currentHost] ?? []
      );
    }

    Object.keys(settings.siteRules)
      .filter((host) => host !== currentHost)
      .sort()
      .forEach((host) => {
        renderSection(host, "Applies only to this site.", host, settings.siteRules[host]);
      });
  }

  function renderSection(title, description, scope, rules) {
    const section = document.createElement("details");
    section.className = "rule-group";
    section.open = expandedScopes.has(scope);
    section.addEventListener("toggle", () => {
      if (section.open) {
        expandedScopes.add(scope);
      } else {
        expandedScopes.delete(scope);
      }
    });

    const header = document.createElement("summary");
    header.className = "group-header";

    const headingContent = document.createElement("div");
    const heading = document.createElement("h2");
    heading.textContent = title;

    const descriptionElement = document.createElement("p");
    descriptionElement.className = "group-description";
    descriptionElement.textContent = description;

    const count = document.createElement("span");
    count.className = "rule-count";
    count.textContent = String(rules.length);
    count.setAttribute("aria-label", `${rules.length} rules`);

    headingContent.append(heading, descriptionElement);
    header.append(headingContent, count);
    section.append(header);

    if (!rules.length) {
      const emptyMessage = document.createElement("p");
      emptyMessage.className = "section-empty";
      emptyMessage.textContent = "No rules in this section yet.";
      section.append(emptyMessage);
      ruleGroups.append(section);
      return;
    }

    const list = document.createElement("ul");
    list.className = "rules-list";

    rules.forEach((rule, index) => {
      const item = document.createElement("li");
      item.className = "rule-item";

      const values = document.createElement("div");
      values.className = "rule-values";

      const term = document.createElement("span");
      term.className = "rule-term";
      term.textContent = rule.term;

      const replacement = document.createElement("span");
      replacement.className = "rule-replacement";
      replacement.textContent = `→ ${rule.replacement}`;

      const removeButton = document.createElement("button");
      removeButton.className = "remove-button";
      removeButton.type = "button";
      removeButton.dataset.removeScope = scope;
      removeButton.dataset.removeIndex = String(index);
      removeButton.textContent = "Remove";
      removeButton.setAttribute("aria-label", `Remove rule for ${rule.term}`);

      values.append(term, replacement);
      item.append(values, removeButton);
      list.append(item);
    });

    section.append(list);
    ruleGroups.append(section);
  }

  function getRulesForScope(scope) {
    return scope === "global" ? settings.globalRules : settings.siteRules[scope] ?? [];
  }

  function updateScopeRules(scope, rules) {
    const nextSettings = {
      globalRules: settings.globalRules,
      siteRules: { ...settings.siteRules }
    };

    if (scope === "global") {
      nextSettings.globalRules = rules;
    } else {
      nextSettings.siteRules[scope] = rules;
    }

    return normalizeSettings(nextSettings);
  }

  async function applySettingsToActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      return true;
    }

    try {
      await chrome.tabs.sendMessage(tab.id, { settings, type: "rules-updated" });
      return true;
    } catch (_error) {
      // The content script may not exist yet in a tab that was already open.
    }

    try {
      await chrome.scripting.executeScript({
        files: ["rules.js", "content.js"],
        target: { tabId: tab.id }
      });
      return true;
    } catch (_error) {
      return false;
    }
  }

  function getHostFromTab(tab) {
    try {
      const url = new URL(tab?.url ?? "");

      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return "";
      }

      return normalizeHost(url.hostname);
    } catch (_error) {
      return "";
    }
  }

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("error", isError);
  }
})();
