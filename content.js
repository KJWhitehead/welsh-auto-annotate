// content.js

(function () {
  console.log("Welsh Auto-Annotation content script loaded.");

  function initAnnotationEngine() {
    chrome.storage.local.get(["activeLevels", "tooltipsEnabled"], (settings) => {
      if (!settings.tooltipsEnabled) return;

      // Select standard text rendering nodes on the page
      const textElements = document.querySelectorAll("p, span, li, h1, h2, h3");

      textElements.forEach((element) => {
        if (!element.textContent.trim() || element.isContentEditable || element.classList.contains("cy-annotated")) {
          return;
        }
        processElementNode(element, settings.activeLevels);
      });
    });
  }

  function processElementNode(element, activeLevels) {
    const originalText = element.textContent;
    
    // Placeholder token breakdown split. 
    // You will hook your custom 'tokenizer-matrix.js' logic right here.
    const words = originalText.split(/(\s+)/); 

    const processedHTML = words.map((token) => {
      // Basic match sanity check for text characters
      if (!/^[A-Za-zâêîôûŵŷß́̀̂̈]+\$/.test(token)) return token;

      let matchFound = null;
      let definition = "";

      // Match against window dictionary scopes loaded prior to this script
      if (activeLevels.mynediad && window.mynediadGlossary && window.mynediadGlossary[token.toLowerCase()]) {
        matchFound = token;
        definition = window.mynediadGlossary[token.toLowerCase()];
      }

      if (matchFound) {
        return `<span class="cy-annotated-word" data-tooltip="${definition}">${token}</span>`;
      }

      return token;
    }).join("");

    if (processedHTML !== originalText) {
      element.innerHTML = processedHTML;
      element.classList.add("cy-annotated");
    }
  }

  initAnnotationEngine();
})();
