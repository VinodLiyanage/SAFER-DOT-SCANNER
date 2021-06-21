function setDefaults() {
  chrome.runtime.onInstalled.addListener(() => {
    try {
      chrome.storage.local.set({ openAs: "newWindow", viewMode: "modern" });
    } catch (e) {
      throw new Error(e);
    }
  });
}

async function getCurrentTab() {
  let queryOptions = { active: true, currentWindow: true };
  let [tab] = await chrome.tabs.query(queryOptions);
  if (tab && tab.id) {
    return tab.id;
  }
  return null;
}

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["openAs", "viewMode"], (result) => {
      const openAs = result?.openAs;
      const viewMode = result?.viewMode;

      resolve({ openAs, viewMode });
    });
  });
}

async function mainNormal(dotNumber) {
  if (!dotNumber || typeof dotNumber !== "string") return;
  dotNumber = dotNumber.trim();
  const { openAs } = await getSettings();

  function createTabWindow(dotNumber) {
    const url = `https://ai.fmcsa.dot.gov/SMS/Carrier/${dotNumber}/Overview.aspx`;

    const createNewTab = () => {
      chrome.tabs.create({ active: true, url });
    };

    const createNewWindow = () => {
      chrome.windows.create({ focused: true, url });
    };

    if (openAs && typeof openAs === "string") {
      switch (openAs) {
        case "newTab":
          createNewTab();
          break;
        case "newWindow":
          createNewWindow();
          break;
      }
    }
  }

  createTabWindow(dotNumber);
}

async function mainModern(dotNumber) {
  if (!dotNumber || typeof dotNumber !== "string") return;
  dotNumber = dotNumber.trim();

  async function fetchData(dotNumber) {
    const URLObject = {
      carrierRegistration: `https://ai.fmcsa.dot.gov/SMS/Carrier/${dotNumber}/CarrierRegistration.aspx`,
      overview: `https://ai.fmcsa.dot.gov/SMS/Carrier/${dotNumber}/Overview.aspx`,
    };
    const HTMLStringObject = {};

    for (let key in URLObject) {
      const url = URLObject[key];
      try {
        const HTMLString = await fetch(url)
          .then((res) => res.text())
          .then((data) => data)
          .catch((err) => {
            console.error(err);
          });

        HTMLStringObject[key] = HTMLString;
      } catch (e) {
        console.error(e);
      }
    }
    return HTMLStringObject;
  }

  async function createTabWindow() {
    const { openAs } = await getSettings();
    const url = chrome.runtime.getURL("./assets/html/safer-dot.html");

    let tabId;
    const createNewTab = async () => {
      const tabs = await chrome.tabs.create({ active: true, url });
      if (tabs && tabs.id) {
        tabId = tabs.id;
      }
    };

    const createNewWindow = async () => {
      const window = await chrome.windows.create({ focused: true, url });
      if (window && window.tabs) {
        tabId = window.tabs?.[0]?.id;
      }
    };

    if (openAs && typeof openAs === "string") {
      switch (openAs) {
        case "newTab":
          await createNewTab();
          break;
        case "newWindow":
          await createNewWindow();
          break;
      }
    }
    return tabId;
  }

  const tabId = await createTabWindow();
  const HTMLStringObject = await fetchData(dotNumber);
  
  let status;
  if (HTMLStringObject && Object.values(HTMLStringObject).some((val) => val)) {
    status = "200";
  } else {
    status = "404";
  }

  chrome.storage.local.set({ HTMLStringObject, status, tabId }, () => {
    const message = status === "200" ? "success" : "failed";
    chrome.tabs.sendMessage(tabId, { message }, () => chrome.runtime.lastError);
  });
}

async function mainExecutor(dotNumber) {
  const DOT_MIN_LENGTH = 5;
  const DOT_MAX_LENGTH = 10;
  const reDOT = /^[0-9]+$/gim;

  const { viewMode } = await getSettings();

  if (
    dotNumber &&
    dotNumber.length >= DOT_MIN_LENGTH &&
    dotNumber.length <= DOT_MAX_LENGTH &&
    reDOT.test(dotNumber)
  ) {
    switch (viewMode) {
      case "normal":
        mainNormal(dotNumber);
        break;
      case "modern":
        mainModern(dotNumber);
        break;
    }
  }
}

function contextMenu() {
  const create = async () => {
    chrome.runtime.onInstalled.addListener(() => {
      chrome.contextMenus.create(
        {
          title: "Search for SAFER DOT",
          id: `SAFER_DOT_SCANNER`,
          contexts: ["all"],
        },
        () => chrome.runtime.lastError
      );
    });
  };

  const handler = () => {
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      const tabId = tab?.id;
      let selectionText = info?.selectionText?.trim();

      if (selectionText) {
        mainExecutor(selectionText);
      } else {
        if (!tabId) {
          console.error("tabId not found!");
          return;
        }
        chrome.tabs.sendMessage(
          tabId,
          { message: "DOTScannerClicked" },
          async (response) => {
            if (!(response && response.rightClickText)) return;
            const rightClickText = response?.rightClickText?.trim();
            mainExecutor(rightClickText);
          }
        );
      }
    });
  };

  create();
  handler();
}

function listener() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    sendResponse({ farewell: "goodbye" });
    if (!sender.tab && request.message === "inputDOT") {
      if (!request.inputDOT) return;

      const inputDOT = request.inputDOT?.trim();
      mainExecutor(inputDOT);
    }
  });
}

(() => {
  setDefaults();
  contextMenu();
  listener();
})();
