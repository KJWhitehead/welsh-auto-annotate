// =======================================================
// MASTER EXTENSION DROPDOWN CONTROL DECK CONTROLLER
// =======================================================

document.addEventListener('DOMContentLoaded', () => {
  const tableBody = document.getElementById("studyListBody");
  const btnScan = document.getElementById("btnScan");
  const btnExport = document.getElementById("btnExport");
  const btnClear = document.getElementById("btnClear");

  function renderTable() {
    // Read securely from Chrome's persistent profile cloud storage bucket
    chrome.storage.sync.get(["welshExtensionStudySession"], (result) => {
      let loggedWords = result.welshExtensionStudySession ? JSON.parse(result.welshExtensionStudySession) : [];

      if (loggedWords.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" class="empty-msg">List empty. Tap [+] inside page bubbles to track vocabulary.</td></tr>`;
        return;
      }

      tableBody.innerHTML = loggedWords.map(item => {
        // Build the label dynamically so it never displays a stray hanging bullet
        const courseText = item.course ? item.course.trim() : "";
        const unitText = item.unit ? item.unit.trim() : "";
        const sourceLabel = (courseText && unitText) ? `${courseText} • ${unitText}` : (courseText || unitText || "");
        
        return `<tr>
          <td><span class="table-word">${item.word}</span></td>
          <td>${item.displayDef}</td>
          <td>${sourceLabel ? `<span class="unit-tag">\${sourceLabel}</span>` : ""}</td>
          <td style="text-align: center;"><span class="count-badge">${item.count}×</span></td>
        </tr>`;
      }).join("");
    });
  }

  // 🚀 Triggers annotation injection via background channels onto the current tab layout context
  btnScan.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { action: "RUN_ANNOTATION" });
      btnScan.innerText = "✅ Page Annotation Swept!";
      setTimeout(() => { btnScan.innerText = "🚀 Scan & Annotate Page"; }, 1500);
    }
  });

  // 📥 Standardised system XML file parser engine block
  btnExport.addEventListener('click', () => {
    chrome.storage.sync.get(["welshExtensionStudySession"], (result) => {
      let loggedWords = result.welshExtensionStudySession ? JSON.parse(result.welshExtensionStudySession) : [];
      if (loggedWords.length === 0) return alert("Study list is empty!");

      let xmlString = `<?xml version="1.0" encoding="UTF-8"?>\n<studylist>\n`;
      loggedWords.forEach(item => {
        xmlString += `  <item>\n`;
        xmlString += `    <word>${escapeXML(item.word)}</word>\n`;
        xmlString += `    <definition>${escapeXML(item.displayDef)}</definition>\n`;
        xmlString += `    <course>${escapeXML(item.course)}</course>\n`;
        xmlString += `    <unit>${escapeXML(item.unit)}</unit>\n`;
        xmlString += `    <count>${item.count}</count>\n`;
        xmlString += `  </item>\n`;
      });
      xmlString += `</studylist>`;

      const blob = new Blob([xmlString], { type: "text/xml" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "welsh_extension_vocabulary_list.xml";
      link.click();
    });
  });

  btnClear.addEventListener('click', () => {
    if (confirm("Clear your permanent extension vocabulary review tracking history?")) {
      chrome.storage.sync.remove("welshExtensionStudySession", () => { renderTable(); });
    }
  });

  function escapeXML(str) {
    if (!str) return "";
    return str.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  renderTable();
});
