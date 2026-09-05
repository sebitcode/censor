(() => {
  "use strict";

  function normalizeRule(rule) {
    if (!rule || typeof rule.term !== "string" || typeof rule.replacement !== "string") {
      return null;
    }

    const term = rule.term.trim();
    const replacement = rule.replacement;

    if (!term || !replacement) {
      return null;
    }

    return { term, replacement };
  }

  function normalizeRules(rawRules) {
    if (!Array.isArray(rawRules)) {
      return [];
    }

    const uniqueRules = new Map();

    for (const rawRule of rawRules) {
      const rule = normalizeRule(rawRule);

      if (!rule) {
        continue;
      }

      const key = rule.term.toLowerCase();
      uniqueRules.set(key, rule);
    }

    return [...uniqueRules.values()];
  }

  function normalizeHost(hostname) {
    if (typeof hostname !== "string") {
      return "";
    }

    return hostname.trim().toLowerCase().replace(/\.+$/, "");
  }

  function normalizeSettings(rawSettings) {
    const settings = Array.isArray(rawSettings)
      ? { globalRules: rawSettings }
      : rawSettings && typeof rawSettings === "object"
        ? rawSettings
        : {};
    const siteRules = {};
    const rawSiteRules = settings.siteRules ?? settings.sites ?? {};

    if (rawSiteRules && typeof rawSiteRules === "object" && !Array.isArray(rawSiteRules)) {
      for (const [rawHost, rawRules] of Object.entries(rawSiteRules)) {
        const host = normalizeHost(rawHost);
        const rules = normalizeRules(rawRules);

        if (host && rules.length) {
          siteRules[host] = rules;
        }
      }
    }

    return {
      globalRules: normalizeRules(settings.globalRules ?? settings.global ?? []),
      siteRules
    };
  }

  function selectRulesForHost(rawSettings, hostname) {
    const settings = normalizeSettings(rawSettings);
    const host = normalizeHost(hostname);
    const siteRules = settings.siteRules[host] ?? [];

    return normalizeRules([...settings.globalRules, ...siteRules]);
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function createMatcher(rawRules) {
    const rules = normalizeRules(rawRules).sort((left, right) => right.term.length - left.term.length);

    if (!rules.length) {
      return null;
    }

    const replacements = new Map(
      rules.map((rule) => [rule.term.toLowerCase(), rule.replacement])
    );
    const pattern = rules.map((rule) => escapeRegExp(rule.term)).join("|");
    const matcher = new RegExp(pattern, "gi");

    return (text) => text.replace(matcher, (match) => replacements.get(match.toLowerCase()) ?? match);
  }

  globalThis.CensorRules = {
    createMatcher,
    normalizeRule,
    normalizeHost,
    normalizeRules,
    normalizeSettings,
    selectRulesForHost
  };
})();
