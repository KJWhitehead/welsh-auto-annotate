// 1. MASTER ANNOTATION ENGINE (Matches your verified index.html logic)
function annotate(text, glossary) {
  const phrases = Object.keys(glossary).filter(key => key.includes(" "));
  phrases.sort((a, b) => b.length - a.length);

  let processedText = text;

  phrases.forEach(phrase => {
    const safePhrase = phrase.replace(/[-\/\\^\$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b(${safePhrase})\\b`, 'gi');
    processedText = processedText.replace(regex, (match) => {
      // Safe phrase data unpacking
      const rawDef = glossary[phrase];
      const displayDefText = (rawDef && typeof rawDef === 'object' && 'definition' in rawDef) 
        ? rawDef.definition 
        : rawDef;
      return `___PHRASE_START___${match}___PHRASE_DIVIDER___${displayDefText}___PHRASE_END___`;
    });
  });

  const tokens = processedText.split(/(___PHRASE_START___.*?___PHRASE_END___)/g);

  return tokens.map(token => {
    if (token.startsWith("___PHRASE_START___")) {
      const parts = token.replace("___PHRASE_START___", "").replace("___PHRASE_END___", "").split("___PHRASE_DIVIDER___");
      const textPhrase = parts[0];
      const translationPhrase = parts[1];
      const htmlTextContent = `<span class="tooltip-branch"><span class="tooltip-label">(${textPhrase}):</span> ${translationPhrase}</span>`;
      const cleanParam = `(${textPhrase}): ${translationPhrase}`.replace(/['"]/g, '&quot;');
      let addBtnHtml = `<button class="study-btn" data-word="${textPhrase}" data-param="${cleanParam}" style="display:block; width:100%; margin-top:8px; padding:4px; font-size:11px; background:#10b981; color:white; border:none; border-radius:3px; cursor:pointer; font-weight:bold;">➕ Add to Study List</button>`;

      return `<span class="annotated">${textPhrase}<span class="tooltip">${htmlTextContent}${addBtnHtml}</span></span>`;
    }

    const words = token.split(/([a-zA-Z\u00C0-\u017F\u1E00-\u1EFF\u2019\u0027]+)/g);
    return words.map(word => {
      const matches = collectMatches(word, glossary); // Your mutation matrix runs here safely
      if (matches.length > 0) {
        let tooltipContent = matches.map(m => {
          const rawDef = m.definition;
          const displayDefText = (rawDef && typeof rawDef === 'object' && 'definition' in rawDef) 
            ? rawDef.definition 
            : rawDef;
          return `<span class="tooltip-branch"><span class="tooltip-label">(${m.root}):</span> ${displayDefText}</span>`;
        }).join("");

        const plainTextLabel = matches.map(m => {
          const rawDef = m.definition;
          const displayDefText = (rawDef && typeof rawDef === 'object' && 'definition' in rawDef) 
            ? rawDef.definition 
            : rawDef;
          return `(${m.root}): ${displayDefText}`;
        }).join(' / ');

        const cleanParamLabel = plainTextLabel.replace(/['"]/g, '&quot;');
        let addBtnHtml = `<button class="study-btn" data-word="${word}" data-param="${cleanParamLabel}" style="display:block; width:100%; margin-top:8px; padding:4px; font-size:11px; background:#10b981; color:white; border:none; border-radius:3px; cursor:pointer; font-weight:bold;">➕ Add to Study List</button>`;

        return `<span class="annotated">${word}<span class="tooltip">${tooltipContent}${addBtnHtml}</span></span>`;
      }
      return word;
    }).join("");
  }).join("");
}

// 2. EXTENSION RECEIVER (Fetches and merges all 4 JSON files on command)
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === "RUN_ANNOTATION") {
    try {
      const dictionaryFiles = [
        'dictionaries/mynediad.json',
        'dictionaries/sylfaen.json',
        'dictionaries/canolradd.json',
        'dictionaries/bbc.json'
      ];

      let combinedGlossary = {};

      for (const filePath of dictionaryFiles) {
        const jsonUrl = chrome.runtime.getURL(filePath);
        const response = await fetch(jsonUrl);
        const data = await response.json();
        combinedGlossary = { ...combinedGlossary, ...data };
      }

      // Targets the active text content of the website you are browsing
      const walkAndAnnotate = (node) => {
        let child = node.firstChild;
        while (child) {
          if (child.nodeType === Node.TEXT_NODE && child.textContent.trim().length > 0) {
            const rawText = child.textContent;
            const annotatedHtml = annotate(rawText, combinedGlossary);
            
            if (annotatedHtml !== rawText) {
              const span = document.createElement('span');
              span.innerHTML = annotatedHtml;
              child.replaceWith(span);
            }
          } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'SCRIPT' && child.tagName !== 'STYLE' && child.tagName !== 'TEXTAREA') {
            walkAndAnnotate(child);
          }
          child = child.nextSibling;
        }
      };

      walkAndAnnotate(document.body);
      console.log("🚀 Page annotation engine fired cleanly over live web text elements!");

    } catch (error) {
      console.error("Failed to execute extension mapping loops:", error);
    }
  }
});

// 3. EXTENSION CLICK INTERACTION DELEGATION
document.addEventListener('click', (event) => {
  const target = event.target;
  
  // Handle toggling tooltips on live pages safely
  if (target.classList.contains('annotated')) {
    event.stopPropagation();
    const isOpen = target.classList.contains('show-tooltip');
    document.querySelectorAll('.annotated').forEach(el => el.classList.remove('show-tooltip'));
    if (!isOpen) target.classList.add('show-tooltip');
    return;
  }

  // Handle study list buttons inside live pages safely
  if (target.classList.contains('study-btn')) {
    event.stopPropagation();
    const word = target.getAttribute('data-word');
    const param = target.getAttribute('data-param');
    console.log("Word saved via extension context:", word, param);
    // (We will wire this to a global sync storage list next!)
    document.querySelectorAll('.annotated').forEach(el => el.classList.remove('show-tooltip'));
    return;
  }

  // Dismiss tooltips on general clicks
  document.querySelectorAll('.annotated').forEach(el => el.classList.remove('show-tooltip'));
});
