(function () {
  // 1. Establish an instantly accessible configuration state cache
  let extensionSettings = {
    activeLevels: { mynediad: true, sylfaen: true, canolradd: true, bbc: true },
    tooltipsEnabled: true
  };

 // 2. Safe storage fallback setup for local file execution
  const storageMock = {
    get: (keys, callback) => callback(extensionSettings)
  };
  const storageArea = (typeof chrome !== 'undefined' && chrome.storage) ? chrome.storage.local : storageMock;

  // 3. Immediately pull preferences on load to populate the cache
  storageArea.get(["activeLevels", "tooltipsEnabled"], (settings) => {
    if (settings) {
      // Deep merge settings to avoid losing missing keys if older storage data exists
      extensionSettings.activeLevels = { ...extensionSettings.activeLevels, ...settings.activeLevels };
      if (settings.tooltipsEnabled !== undefined) {
        extensionSettings.tooltipsEnabled = settings.tooltipsEnabled;
      }
    }
    // Automatically boot the runner once settings are verified
    runAnnotation();
  });

  // --- AUTO-ANNOTATION ENGINE ---
  function annotate(text, glossary) {
    if (!extensionSettings.tooltipsEnabled) return text;

    const phrases = Object.keys(glossary).filter(key => key.includes(" "));
    phrases.sort((a, b) => b.length - a.length);

    let processedText = text;

    phrases.forEach(phrase => {
      const safePhrase = phrase.replace(/[-\/\\^\$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b(${safePhrase})\\b`, 'gi');
      processedText = processedText.replace(regex, (match) => {
        return `___PHRASE_START___${match}___PHRASE_DIVIDER___${glossary[phrase]}___PHRASE_END___`;
      });
    });
    
    return processedText; // Returns string cleanly and synchronously
  }

  // --- WRAPPER RUNNER EXECUTION ---
  function runAnnotation() {
    const outputContainer = document.getElementById("output");
    if (!outputContainer) return; 

    const sourceText = outputContainer.textContent;
    
    // Dynamically bundle the matching matrix from all active filters
    let targetedGlossary = {};
    if (extensionSettings.activeLevels.mynediad && window.mynediadGlossary) {
      targetedGlossary = { ...targetedGlossary, ...window.mynediadGlossary };
    }
    if (extensionSettings.activeLevels.sylfaen && window.sylfaenGlossary) {
      targetedGlossary = { ...targetedGlossary, ...window.sylfaenGlossary };
    }
    if (extensionSettings.activeLevels.canolradd && window.canolraddGlossary) {
      targetedGlossary = { ...targetedGlossary, ...window.canolraddGlossary };
    }
    if (extensionSettings.activeLevels.bbc && window.bbcGlossary) {
      targetedGlossary = { ...targetedGlossary, ...window.bbcGlossary };
    }

    // Process everything sequentially using your synchronous pipeline
    const localAnnotatedHtml = annotate(sourceText, targetedGlossary);
    
    // Inject directly back to visual element container
    outputContainer.innerHTML = localAnnotatedHtml;
  }
})();
