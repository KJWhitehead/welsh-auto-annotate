// Listen for the user clicking the extension's icon in their toolbar
chrome.action.onClicked.addListener((tab) => {
  // Send a message to the active tab telling it to start annotating
  chrome.tabs.sendMessage(tab.id, { action: "RUN_ANNOTATION" });
});
