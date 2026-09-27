// --- AUTO-COLLECT MULTIPLE MATCHES & MUTATIONS ---
function collectMatches(word, glossary) {
  // FIXED: Explicitly preserves straight and curly apostrophes during word cleanup!
  let w = word.toLowerCase().replace(/^[^\w\u00C0-\u017F\u1E00-\u1EFF'’]+|[^\w\u00C0-\u017F\u1E00-\u1EFF'’]+$/g, "").trim();
  if (!w) return [];

  // 1. WELSH CONTRACTION SPLITTER
  // Only trim context attachments if the absolute contraction isn't explicitly in the glossary first!
  if (!glossary[w]) {
    if (w.endsWith("'r") || w.endsWith("’r") || w.endsWith("'n") || w.endsWith("’n")) {
      w = w.slice(0, -2); 
    }
  }

  // 2. WELSH VOWEL-LINK STRIPPER
  if (!glossary[w]) {
    const vowelLinks = { "nag": "na", "ac": "a", "ag": "â", "tuag": "tua", "gydag": "gyda" };
    if (vowelLinks[w]) w = vowelLinks[w];
  }

if (!w) return [];
  let foundKeys = new Set();

  function checkAndAdd(candidate) {
    if (glossary[candidate]) foundKeys.add(candidate);
    if (/[aeiouwŷâêîôû]$/i.test(candidate)) {
      const candidateWithF = candidate + "f";
      if (glossary[candidateWithF]) foundKeys.add(candidateWithF);
    }
  }

  // ─── NEW: ADJECTIVE SUFFIX DETECTION GUARD ──────────────────────────
  // Checks if the word token ends with one of your active suffixes
  const isAdjSuffix = ["ach", "af", "a", "ed"].some(suffix => w.endsWith(suffix) && w.length > suffix.length);

  // FIXED: Only run the direct base pass if this is NOT a word with an adjective suffix!
  if (!isAdjSuffix) {
    checkAndAdd(w);
  }

  function scanMutations(candidate) {
    // Soft Mutations
    const soft = { "g": ["c"], "b": ["p"], "d": ["t"], "f": ["b", "m"], "dd": ["d"], "l": ["ll"], "r": ["rh"] };
    for (const mut in soft) {
      if (candidate.startsWith(mut)) {
        soft[mut].forEach(target => checkAndAdd(candidate.replace(new RegExp("^" + mut), target)));
      }
    }

    // Nasal Mutations
    const nasal = { "ngh": ["c"], "mh": ["p"], "nh": ["t"], "ng": ["g"], "m": ["b"], "n": ["d"] };
    for (const mut in nasal) {
      if (candidate.startsWith(mut)) {
        nasal[mut].forEach(target => checkAndAdd(candidate.replace(new RegExp("^" + mut), target)));
      }
    }

    // Aspirate Mutations
    const aspirate = { "ch": ["c"], "ph": ["p"], "th": ["t"] };
    for (const mut in aspirate) {
      if (candidate.startsWith(mut)) {
        aspirate[mut].forEach(target => checkAndAdd(candidate.replace(new RegExp("^" + mut), target)));
      }
    }

    if (/^[aeiouwŷâêîôû]/i.test(candidate)) checkAndAdd("g" + candidate);

    // ASPIRATE VOWEL PASS
    if (candidate.startsWith("h") && candidate.length > 1) {
      const vowelRoot = candidate.slice(1);
      if (/^[aeiouwŷâêîôû]/i.test(vowelRoot)) checkAndAdd(vowelRoot);
    }
  }

  // FIXED: Only trigger standard mutation sweeps if it wasn't intercepted as a suffix word!
  if (!isAdjSuffix) {
    scanMutations(w);
  }

  // 3. VERB STEM SUFFIX STRIPPER
  const verbSuffixes = ["odd", "ais", "es", "aeth", "on", "och", "asant", "wch", "a"];
  for (const suffix of verbSuffixes) {
    if (w.endsWith(suffix) && w.length > suffix.length) {
      const nakedStem = w.slice(0, -suffix.length);
      checkAndAdd(nakedStem);
      scanMutations(nakedStem);

      const infinitiveEndings = ["u", "i", "o", "io", "a"];
      for (const inf of infinitiveEndings) {
        let reconstructedVerb = nakedStem + inf;
        checkAndAdd(reconstructedVerb);
        scanMutations(reconstructedVerb);
      }
    }
  }

   // 4. FIXED LOCATION: ADJECTIVE COMPARATIVE / SUPERLATIVE Suffix Stripper
  // Targets regular endings, including modern spoken dropped-f superlatives!
  const adjSuffixes = { "ach": "comparative", "af": "superlative", "a": "superlative", "ed": "equative" };
  for (const [suffix, formType] of Object.entries(adjSuffixes)) {
    if (w.endsWith(suffix) && w.length > suffix.length) {
      const nakedStem = w.slice(0, -suffix.length);
      
      // We will temporarily intercept found keys to attach the form label to them
      function checkAddWithForm(candidate) {
        if (glossary[candidate]) {
          foundKeys.add(JSON.stringify({ root: candidate, form: formType }));
        }
      }

      // Check standard mutations with the form tag attached
      checkAddWithForm(nakedStem);
      
      // Re-map scanMutations to use our form tracker inside this loop block
      const soft = { "g": ["c"], "b": ["p"], "d": ["t"], "f": ["b", "m"], "dd": ["d"], "l": ["ll"], "r": ["rh"] };
      for (const m in soft) if (nakedStem.startsWith(m)) soft[m].forEach(t => checkAddWithForm(nakedStem.replace(new RegExp("^" + m), t)));
      
      const nasal = { "ngh": ["c"], "mh": ["p"], "nh": ["t"], "ng": ["g"], "m": ["b"], "n": ["d"] };
      for (const m in nasal) if (nakedStem.startsWith(m)) nasal[m].forEach(t => checkAddWithForm(nakedStem.replace(new RegExp("^" + m), t)));
      
      const aspirate = { "ch": ["c"], "ph": ["p"], "th": ["t"] };
      for (const m in aspirate) if (nakedStem.startsWith(m)) aspirate[m].forEach(t => checkAddWithForm(nakedStem.replace(new RegExp("^" + m), t)));

      // Harden stem reversals (e.g., teca -> tec -> teg)
      if (nakedStem.endsWith("c")) { const s = nakedStem.slice(0, -1) + "g"; checkAddWithForm(s); }
      if (nakedStem.endsWith("t")) { const s = nakedStem.slice(0, -1) + "d"; checkAddWithForm(s); }
      if (nakedStem.endsWith("p")) { const s = nakedStem.slice(0, -1) + "b"; checkAddWithForm(s); }
    }
  }
 // --- FIXED: FINAL DE-DUPLICATION FILTER GATE ---
  // Loops through all gathered keys and filters out generic plain roots 
  // if a richer, grammatically tagged version of that same root exists!
  const finalArray = Array.from(foundKeys).map(item => {
    if (item.startsWith("{")) {
      const parsed = JSON.parse(item);
      return { root: parsed.root, definition: glossary[parsed.root], form: parsed.form };
    }
    return { root: item, definition: glossary[item], form: "" };
  });

  // Filter out the plain root if the exact same root exists with a grammar form tag
  return finalArray.filter((item, index, self) => {
    if (item.form === "") {
      // If a tagged version of this exact same root exists anywhere in the array, drop this plain one!
      const hasTaggedVersion = self.some(x => x.root === item.root && x.form !== "");
      if (hasTaggedVersion) return false;
    }
    
    // Also drop absolute identical duplicates
    return self.findIndex(x => x.root === item.root && x.definition === item.definition && x.form === item.form) === index;
  });
}

