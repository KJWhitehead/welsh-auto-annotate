const allowButton = document.getElementById("allowButton");
const statusElement = document.getElementById("status");

allowButton.addEventListener("click", async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true
    });

    stream.getTracks().forEach(track => track.stop());

    statusElement.textContent =
      "Microphone permission granted. Return to the side panel.";

    chrome.runtime.sendMessage({
      action: "MIC_PERMISSION_GRANTED"
    });
  } catch (error) {
    console.error("Microphone permission failed:", error);

    statusElement.textContent =
      `Microphone permission failed: ${error.name} — ${error.message}`;
  }
});
