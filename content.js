(() => {
  "use strict";

  const { createMatcher, normalizeSettings, selectRulesForHost } = globalThis.CensorRules;
  const EXCLUDED_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "TEXTAREA"]);
  const READY_ATTRIBUTE = "data-page-censor-ready";
  const MAX_INITIALIZATION_DELAY = 2500;

  let matcher = null;
  let settings = normalizeSettings();
  let originalText = new WeakMap();
  let renderedText = new WeakMap();
  let scanQueued = false;
  const revealTimer = setTimeout(revealPage, MAX_INITIALIZATION_DELAY);

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "rules-updated") {
      return false;
    }

    setSettings(message.settings ?? { globalRules: message.rules });
    sendResponse({ ok: true });
    return false;
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") {
      return;
    }

    if (changes.settings) {
      setSettings(changes.settings.newValue);
    } else if (changes.rules) {
      setSettings({ globalRules: changes.rules.newValue });
    }
  });

  initialize();

  async function initialize() {
    let stored = { rules: [], settings: null };

    try {
      stored = await chrome.storage.sync.get({ rules: [] });
    } catch (error) {
      console.error("Page Censor could not load saved rules.", error);
    }

    setSettings(stored.settings ?? { globalRules: stored.rules }, false);
    observePage();
    await scanInitialPage();
    revealPage();
  }

  function setSettings(rawSettings, shouldScan = true) {
    settings = normalizeSettings(rawSettings);
    matcher = createMatcher(selectRulesForHost(settings, window.location.hostname));
    renderedText = new WeakMap();

    if (shouldScan) {
      scheduleFullScan();
    }
  }

  function scanInitialPage() {
    return new Promise((resolve) => {
      const scan = () => {
        processTree(document.body);
        resolve();
      };

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", scan, { once: true });
      } else {
        queueMicrotask(scan);
      }
    });
  }

  function revealPage() {
    clearTimeout(revealTimer);
    document.documentElement?.setAttribute(READY_ATTRIBUTE, "true");
  }

  function observePage() {
    if (!document.documentElement) {
      document.addEventListener("DOMContentLoaded", observePage, { once: true });
      return;
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          processTextNode(mutation.target);
          continue;
        }

        for (const node of mutation.addedNodes) {
          processTree(node);
        }
      }
    });

    observer.observe(document.documentElement, {
      characterData: true,
      childList: true,
      subtree: true
    });
  }

  function scheduleFullScan() {
    if (scanQueued) {
      return;
    }

    scanQueued = true;
    queueMicrotask(() => {
      scanQueued = false;
      processTree(document.body);
    });
  }

  function processTree(node) {
    if (!node || !node.isConnected) {
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      processTextNode(node);
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE || shouldSkipElement(node)) {
      return;
    }

    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let textNode = walker.nextNode();

    while (textNode) {
      processTextNode(textNode);
      textNode = walker.nextNode();
    }
  }

  function processTextNode(textNode) {
    if (!textNode.isConnected || shouldSkipTextNode(textNode)) {
      return;
    }

    const currentText = textNode.nodeValue ?? "";
    const previousRenderedText = renderedText.get(textNode);

    if (!originalText.has(textNode) ||
        (previousRenderedText !== undefined && currentText !== previousRenderedText)) {
      originalText.set(textNode, currentText);
    }

    const sourceText = originalText.get(textNode) ?? currentText;
    const nextText = matcher ? matcher(sourceText) : sourceText;

    renderedText.set(textNode, nextText);

    if (currentText !== nextText) {
      textNode.nodeValue = nextText;
    }
  }

  function shouldSkipElement(element) {
    return EXCLUDED_TAGS.has(element.tagName) || element.isContentEditable;
  }

  function shouldSkipTextNode(textNode) {
    let element = textNode.parentElement;

    while (element) {
      if (shouldSkipElement(element)) {
        return true;
      }

      element = element.parentElement;
    }

    return false;
  }
})();
