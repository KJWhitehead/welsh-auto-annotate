let mediaRecorder = null;
let audioChunks = [];
let mediaStream = null;
let permissionTabOpened = false;

chrome.runtime.onMessage.addListener(message => {
  if (message.action === "MIC_PERMISSION_GRANTED") {
    permissionTabOpened = false;
    statusElement.textContent = "Permission granted. Starting recording…";
    startRecording(true);
  }
});

const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const statusElement = document.getElementById("status");
const transcriptElement = document.getElementById("transcript");

startButton.addEventListener("click", startRecording);
stopButton.addEventListener("click", stopRecording);

async function startRecording() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: true
    });

    audioChunks = [];

    const mimeType = getSupportedMimeType();

    mediaRecorder = mimeType
      ? new MediaRecorder(mediaStream, { mimeType })
      : new MediaRecorder(mediaStream);

    mediaRecorder.addEventListener("dataavailable", event => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    });

    mediaRecorder.addEventListener("stop", handleRecordingStopped);

    mediaRecorder.start();

    startButton.disabled = true;
    stopButton.disabled = false;
    statusElement.textContent = "Recording…";
  } catch (error) {
    console.error("Could not start recording:", error);
    statusElement.textContent =
      `Could not access the microphone: ${error.message}`;
  }
}

function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state === "inactive") {
    return;
  }

  mediaRecorder.stop();

  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
  }

  startButton.disabled = false;
  stopButton.disabled = true;
  statusElement.textContent = "Preparing audio…";
}

async function handleRecordingStopped() {
  try {
    const audioBlob = new Blob(audioChunks, {
      type: mediaRecorder.mimeType || "audio/webm"
    });

    const audioData = await blobToBase64(audioBlob);

    statusElement.textContent = "Sending audio for transcription…";

    chrome.runtime.sendMessage(
      {
        action: "TRANSCRIBE_AUDIO",
        payload: {
          audioData,
          mimeType: audioBlob.type
        }
      },
      response => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError.message);
          statusElement.textContent =
            `Extension error: ${chrome.runtime.lastError.message}`;
          return;
        }

        if (!response || response.status !== "SUCCESS") {
          const errorMessage =
            response?.error || "Unknown transcription error.";

          console.error("Transcription failed:", errorMessage);
          statusElement.textContent = `Error: ${errorMessage}`;
          return;
        }

        transcriptElement.value +=
          `${response.text}\n`;

        statusElement.textContent = "Transcription complete.";
      }
    );
  } catch (error) {
    console.error("Could not process recording:", error);
    statusElement.textContent =
      `Audio processing error: ${error.message}`;
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      const result = reader.result;

      if (typeof result !== "string" || !result.includes(",")) {
        reject(new Error("Could not convert audio to base64."));
        return;
      }

      resolve(result.split(",")[1]);
    };

    reader.onerror = () => {
      reject(reader.error || new Error("Could not read audio."));
    };

    reader.readAsDataURL(blob);
  });
}

function getSupportedMimeType() {
  const candidates = [
    "audio/ogg;codecs=opus",
    "audio/webm;codecs=opus",
    "audio/webm"
  ];

  return candidates.find(type =>
    MediaRecorder.isTypeSupported(type)
  ) || "";
}
