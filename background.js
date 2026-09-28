// =======================================================
// MASTER WELSH EXTENSION BACKGROUND SERVICE WORKER CENTRAL BRAIN
// =======================================================

// 1. TOOLBAR ICON CLICK INTERCEPTOR
// Listens for the toolbar icon trigger and broadcasts the annotation signal down to the active tab
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { action: "RUN_ANNOTATION" });
});

// 2. CENTRAL EXTENSION MESSAGE ACTION ROUTER
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  
  // ─── ACTION A: SAVE VOCAB WORD TO STORAGE ──────────────────────────
  if (message.action === "SAVE_VOCAB_WORD") {
    const data = message.payload;

    chrome.storage.sync.get(["welshExtensionStudySession"], (result) => {
      let loggedWords = result.welshExtensionStudySession ? JSON.parse(result.welshExtensionStudySession) : [];
      
      const matchIdx = loggedWords.findIndex(item => item.word.toLowerCase() === data.word.toLowerCase());
      
      if (matchIdx !== -1) {
        loggedWords[matchIdx].count += 1;
      } else {
        loggedWords.push({ 
          word: data.word, 
          displayDef: data.def, 
          course: data.course, 
          unit: data.unit, 
          count: 1 
        });
      }
      
      loggedWords.sort((a, b) => b.count - a.count);

      chrome.storage.sync.set({ "welshExtensionStudySession": JSON.stringify(loggedWords) }, () => {
        console.log("💾 Vocabulary successfully committed to sync storage profile:", data.word);
        sendResponse({ status: "SUCCESS" });
      });
    });
    
    return true; // Keeps the messaging pipeline channel open for asynchronous callbacks
  }

 // ─── ACTION B: TECHIAITH ORPHEUS TEXT-TO-SPEECH STREAMER ──────────
  if (message.action === "SPEAK_TEXT") {
    const textToSpeak = message.payload.text;
    const chosenSpeaker = "benyw-deheuol-pro"; 

    // 🛠️ FIXED: Configured with mode flags to cleanly bypass the Nginx preflight 405 trap!
    fetch("https://api.techiaith.cymru/speak/v3/api/orpheus", {
      method: "POST",
      mode: "cors", // Forces proper Cross-Origin Resource Sharing protocols
      headers: {
        "Content-Type": "application/json"
        // Stripped the "accept: */*" header as custom accepts can force browsers to trigger failing preflights!
      },
      body: JSON.stringify({
        text: String(textToSpeak).trim(),
        speaker_id: String(chosenSpeaker).trim()
      })
    })
    .then(response => {
      if (!response.ok) {
        console.error("Techiaith response status code failure:", response.status);
        throw new Error(`Techiaith API returned a ${response.status} error.`);
      }
      return response.arrayBuffer(); 
    })
    .then(buffer => {
      // Safe service worker memory array bitwise buffer mapping loop
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64String = btoa(binary);
      
      sendResponse({ status: "SUCCESS", audioData: base64String });
    })
    .catch(error => {
      console.error("Techiaith Orpheus Streaming Error:", error);
      sendResponse({ status: "ERROR", error: error.message });
    });

    return true; // Keeps the messaging pipeline channel open for asynchronous callbacks
  }
});