// 1. MASTER ANNOTATION ENGINE (Matches your verified index.html logic)
function annotate(text, glossary) {
  const phrases = Object.keys(glossary).filter(key => key.includes(" "));
  phrases.sort((a, b) => b.length - a.length);

  let processedText = text;

  phrases.forEach(phrase => {
    const safePhrase = phrase.replace(/[-\/\\^\$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b(${safePhrase})\\b`, 'gi');
    processedText = processedText.replace(regex, (match) => {
      const rawDef = glossary[phrase];
      let displayDefText = rawDef;
      let courseInfo = "";

      if (rawDef && typeof rawDef === 'object' && 'definition' in rawDef) {
        displayDefText = rawDef.definition;
        if (rawDef.course && rawDef.unit) {
          courseInfo = ` [${rawDef.course} • ${rawDef.unit}]`;
        }
      }

      const finalDisplayString = displayDefText + courseInfo;
      return `___PHRASE_START___${match}___PHRASE_DIVIDER___${finalDisplayString}___PHRASE_END___`;
    });
  });

  const tokens = processedText.split(/(___PHRASE_START___.*?___PHRASE_END___)/g);

  return tokens.map(token => {
if (token.startsWith("___PHRASE_START___")) {
      const parts = token.replace("___PHRASE_START___", "").replace("___PHRASE_END___", "").split("___PHRASE_DIVIDER___");
      const phraseText = parts[0];
      const finalDisplayString = parts[1]; // Pulls the clean definition string cleanly
      
      const tooltipHtml = `<span class="tooltip-branch"><span class="tooltip-label">(${phraseText}):</span> ${finalDisplayString}</span>`;
      
      // Pull out the base parameters safely for the study table tracking object
      const rawDef = glossary[phraseText];
      const txt = (rawDef && typeof rawDef === 'object') ? rawDef.definition : rawDef;
      const c = (rawDef && rawDef.course) ? rawDef.course : "";
      const u = (rawDef && rawDef.unit) ? rawDef.unit : "";

      const cleanParam = encodeURIComponent(JSON.stringify({ word: phraseText, def: txt, course: c, unit: u }));
      let btn = `<button class="study-btn" data-word="${phraseText}" data-param="${cleanParam}" style="display:block; width:100%; margin-top:8px; padding:4px; font-size:11px; background:#10b981; color:white; border:none; border-radius:3px; cursor:pointer; font-weight:bold;">➕ Add to Study List</button>`;
      
      return `<span class="annotated">${phraseText}<span class="tooltip">${tooltipHtml}${btn}</span></span>`;
    }

const words = token.split(/([a-zA-Z\u00C0-\u017F\u1E00-\u1EFF\u2019\u0027]+)/g);
    return words.map(word => {
      const matches = collectMatches(word, glossary);
      if (matches.length > 0) {
        // 1. BUILD INTUITIVE VISUAL HOVER TOOLTIP TEXT WITH GRAMMAR LABELS
        let tooltipHtml = matches.map(m => {
          const d = m.definition;
          const txt = (d && typeof d === 'object') ? d.definition : d;
          const c = (d && d.course) ? d.course : "";
          const u = (d && d.unit) ? d.unit : "";
          
          const formLabel = m.form ? ` (${m.form})` : "";
          const curriculum = (c || u) ? ` [${c} ${u ? '• ' + u : ''}]` : "";
          
          return `<span class="tooltip-branch"><span class="tooltip-label">(${m.root}):</span> ${txt}${formLabel}${curriculum}</span>`;
        }).join("");

        // 2. STRUCTURALLY PACK THE DATA OBJECT FOR THE COMPACT STUDY TABLE
        const firstMatch = matches[0].definition;
        const packedData = {
          word: word,
          def: (firstMatch && typeof firstMatch === 'object') ? firstMatch.definition : firstMatch,
          course: (firstMatch && firstMatch.course) ? firstMatch.course : "",
          unit: (firstMatch && firstMatch.unit) ? firstMatch.unit : ""
        };
        const cleanParam = encodeURIComponent(JSON.stringify(packedData));
        
        let btn = `<button class="study-btn" data-word="${word}" data-param="${cleanParam}" style="display:block; width:100%; margin-top:8px; padding:4px; font-size:11px; background:#10b981; color:white; border:none; border-radius:3px; cursor:pointer; font-weight:bold;">➕ Add to Study List</button>`;
return `<span class="annotated">${word}<span class="tooltip">${tooltipHtml}${btn}</span></span>`;
      }
      return word;
    }).join("");
  }).join("");
}

// 2. EXTENSION RECEIVER (Preserves photos/layouts while keeping sentence text context intact)
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

      // Target clean text-bearing paragraph blocks to isolate layout items from modification
      const blocks = document.querySelectorAll('p, li, h1, h2, h3, span.story-body__introduction');

      blocks.forEach(block => {
        // Skip blocks that don't have text or contain layout containers like images/figures
        if (block.querySelector('img, figure, picture, video, iframe')) return;

        // 1. Read the full text context so word boundaries (\b) remain completely intact
        const fullSentenceText = block.innerText;
        
        // 2. Compute annotations over the unified string layout
        const annotatedHtml = annotate(fullSentenceText, combinedGlossary);
        
        if (annotatedHtml !== fullSentenceText) {
          // 3. Use a safe browser parsing fragment to rebuild the internal text mapping 
          // without destroying the parent paragraph tag container constraints!
          block.innerHTML = annotatedHtml;
        }
      });

      console.log("🚀 Complete sentence boundary compilation achieved. All layout styles and images safe!");

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

// 1. EXTENSION & WORKBENCH CLICK INTERACTION DELEGATION
  // Handle study list buttons inside live extension pages safely via background channels
  if (target.classList.contains('study-btn')) {
    event.stopPropagation();
    
    // Extract the raw text properties passed down by the annotation loops
    const word = target.getAttribute('data-word') || "";
    const param = target.getAttribute('data-param') || "";
    
    // Parse out the definition text block out of the packed plain string label
    // Example format: "(root): definition [Course • Unit]" or just "(root): definition"
    let definitionText = param;
    let courseText = "";
    let unitText = "";

    // Extract the core description by stripping the leading "(root): " token
    if (param.includes("): ")) {
      definitionText = param.split("): ")[1];
    }
    
    // Extract curriculum bracket contents if they exist in the text label
    if (definitionText.includes(" [") && definitionText.includes(" • ")) {
      const parts = definitionText.split(" [");
      definitionText = parts[0].trim(); // Pure definition
      
      const curriculumBits = parts[1].replace("]", "").split(" • ");
      courseText = curriculumBits[0] || "";
      unitText = curriculumBits[1] || "";
    } else if (definitionText.includes(" [")) {
      const parts = definitionText.split(" [");
      definitionText = parts[0].trim();
      courseText = parts[1].replace("]", "") || "";
    }

    // Securely fire the data packet up to background.js service worker channels!
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        action: "SAVE_VOCAB_WORD",
        payload: {
          word: word,
          def: definitionText,
          course: courseText,
          unit: unitText
        }
      }, (response) => {
        // Provide immediate visual success feedback on the webpage button
        target.innerText = "✅ Added!";
        target.style.background = "#059669";
        
        setTimeout(() => {
          document.querySelectorAll('.annotated').forEach(el => el.classList.remove('show-tooltip'));
        }, 800);
      });
    }
    return;
  }
  
  // 🛠️ FIXED: Dismiss tooltips on general clicks ONLY if we didn't hit a button or target span!
  document.querySelectorAll('.annotated').forEach(el => el.classList.remove('show-tooltip'));
});

// 🛠️ FIXED: Moved outside the event listener block to maintain standard scoping boundaries cleanly
function triggerVisualSuccessFeedback(targetButton) {
  targetButton.innerText = "✅ Added!";
  targetButton.style.background = "#059669";
  
  setTimeout(() => {
    document.querySelectorAll('.annotated').forEach(el => el.classList.remove('show-tooltip'));
  }, 800);
}

