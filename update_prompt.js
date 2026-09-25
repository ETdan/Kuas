/**
 * update_prompt.js - Prompts user to apply available extension updates.
 *
 * 1. Checks if there are active updates (via stored state & chrome.runtime.requestUpdateCheck).
 * 2. Displays a prompt asking the user if they want to update now.
 * 3. Restarts the extension immediately on confirmation (chrome.runtime.reload()) so the
 *    update applies right away without waiting for Chrome to restart.
 */

export async function checkUpdatePrompt() {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return;

  function renderPrompt(version) {
    if (document.getElementById("kuas-update-prompt")) return;

    const promptEl = document.createElement("div");
    promptEl.id = "kuas-update-prompt";
    promptEl.className = "update-prompt";

    const msgEl = document.createElement("div");
    msgEl.className = "update-prompt-msg";

    const iconSpan = document.createElement("span");
    iconSpan.className = "update-prompt-icon";
    iconSpan.textContent = "⚡";

    const textSpan = document.createElement("span");
    textSpan.className = "update-prompt-text";
    textSpan.textContent = version
      ? `A new update (v${version}) is available. Update now?`
      : "A new update is available. Restart now to apply?";

    msgEl.appendChild(iconSpan);
    msgEl.appendChild(textSpan);

    const btnGroup = document.createElement("div");
    btnGroup.className = "update-prompt-buttons";

    const yesBtn = document.createElement("button");
    yesBtn.id = "updatePromptYes";
    yesBtn.className = "update-btn-yes";
    yesBtn.textContent = "Update Now";

    const noBtn = document.createElement("button");
    noBtn.id = "updatePromptNo";
    noBtn.className = "update-btn-no";
    noBtn.textContent = "Later";

    btnGroup.appendChild(yesBtn);
    btnGroup.appendChild(noBtn);

    promptEl.appendChild(msgEl);
    promptEl.appendChild(btnGroup);

    // Mount at top of body so it is immediately visible
    document.body.prepend(promptEl);

    yesBtn.addEventListener("click", async () => {
      yesBtn.textContent = "Restarting…";
      yesBtn.disabled = true;
      noBtn.disabled = true;

      try {
        await chrome.storage.local.remove(["updateAvailable", "updateVersion"]);
      } catch (_e) {}

      if (typeof chrome !== "undefined" && chrome.runtime?.reload) {
        chrome.runtime.reload();
      } else if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: "RESTART_EXTENSION" });
      }
    });

    noBtn.addEventListener("click", () => {
      promptEl.remove();
    });
  }

  // 1. Check if an update was already detected and stored
  try {
    const data = await chrome.storage.local.get(["updateAvailable", "updateVersion"]);
    if (data?.updateAvailable) {
      renderPrompt(data.updateVersion || "");
    }
  } catch (_e) {}

  // 2. Actively check Chrome for updates right now
  if (typeof chrome !== "undefined" && chrome.runtime?.requestUpdateCheck) {
    try {
      chrome.runtime.requestUpdateCheck((status, details) => {
        if (status === "update_available") {
          chrome.storage.local.set({
            updateAvailable: true,
            updateVersion: details?.version || "",
          });
          renderPrompt(details?.version || "");
        }
      });
    } catch (_e) {}
  }

  // 3. React in real time if background detects an update while popup is open
  if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.updateAvailable) {
        if (changes.updateAvailable.newValue) {
          chrome.storage.local.get(["updateVersion"]).then((res) => {
            renderPrompt(res?.updateVersion || "");
          }).catch(() => {
            renderPrompt("");
          });
        } else {
          document.getElementById("kuas-update-prompt")?.remove();
        }
      }
    });
  }
}
