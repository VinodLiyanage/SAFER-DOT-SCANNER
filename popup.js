/***********************************************************************
  
            https://github.com/VinodLiyanage/SAFER-DOT-SCANNER
  -------------------------------- (C) ---------------------------------
  @name popup.js
  @version 1.0
  @author Vinod Liyanage
  @license MIT
  @description extension popup script.
************************************************************************/

async function main() {
  const DOT_MIN_LENGTH = 5;
  const DOT_MAX_LENGTH = 10;

  const createNewTab = document.getElementById("createNewTab");
  const createNewWindow = document.getElementById("createNewWindow");
  const normalView = document.getElementById("normalView");

  if (!(createNewTab && createNewTab instanceof HTMLElement)) return;
  if (!(createNewWindow && createNewWindow instanceof HTMLElement)) return;
  if (!(normalView && normalView instanceof HTMLElement)) return;

  function getSettings() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(["openAs", "viewMode"], (result) => {
        const openAs = result?.openAs;
        const viewMode = result?.viewMode;

        if (!openAs || typeof openAs !== "string") {
          reject(false);
        }
        resolve({ openAs, viewMode });
      });
    });
  }

  async function restoreState() {
    const { openAs, viewMode } = await getSettings();

    if (openAs && typeof openAs === "string") {
      switch (openAs) {
        case "newTab":
          createNewTab.setAttribute("checked", "true");
          createNewWindow.removeAttribute("checked");
          break;
        case "newWindow":
          createNewWindow.setAttribute("checked", "true");
          createNewTab.removeAttribute("checked");
          break;
      }

      normalView.toggleAttribute("checked", viewMode === "normal");
    }
  }

  function handler() {
    const inputSearch = document.getElementById("inputSearch");
    const searchBtn = document.getElementById("searchBtn");

    if (!(inputSearch && inputSearch instanceof HTMLElement)) return;
    if (!(searchBtn && searchBtn instanceof HTMLElement)) return;

    const handleInput = () => {
      inputSearch.classList.remove("is-invalid", "is-valid");
    };
    const handleSearch = () => {
      const inputDOT = inputSearch?.value?.trim();
      const reDOT = /^[0-9]+$/gim;
      if (
        inputDOT &&
        inputDOT.length >= DOT_MIN_LENGTH &&
        inputDOT.length <= DOT_MAX_LENGTH &&
        reDOT.test(inputDOT)
      ) {
        chrome.runtime.sendMessage(
          { message: "inputDOT", inputDOT },
          function (response) {
            return response
          }
        );

        inputSearch.classList.remove("is-invalid");
        inputSearch.classList.add("is-valid");
      } else {
        inputSearch.classList.remove("is-valid");
        inputSearch.classList.add("is-invalid");
      }
    };
    const handleRadioChange = () => {
      if (createNewTab.checked === true) {
        chrome.storage.local.set({ openAs: "newTab" });
      } else if (createNewWindow.checked === true) {
        chrome.storage.local.set({ openAs: "newWindow" });
      }
    };
    const handleCheckChange = () => {
      const viewMode = normalView?.checked ? "normal" : "modern";
      chrome.storage.local.set({ viewMode });
    };

    searchBtn.addEventListener("click", handleSearch);

    for (let radio of [createNewTab, createNewWindow]) {
      radio.addEventListener("change", handleRadioChange);
    }
    normalView.addEventListener("change", handleCheckChange);
    inputSearch.addEventListener("input", handleInput);
  }

  await restoreState();
  handler();
}

document.addEventListener("DOMContentLoaded", () => {
  main();
});
