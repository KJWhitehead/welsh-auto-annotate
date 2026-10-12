// --- AUTO-COLLECT MULTIPLE MATCHES & MUTATIONS ---
function collectMatches(word, glossary) {
  // Preserve straight and curly apostrophes during word cleanup.
  let w = word
    .toLocaleLowerCase("cy")
    .replace(/^[^\p{L}'’]+|[^\p{L}'’]+$/gu, "")
    .trim();

  if (!w) return [];

  // 1. WELSH CONTRACTION SPLITTER
  // Only split contractions when the complete word is not already present.
  if (!glossary[w]) {
    if (w.endsWith("'ch") || w.endsWith("’ch")) {
      w = w.slice(0, -3);
    } else if (
      w.endsWith("'r") ||
      w.endsWith("’r") ||
      w.endsWith("'n") ||
      w.endsWith("’n")
    ) {
      w = w.slice(0, -2);
    }

    // 2. WELSH VOWEL-LINK STRIPPER
    if (!glossary[w]) {
      const vowelLinks = {
        nag: "na",
        ac: "a",
        ag: "â",
        tuag: "tua",
        gydag: "gyda"
      };

      if (vowelLinks[w]) {
        w = vowelLinks[w];
      }
    }
  }

  if (!w) return [];

  // This must be outside the original `if (!glossary[w])` block.
  // Exact glossary matches must also produce an array.
  const foundKeys = new Set();

  function checkAndAdd(candidate) {
    if (glossary[candidate]) {
      foundKeys.add(candidate);
    }

    // Support dictionary roots ending in -f after a vowel.
    if (/[aeiouwŷâêîôû]$/i.test(candidate)) {
      const candidateWithF = `${candidate}f`;

      if (glossary[candidateWithF]) {
        foundKeys.add(candidateWithF);
      }
    }
  }

  // ADJECTIVE SUFFIX DETECTION GUARD
  const isAdjSuffix = ["ach", "af", "a", "ed"].some(
    suffix => w.endsWith(suffix) && w.length > suffix.length
  );

  // Do not treat adjective forms as direct roots.
  if (!isAdjSuffix) {
    checkAndAdd(w);
  }

  function scanMutations(candidate) {
    // Soft mutations.
    const soft = {
      g: ["c"],
      b: ["p"],
      d: ["t"],
      f: ["b", "m"],
      dd: ["d"],
      l: ["ll"],
      r: ["rh"]
    };

    for (const mutation in soft) {
      if (candidate.startsWith(mutation)) {
        soft[mutation].forEach(target => {
          const mutatedCandidate = candidate.replace(
            new RegExp(`^${mutation}`),
            target
          );

          checkAndAdd(mutatedCandidate);
        });
      }
    }

    // Nasal mutations.
    const nasal = {
      ngh: ["c"],
      mh: ["p"],
      nh: ["t"],
      ng: ["g"],
      m: ["b"],
      n: ["d"]
    };

    for (const mutation in nasal) {
      if (candidate.startsWith(mutation)) {
        nasal[mutation].forEach(target => {
          const mutatedCandidate = candidate.replace(
            new RegExp(`^${mutation}`),
            target
          );

          checkAndAdd(mutatedCandidate);
        });
      }
    }

    // Aspirate mutations.
    const aspirate = {
      ch: ["c"],
      ph: ["p"],
      th: ["t"]
    };

    for (const mutation in aspirate) {
      if (candidate.startsWith(mutation)) {
        aspirate[mutation].forEach(target => {
          const mutatedCandidate = candidate.replace(
            new RegExp(`^${mutation}`),
            target
          );

          checkAndAdd(mutatedCandidate);
        });
      }
    }

    // Initial vowel mutation.
    if (/^[aeiouwŷâêîôû]/i.test(candidate)) {
      checkAndAdd(`g${candidate}`);
    }

    // Aspirate vowel pass.
    if (candidate.startsWith("h") && candidate.length > 1) {
      const vowelRoot = candidate.slice(1);

      if (/^[aeiouwŷâêîôû]/i.test(vowelRoot)) {
        checkAndAdd(vowelRoot);
      }
    }
  }

  // Only run the standard mutation sweep for non-adjective forms.
  if (!isAdjSuffix) {
    scanMutations(w);
  }

  // 3. VERB STEM SUFFIX STRIPPER
  const verbSuffixes = [
    "odd",
    "ais",
    "es",
    "aeth",
    "on",
    "och",
    "asant",
    "wch",
    "a"
  ];

  for (const suffix of verbSuffixes) {
    if (!w.endsWith(suffix) || w.length <= suffix.length) {
      continue;
    }

    const nakedStem = w.slice(0, -suffix.length);

    checkAndAdd(nakedStem);
    scanMutations(nakedStem);

    const infinitiveEndings = ["u", "i", "o", "io", "a"];

    for (const ending of infinitiveEndings) {
      const reconstructedVerb = nakedStem + ending;

      checkAndAdd(reconstructedVerb);
      scanMutations(reconstructedVerb);
    }
  }

  // 4. ADJECTIVE COMPARATIVE / SUPERLATIVE SUFFIX STRIPPER
  // Includes modern spoken dropped-f superlatives.
  const adjectiveSuffixes = {
    ach: "comparative",
    af: "superlative",
    a: "superlative",
    ed: "equative"
  };

  for (const [suffix, formType] of Object.entries(adjectiveSuffixes)) {
    if (!w.endsWith(suffix) || w.length <= suffix.length) {
      continue;
    }

    const nakedStem = w.slice(0, -suffix.length);

    function checkAddWithForm(candidate) {
      if (glossary[candidate]) {
        foundKeys.add(
          JSON.stringify({
            root: candidate,
            form: formType
          })
        );
      }

      // Catch dictionary roots ending in -f after a dropped-f form.
      if (/[aeiouwŷâêîôû]$/i.test(candidate)) {
        const candidateWithF = `${candidate}f`;

        if (glossary[candidateWithF]) {
          foundKeys.add(
            JSON.stringify({
              root: candidateWithF,
              form: formType
            })
          );
        }
      }
    }

    // Check the unmutated stem.
    checkAddWithForm(nakedStem);

    // Check soft mutations.
    const soft = {
      g: ["c"],
      b: ["p"],
      d: ["t"],
      f: ["b", "m"],
      dd: ["d"],
      l: ["ll"],
      r: ["rh"]
    };

    for (const mutation in soft) {
      if (nakedStem.startsWith(mutation)) {
        soft[mutation].forEach(target => {
          const candidate = nakedStem.replace(
            new RegExp(`^${mutation}`),
            target
          );

          checkAddWithForm(candidate);
        });
      }
    }

    // Check nasal mutations.
    const nasal = {
      ngh: ["c"],
      mh: ["p"],
      nh: ["t"],
      ng: ["g"],
      m: ["b"],
      n: ["d"]
    };

    for (const mutation in nasal) {
      if (nakedStem.startsWith(mutation)) {
        nasal[mutation].forEach(target => {
          const candidate = nakedStem.replace(
            new RegExp(`^${mutation}`),
            target
          );

          checkAddWithForm(candidate);
        });
      }
    }

    // Check aspirate mutations.
    const aspirate = {
      ch: ["c"],
      ph: ["p"],
      th: ["t"]
    };

    for (const mutation in aspirate) {
      if (nakedStem.startsWith(mutation)) {
        aspirate[mutation].forEach(target => {
          const candidate = nakedStem.replace(
            new RegExp(`^${mutation}`),
            target
          );

          checkAddWithForm(candidate);
        });
      }
    }

    // Harden stem reversals, for example teca -> tec -> teg.
    if (nakedStem.endsWith("c")) {
      checkAddWithForm(`${nakedStem.slice(0, -1)}g`);
    }

    if (nakedStem.endsWith("t")) {
      checkAddWithForm(`${nakedStem.slice(0, -1)}d`);
    }

    if (nakedStem.endsWith("p")) {
      checkAddWithForm(`${nakedStem.slice(0, -1)}b`);
    }
  }

  // 5. FINAL DE-DUPLICATION FILTER
  const finalArray = Array.from(foundKeys).map(item => {
    if (typeof item === "string" && item.startsWith("{")) {
      const parsed = JSON.parse(item);

      return {
        root: parsed.root,
        definition: glossary[parsed.root],
        form: parsed.form
      };
    }

    return {
      root: item,
      definition: glossary[item],
      form: ""
    };
  });

  return finalArray.filter((item, index, self) => {
    if (item.form === "") {
      const hasTaggedVersion = self.some(
        other => other.root === item.root && other.form !== ""
      );

      if (hasTaggedVersion) {
        return false;
      }
    }

    return (
      self.findIndex(
        other =>
          other.root === item.root &&
          other.definition === item.definition &&
          other.form === item.form
      ) === index
    );
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 1. MASTER ANNOTATION ENGINE (Matches your verified index.html logic)
function annotate(text, glossary) {
  const phrases = Object.keys(glossary)
    .filter(k => k.includes(" "))
    .sort((a, b) => b.length - a.length);

  let processedText = text;

  if (phrases.length > 0) {
    const phraseLookup = Object.fromEntries(
      phrases.map(phrase => [phrase.toLowerCase(), phrase])
    );

    const escapedPhrases = phrases.map(phrase =>
      phrase.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")
    );

    const phraseRegex = new RegExp(
      `(?<=^|[^a-zA-Z\\u00C0-\\u017F\\u1E00-\\u1EFF])` +
      `(${escapedPhrases.join("|")})` +
      `(?=$|[^a-zA-Z\\u00C0-\\u017F\\u1E00-\\u1EFF])`,
      "gi"
    );

    processedText = processedText.replace(phraseRegex, match => {
      const glossaryKey = phraseLookup[match.toLowerCase()];
      const d = glossary[glossaryKey];

      const txt = d && typeof d === "object" ? d.definition : d;
      const c = d && d.course ? d.course : "";
      const u = d && d.unit ? d.unit : "";

      return `___PHRASE_START___${match}` +
        `___PHRASE_DIVIDER___${txt}|||${c}|||${u}` +
        `___PHRASE_END___`;
    });
  }

  const tokens = processedText.split(
    /(___PHRASE_START___.*?___PHRASE_END___)/g
  );

  return tokens.map(token => {
if (token.startsWith("___PHRASE_START___")) {
  const phraseStart = "___PHRASE_START___";
  const phraseDivider = "___PHRASE_DIVIDER___";
  const phraseEnd = "___PHRASE_END___";

  const content = token
    .slice(phraseStart.length)
    .replace(new RegExp(`${phraseEnd}$`), "");

  const dividerIndex = content.indexOf(phraseDivider);

  if (dividerIndex === -1) {
    return token;
  }

  const phraseText = content.slice(0, dividerIndex);
  const metadata = content.slice(
    dividerIndex + phraseDivider.length
  );

  // The metadata format is:
  // definition|||course|||unit
  const [definitionText = "", courseText = "", unitText = ""] =
    metadata.split("|||");

  const safePhraseText = escapeHtml(phraseText);
  const safeDefinition = escapeHtml(definitionText);
  const safeCourse = escapeHtml(courseText);
  const safeUnit = escapeHtml(unitText);

  const tooltipHtml = `
    <span class="tooltip-branch">
      <span class="tooltip-label">(${safePhraseText}):</span>
      ${safeDefinition}
      ${
        safeCourse || safeUnit
          ? ` [${safeCourse}${safeUnit ? ` • ${safeUnit}` : ""}]`
          : ""
      }
    </span>
  `;

  const rawDef =
    glossary[phraseText] ||
    glossary[phraseText.toLowerCase()] ||
    definitionText;

  const definitionForStudy =
    rawDef && typeof rawDef === "object"
      ? rawDef.definition
      : rawDef;

  const studyCourse =
    rawDef && typeof rawDef === "object" && rawDef.course
      ? rawDef.course
      : courseText;

  const studyUnit =
    rawDef && typeof rawDef === "object" && rawDef.unit
      ? rawDef.unit
      : unitText;

  const cleanParam = encodeURIComponent(
    JSON.stringify({
  word: phraseText,
  root: phraseText,
  def: definitionForStudy,
  course: studyCourse,
  unit: studyUnit
})
  );

  const btn = `
    <button
      class="study-btn"
      data-word="${safePhraseText}"
      data-param="${cleanParam}"
      style="
        display: block;
        width: 100%;
        margin-top: 8px;
        padding: 4px;
        font-size: 11px;
        background: #10b981;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      "
    >
      Add to study list
    </button>
  `;

  return `
    <span class="annotated">
      ${safePhraseText}
      <span class="tooltip">
        ${tooltipHtml}
        ${btn}
      </span>
    </span>
  `;
}

const words = token.split(/(\p{L}+(?:['’\-]\p{L}+)*)/gu);
    return words.map(word => {
  const matches = collectMatches(word, glossary) || [];

  if (matches.length === 0) {
    return word;
  }

  const safeWord = escapeHtml(word);

  const tooltipHtml = matches.map(match => {
    const definition = match.definition;
    const definitionText =
      definition && typeof definition === "object"
        ? definition.definition
        : definition;

    const course =
      definition && typeof definition === "object"
        ? definition.course || ""
        : "";

    const unit =
      definition && typeof definition === "object"
        ? definition.unit || ""
        : "";

    const safeRoot = escapeHtml(match.root);
    const safeDefinition = escapeHtml(definitionText);
    const safeForm = escapeHtml(match.form || "");
    const safeCourse = escapeHtml(course);
    const safeUnit = escapeHtml(unit);

    const formLabel = match.form
      ? ` (${safeForm})`
      : "";

    const curriculum = course || unit
      ? ` [${safeCourse}${unit ? ` • ${safeUnit}` : ""}]`
      : "";

const packedData = {
  word,
  root: match.root,
  def: definitionText || "",
  course,
  unit
};

    const cleanParam = encodeURIComponent(
      JSON.stringify(packedData)
    );

    const studyButton = `
      <button
        class="study-btn"
        data-word="${safeWord}"
        data-param="${cleanParam}"
        style="
          display: block;
          width: 100%;
          margin-top: 4px;
          padding: 4px;
          font-size: 11px;
          background: #10b981;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        "
      >
        Add “${safeRoot}” to study list
      </button>
    `;

    return `
      <span class="tooltip-branch">
        <span class="tooltip-label">(${safeRoot}):</span>
        ${safeDefinition}${formLabel}${curriculum}
        ${studyButton}
      </span>
    `;
  }).join("");

  const audioButton = `
    <button
      class="speak-btn"
      data-text="${safeWord}"
      style="
        display: block;
        width: 100%;
        margin-top: 4px;
        padding: 4px;
        font-size: 11px;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      "
    >
      🔊 Hear word
    </button>
  `;

  return `
    <span class="annotated">
      ${safeWord}
      <span class="tooltip">
        ${tooltipHtml}
        ${audioButton}
      </span>
    </span>
  `;
}).join("");
  }).join("");
}

// =======================================================
// 2. EXTENSION RECEIVER PIPELINE (Sentence boundary scanner)
// =======================================================
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === "RUN_ANNOTATION") {
    try {
      const dictionaryFiles = [
        'dictionaries/mynediad.json',
        'dictionaries/sylfaen.json',
        'dictionaries/canolradd.json',
        'dictionaries/uwch1.json',
        'dictionaries/bbc.json'
      ];

      let combinedGlossary = {};

      for (const filePath of dictionaryFiles) {
        const jsonUrl = chrome.runtime.getURL(filePath);
        const response = await fetch(jsonUrl);
        const data = await response.json();
        combinedGlossary = { ...combinedGlossary, ...data };
      }

      // 🛠️ THE TARGET MATRIX: Sweeps headings and paragraph nodes for text
      const annotationTargets = document.querySelectorAll('p, li, h1, h2, h3, span.story-body__introduction');

      annotationTargets.forEach(block => {
        if (block.querySelector('img, figure, picture, video, iframe')) return;

        // 🛠️ CLEANUP: Delete any old buttons BEFORE reading the text node
        block.querySelectorAll('.sentence-speak-btn').forEach(el => el.remove());

        // Read the pure Welsh text context safely
        const fullSentenceText = block.innerText.trim();
        if (!fullSentenceText) return; 

        const annotatedHtml = annotate(fullSentenceText, combinedGlossary);
        if (annotatedHtml !== fullSentenceText) {
          block.innerHTML = annotatedHtml;
        }

        // FILTER: Check if the element is a core story block or headline
        const isCoreContent = block.closest('article, main, [role="main"]') || 
                              block.classList.contains('story-body__paragraph') ||
                              block.classList.contains('story-body__introduction') ||
                              /h1|h2|h3/i.test(block.tagName);

        // Filter out site navigation menus entirely
        const isInsideNavMenu = block.closest('nav, header, #header, .nav-menu, .navigation');

        if (isCoreContent && !isInsideNavMenu) {
          const speakerWidget = document.createElement('button');
          speakerWidget.className = 'sentence-speak-btn';
          speakerWidget.setAttribute('data-text', fullSentenceText);
          
          // Shortened aesthetic label
          speakerWidget.innerHTML = '🔊 Llafar / Listen';
          
          // Modern, light-blue dashboard layout styling constraints
          
speakerWidget.style.cssText = `
  display: block;
  margin-top: 6px;
  margin-bottom: 10px;
  padding: 4px 10px;
  font-size: 11px;
  font-weight: bold;
  background: #e0f2fe;
  color: #0369a1;
  border: 1px solid #bae6fd;
  border-radius: 4px;
  cursor: pointer;
`;
          
          speakerWidget.onmouseenter = () => { speakerWidget.style.background = '#bae6fd'; };
          speakerWidget.onmouseleave = () => { speakerWidget.style.background = '#e0f2fe'; };
          
          block.appendChild(speakerWidget);
        }
      });

      console.log("🚀 Complete sentence boundary compilation achieved. All layout styles safe!");

    } catch (error) {
      console.error("Failed to execute extension mapping loops:", error);
    }
  }
});

function positionTooltip(el) {
  const tooltip = el.querySelector(".tooltip");
  if (!tooltip) return;

  el.classList.remove("tooltip-below");

  const wordRect = el.getBoundingClientRect();
  const tooltipHeight = tooltip.offsetHeight || 180;
  const gap = 12;

  if (wordRect.top < tooltipHeight + gap) {
    el.classList.add("tooltip-below");
  }
}

function handleToggle(event, el) {
  event.stopPropagation();

  const isOpen = el.classList.contains("show-tooltip");

  document.querySelectorAll(".annotated").forEach(item => {
    item.classList.remove("show-tooltip", "tooltip-below");
  });

  if (!isOpen) {
    el.classList.add("show-tooltip");

    requestAnimationFrame(() => {
      positionTooltip(el);
    });
  }
}

// 3. EXTENSION CLICK INTERACTION DELEGATION
document.addEventListener("click", event => {
  const target = event.target;

  if (!(target instanceof Element)) {
    return;
  }

  // Handle study-list buttons first.
  if (target.classList.contains("study-btn")) {
    event.stopPropagation();

    const word = target.getAttribute("data-word") || "";
    const param = target.getAttribute("data-param") || "";

    let rootText = word;
    let definitionText = param;
    let courseText = "";
    let unitText = "";

    try {
      const decodedData = JSON.parse(decodeURIComponent(param));

      rootText = decodedData.root || word;
      definitionText = decodedData.def || "";
      courseText = decodedData.course || "";
      unitText = decodedData.unit || "";
    } catch (error) {
      console.warn("Could not parse study button data:", error);
    }

    chrome.runtime.sendMessage(
      {
        action: "SAVE_VOCAB_WORD",
        payload: {
          word,
          root: rootText,
          def: definitionText,
          course: courseText,
          unit: unitText
        }
      },
      () => {
        target.innerText = "✅ Added!";
        target.style.background = "#059669";

        setTimeout(() => {
          document.querySelectorAll(".annotated").forEach(el => {
            el.classList.remove("show-tooltip", "tooltip-below");
          });
        }, 800);
      }
    );

    return;
  }

  // Handle the existing extension audio system.
  if (
    target.classList.contains("speak-btn") ||
    target.classList.contains("sentence-speak-btn")
  ) {
    event.stopPropagation();

    const textToPronounce = target.getAttribute("data-text") || "";
    const originalButtonText = target.innerHTML;

    target.innerHTML = "⏳ Connecting...";

    chrome.runtime.sendMessage(
      {
        action: "SPEAK_TEXT",
        payload: { text: textToPronounce }
      },
      response => {
        if (response && response.status === "SUCCESS" && response.audioData) {
          try {
            const binaryString = atob(response.audioData);
            const bytes = new Uint8Array(binaryString.length);

            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }

            const audioBlob = new Blob([bytes.buffer], {
              type: "audio/wav"
            });

            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);

            audio.play();
            audio.addEventListener("ended", () => {
              URL.revokeObjectURL(audioUrl);
            });

            target.innerHTML = originalButtonText;
          } catch (error) {
            console.error("Audio conversion failed:", error);
            target.innerHTML = "❌ Playback Error";
          }
        } else {
          target.innerHTML = "❌ Audio Unavailable";
        }

        setTimeout(() => {
          target.innerHTML = originalButtonText;
        }, 1500);
      }
    );

    return;
  }

  // Handle annotation clicks.
  const annotated = target.closest(".annotated");

  if (annotated) {
    handleToggle(event, annotated);
    return;
  }

  // Close tooltips when clicking elsewhere.
  document.querySelectorAll(".annotated").forEach(el => {
    el.classList.remove("show-tooltip", "tooltip-below");
  });
});


// 🛠️ FIXED: Moved outside the event listener block to maintain standard scoping boundaries cleanly
function triggerVisualSuccessFeedback(targetButton) {
  targetButton.innerText = "✅ Added!";
  targetButton.style.background = "#059669";
  
  setTimeout(() => {
    document.querySelectorAll('.annotated').forEach(el => el.classList.remove('show-tooltip'));
  }, 800);
}

