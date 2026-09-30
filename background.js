// =======================================================
// MASTER WELSH EXTENSION BACKGROUND SERVICE WORKER CENTRAL BRAIN
// =======================================================

// 1. TOOLBAR ICON CLICK INTERCEPTOR
// Listens for the toolbar icon trigger and broadcasts the annotation signal down to the active tab
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { action: "RUN_ANNOTATION" });
});

// 2. CENTRAL EXTENSION MESSAGE ACTION ROUTER
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  
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

  
    if (message.action === "TRANSCRIBE_AUDIO") {
    try {
      const { audioData, mimeType } = message.payload;

      if (!audioData) {
        sendResponse({
          status: "ERROR",
          error: "No audio data was supplied."
        });
        return;
      }

      // Convert base64 audio back into a Blob.
      const binary = atob(audioData);
      const bytes = Uint8Array.from(binary, character =>
        character.charCodeAt(0)
      );

      const audioBlob = new Blob([bytes], {
        type: mimeType || "audio/wav"
      });

      const formData = new FormData();

      // This field name must match the API documentation.
      formData.append("soundfile", audioBlob, "recording.wav");
      formData.append("priority", "high");

      const response = await fetch(
        "https://api.techiaith.cymru/speech-to-text/v2/transcribe/",
        {
          method: "POST",
          body: formData
        }
      );

      const responseText = await response.text();

      console.log("Speech recognition HTTP status:", response.status);
      console.log("Speech recognition response:", responseText);

      if (!response.ok) {
        sendResponse({
          status: "ERROR",
          error: `Speech API returned HTTP ${response.status}: ${responseText}`
        });
        return;
      }

      let transcript = "";

      try {
        const parsed = JSON.parse(responseText);

        if (typeof parsed === "string") {
          transcript = parsed;
        } else {
          transcript =
            parsed.text ||
            parsed.transcript ||
            parsed.transcription ||
            "";
        }
      } catch {
        // The API may return plain text rather than JSON.
        transcript = responseText;
      }

      transcript = transcript.trim();

      if (!transcript) {
        sendResponse({
          status: "ERROR",
          error: "The speech API returned an empty transcription."
        });
        return;
      }

      sendResponse({
        status: "SUCCESS",
        text: transcript
      });
    } catch (error) {
      console.error("Speech recognition request failed:", error);

      sendResponse({
        status: "ERROR",
        error: error.message
      });
    }

    return true;
  }
});
