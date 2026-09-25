// Listen for the user clicking the extension's icon in their toolbar
chrome.action.onClicked.addListener((tab) => {
  // Send a message to the active tab telling it to start annotating
  chrome.tabs.sendMessage(tab.id, { action: "RUN_ANNOTATION" });
});

// 2. EXTENSION PERSISTENT SYNC STORAGE CONTROLLER
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "SAVE_VOCAB_WORD") {
    const data = message.payload;

    // Securely pull existing data from Chrome's persistent profile cloud storage bucket
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
      
      // Sort words by review count so the trickiest flags naturally float to the top
      loggedWords.sort((a, b) => b.count - a.count);

      // Save state adjustments seamlessly back up into profile cloud memory storage registers
      chrome.storage.sync.set({ "welshExtensionStudySession": JSON.stringify(loggedWords) }, () => {
        console.log("💾 Vocabulary successfully committed to sync storage profile:", data.word);
        sendResponse({ status: "SUCCESS" });
      });
    });
    
    return true; // Keeps the messaging pipeline channel open for asynchronous callbacks
  }
});
