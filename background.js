// Listen for the user clicking the extension's icon in their toolbar
chrome.action.onClicked.addListener((tab) => {
  // Send a message to the active tab telling it to start annotating
  chrome.tabs.sendMessage(tab.id, { action: "RUN_ANNOTATION" });
});

// 2. EXTENSION PERSISTENT SYNC STORAGE CONTROLLER
// Receives vocabulary words from content.js and securely commits them to the user's Profile
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "SAVE_VOCAB_WORD") {
    const data = message.payload;

    // Pull existing data from Chrome's persistent profile sync storage bucket
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
      
      // Sort words by review count so high-priority words naturally float to the top
      loggedWords.sort((a, b) => b.count - a.count);

      // Save state adjustments seamlessly back up into profile storage registers
      chrome.storage.sync.set({ "welshExtensionStudySession": JSON.stringify(loggedWords) }, () => {
        console.log("💾 Vocabulary successfully committed to sync storage profile:", data.word);
        sendResponse({ status: "SUCCESS" });
      });
    });
    
    return true; // Keeps the messaging pipeline channel open for asynchronous callbacks
  }
});

 // 3. TECHIAITH ORPHEUS TEXT-TO-SPEECH STREAMER
  if (message.action === "SPEAK_TEXT") {
    const textToSpeak = message.payload.text;
    

    const chosenSpeaker = "benyw-deheuol-pro"; 

    // Hitting the verified Orpheus endpoint route matching your curl schema
    fetch("https://api.techiaith.cymru/speak/v3/api/orpheus", {
      method: "POST",
      headers: {
        "accept": "*/*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: textToSpeak,
        speaker_id: chosenSpeaker 
      })
    })
    .then(response => {
      if (!response.ok) throw new Error("Techiaith Orpheus API structural validation failure.");
      return response.blob(); 
    })
    .then(blob => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    })
    .then(audioDataUrl => {
      sendResponse({ status: "SUCCESS", audioUrl: audioDataUrl });
    })
    .catch(error => {
      console.error("Techiaith Orpheus Streaming Error:", error);
      sendResponse({ status: "ERROR", error: error.message });
    });

    return true; 
  }
