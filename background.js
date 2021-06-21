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

  async function createTabWindow(dotNumber) {
    const { openAs } = await getSettings();
    const url = `https://ai.fmcsa.dot.gov/SMS/Carrier/${dotNumber}/Overview.aspx`;

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

  return createTabWindow(dotNumber);
}

async function mainModern(dotNumber) {

  async function fetchData(dotNumber) {
    if (!dotNumber || typeof dotNumber !== "string") return;
    dotNumber = dotNumber.trim();

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
  if (HTMLStringObject && Object.values(HTMLStringObject).some(val => val)) {
    status = "200";
  } else {
    status = "404";
  }

  chrome.storage.local.set({ HTMLStringObject, status, tabId }, () => {
    const message = (status === "200" ? "success" : "failed");
    chrome.tabs.sendMessage(tabId, { message }, function (response) {
      console.log(response.farewell);
    });
  });
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
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
      const { viewMode } = await getSettings();

      const tabId = tab?.id;
      let selectionText = info?.selectionText?.trim();
    
      if (selectionText) {
        switch (viewMode) {
          case "normal":
            await mainNormal(selectionText);
            break;
          case "modern":
            await mainModern(selectionText);
            break;
        }
      } else {
        if (!tabId) {
          console.error("tabId not found!");
          return;
        }

        chrome.tabs.sendMessage(
          tabId,
          { message: "DOTScannerClicked" },
          async (response) => {

            const selectionText = response?.selectionText?.trim();

            if (selectionText) {
              switch (viewMode) {
                case "normal":
                  await mainNormal(selectionText);
                  break;
                case "modern":
                  await mainModern(selectionText);
                  break;
              }
            }
            return true;
          }
        );
      }
    });
  };

  create();
  handler();
}

async function listener() {
  chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    sendResponse({ farewell: "goodbye" });
    const { viewMode } = await getSettings();
    if (!sender.tab && request.message === "inputDOT") {
      const inputDOT = request?.inputDOT?.trim();
      if (inputDOT) {
        switch (viewMode) {
          case "normal":
            await mainNormal(inputDOT);
            break;
          case "modern":
            await mainModern(inputDOT);
            break;
        }
      }
    }
    return true;
  });
}

(() => {
  setDefaults();
  contextMenu();
  listener();
})();
