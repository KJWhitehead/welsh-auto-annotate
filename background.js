// =======================================================
// MASTER WELSH EXTENSION BACKGROUND SERVICE WORKER CENTRAL BRAIN
// =======================================================

// 1. TOOLBAR ICON CLICK INTERCEPTOR
// Listens for the toolbar icon trigger and broadcasts the annotation signal down to the active tab
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(error => {
    console.error("Failed to configure side panel:", error);
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

  //ACTION C
      if (message.action === "TRANSCRIBE_AUDIO") {
    (async () => {
      try {
        const { audioData, mimeType } = message.payload;

        if (!audioData) {
          sendResponse({
            status: "ERROR",
            error: "No audioData was supplied."
          });
          return;
        }

        const binary = atob(audioData);
        const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));

        const audioBlob = new Blob([bytes], {
          type: mimeType || "audio/wav"
        });

        const formData = new FormData();
        const extension = getAudioExtension(mimeType);

formData.append(
  "soundfile",
  audioBlob,
  `recording.${extension}`
);

        const response = await fetch(
          "https://api.techiaith.cymru/speech-to-text/v2/transcribe_long_form/",
          {
            method: "POST",
            body: formData
          }
        );

const submitResponse = await fetch(
  "https://api.techiaith.cymru/speech-to-text/v2/transcribe_long_form/",
  {
    method: "POST",
    body: formData
  }
);

const submitText = await submitResponse.text();

if (!submitResponse.ok) {
  throw new Error(
    `Speech API returned HTTP ${submitResponse.status}: ${submitText}`
  );
}

let submitData;

try {
  submitData = JSON.parse(submitText);
} catch {
  throw new Error(
    `Speech API returned invalid JSON: ${submitText}`
  );
}

console.log("Techiaith long-form submission response:", submitData);

const sttId = submitData.id;

if (!sttId) {
  throw new Error(
    `Speech API did not return a transcription ID: ${submitText}`
  );
}

// Long-form transcription runs asynchronously.
const maxWaitMs = 5 * 60 * 1000;
const pollIntervalMs = 2000;
const deadline = Date.now() + maxWaitMs;

let statusData;

while (Date.now() < deadline) {
  const statusResponse = await fetch(
    `https://api.techiaith.cymru/speech-to-text/v2/get_status/?stt_id=${encodeURIComponent(sttId)}`
  );

  const statusText = await statusResponse.text();

  if (!statusResponse.ok) {
    throw new Error(
      `Speech status API returned HTTP ${statusResponse.status}: ${statusText}`
    );
  }

  try {
    statusData = JSON.parse(statusText);
  } catch {
    throw new Error(
      `Speech status API returned invalid JSON: ${statusText}`
    );
  }

  console.log("Techiaith transcription status:", statusData);

  if (statusData.status === "SUCCESS") {
    break;
  }

  if (statusData.status === "FAILURE") {
    throw new Error(
      `Speech transcription failed: ${
        statusData.error || "Unknown processing error"
      }`
    );
  }

  await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
}

if (!statusData || statusData.status !== "SUCCESS") {
  throw new Error(
    `Speech transcription timed out after ${maxWaitMs / 1000} seconds.`
  );
}

// Retrieve the completed transcription JSON.
const resultResponse = await fetch(
  `https://api.techiaith.cymru/speech-to-text/v2/get_json/?stt_id=${encodeURIComponent(sttId)}`
);

const resultText = await resultResponse.text();

if (!resultResponse.ok) {
  throw new Error(
    `Speech result API returned HTTP ${resultResponse.status}: ${resultText}`
  );
}

let resultData;

try {
  resultData = JSON.parse(resultText);
} catch {
  throw new Error(
    `Speech result API returned invalid JSON: ${resultText}`
  );
}

console.log("Techiaith transcription result:", resultData);

let transcript = "";

if (typeof resultData === "string") {
  transcript = resultData;
} else if (Array.isArray(resultData.segments)) {
  transcript = resultData.segments
    .map(segment => segment.text || segment.normalized || "")
    .filter(Boolean)
    .join(" ");
} else if (Array.isArray(resultData)) {
  transcript = resultData
    .map(item =>
      item.text ||
      item.transcript ||
      item.transcription ||
      ""
    )
    .filter(Boolean)
    .join(" ");
} else {
  transcript =
    resultData.text ||
    resultData.transcript ||
    resultData.transcription ||
    resultData.result ||
    resultData.output ||
    "";
}

transcript = String(transcript).trim();

if (!transcript) {
  throw new Error(
    `Speech API returned no transcript. Raw result: ${resultText}`
  );
}

        sendResponse({
          status: "SUCCESS",
          text: transcript
        });
      } catch (error) {
        console.error("Speech transcription failed:", error);

        sendResponse({
          status: "ERROR",
          error: error.message
        });
        
      }
    })();

    return true;
  }
});
// Add this after the complete message listener.
function getAudioExtension(mimeType) {
  const type = String(mimeType || "").toLowerCase();

  if (type.includes("ogg")) {
    return "ogg";
  }

  if (type.includes("webm")) {
    return "webm";
  }

  if (type.includes("mpeg") || type.includes("mp3")) {
    return "mp3";
  }

  if (type.includes("mp4") || type.includes("m4a")) {
    return "m4a";
  }

  return "wav";
}
