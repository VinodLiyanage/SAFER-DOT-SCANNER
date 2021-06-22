const sessionStorage = window.sessionStorage;

function addLoading() {
  if (!(window && document.body)) return;

  const loadingContainer = document.createElement("div");
  loadingContainer.setAttribute("id", "loadingContainer");

  const img = document.createElement("img");
  const imgsrc = chrome.runtime.getURL("/assets/images/search.gif");
  img.setAttribute("src", imgsrc);
  img.setAttribute("alt", "loading...");
  loadingContainer.append(img);

  document.body.append(loadingContainer);
}

function clearLoading() {
  const loadingContainer = document.getElementById("loadingContainer");
  if (loadingContainer instanceof HTMLElement) {
    loadingContainer.remove();
  }
}

function handleSuccess() {
  const faviconSrc = chrome.runtime.getURL("/assets/images/logo-success.png");
  const link = document.createElement("link");
  link.setAttribute("rel", "shortcut icon");
  link.setAttribute("type", "image/png");
  link.setAttribute("href", faviconSrc);
  document.head.append(link);
}

function handleFailed() {
  const parser = new DOMParser();
  const src = chrome.runtime.getURL("/assets/images/404-error.gif");
  const error404ContainerString = `<div id="error404" class="error-404">
      <div class="four_zero_four_bg">
        <div class="text-404">
          <h1>404</h1>
        </div>
        <img src="${src}" alt="error-404" />
        <div class="contant_box_404">
          <h3>Looks like you're lost</h3>
          <p>The page you are looking for is not available!</p>
        </div>
      </div>
    </div>`;
  const error404Container = parser.parseFromString(
    error404ContainerString,
    "text/html"
  );
  document.body.append(error404Container.body.firstChild);

  const faviconSrc = chrome.runtime.getURL("/assets/images/logo-danger.png");
  const link = document.createElement("link");
  link.setAttribute("rel", "shortcut icon");
  link.setAttribute("type", "image/png");
  link.setAttribute("href", faviconSrc);
  document.head.append(link);
}

function getArticles(HTMLStringObject) {
  if (!HTMLStringObject || typeof HTMLStringObject !== "object") return;
  if(!Object.values(HTMLStringObject).some(val => val)) return;

  const articleElementObject = {};
  const parser = new DOMParser();

  const deleteSelectorList = [
    "#BASICContainer",
    ".modal-content",
    "#footer-disclaimer",
    "img",
    ".printLnk",
  ];

  for (let key in HTMLStringObject) {
    const HTMLString = HTMLStringObject[key];
    if (!HTMLString) continue;

    try {
      const doc = parser.parseFromString(HTMLString, "text/html");
      const articleElem = doc.querySelector("article");

      if (!(articleElem instanceof HTMLElement)) continue;

      for (let selector of deleteSelectorList) {
        const deleteElem = articleElem.querySelector(selector);
        if (!(deleteElem instanceof HTMLElement)) continue;
        deleteElem.remove();
      }

      Array.from(articleElem.querySelectorAll("a[href]")).forEach((elem) => {
        const reletiveHref = elem.getAttribute("href"); //reletive path e.g. /sms/...
        if (!(reletiveHref && reletiveHref.length)) return;

        const hrefRE = /(https?|ftp)/gim;
        if (!hrefRE.test(reletiveHref)) {
          const absoluteHref = "https://ai.fmcsa.dot.gov" + reletiveHref;
          elem.setAttribute("href", absoluteHref);
        }
      });

      articleElementObject[key] = articleElem;
    } catch (e) {
      throw new Error(e);
    }
  }
  return articleElementObject;
}

function createElement(articleElementObject) {
  if (!articleElementObject || typeof articleElementObject !== "object") {
    return;
  }
  if(!Object.values(articleElementObject).some(val => val)) return;

  const root = document.getElementById("root");

  const articleOverview = articleElementObject["overview"];
  const articleCarrierReg = articleElementObject["carrierRegistration"];

  let isValid = false;
  for (let article of [articleOverview, articleCarrierReg]) {
    if (!(article instanceof HTMLElement)) continue;

    const articleID = article.getAttribute("id");
    if (articleID === "carrierBody" || articleID === "regInfo") {
      isValid = true;
    }
  }

  if (isValid) {
    if (
      articleOverview instanceof HTMLElement &&
      articleOverview.hasChildNodes() &&
      articleOverview.children.length > 1
    ) {
      articleOverview.insertBefore(
        articleCarrierReg,
        articleOverview.children[1]
      );
      root.append(articleOverview);
      handleSuccess();
    }
  } else {
    handleFailed();
  }
  return isValid;
}

async function main() {
  function getStorageData() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(
        ["HTMLStringObject", "status"],
        (result) => {
          const HTMLStringObject = result?.HTMLStringObject;
          const status = result?.status;

          if (HTMLStringObject) {
            resolve({
              HTMLStringObject,
              status
            });
          } else {
            reject(false);
          }
        }
      );
    });
  }

  const storageData = await getStorageData();
  if (!storageData) return;

  const { HTMLStringObject } = storageData;

  const articleElementObject = getArticles(HTMLStringObject);
  createElement(articleElementObject);

  chrome.storage.local.remove(["HTMLStringObject", "status"]);
  sessionStorage.setItem("HTMLStringObject", JSON.stringify(HTMLStringObject));

  return true;
}

function messageListener() {
  addLoading();
  const handleMessage = (request) => {
    clearLoading();
    if (request.message === "success") {
      main();
    } else if (request.message === "failed") {
      handleFailed();
    }
    chrome.runtime.onMessage.removeListener(handleMessage);
  };
  chrome.runtime.onMessage.addListener(handleMessage);
}

function retriveHTMLFromStorage() {
  let oldHTMLStringObject = sessionStorage.getItem("HTMLStringObject");
  if (!oldHTMLStringObject) return false;
  try {
    oldHTMLStringObject = JSON.parse(oldHTMLStringObject);
    const articleElementObject = getArticles(oldHTMLStringObject);
    createElement(articleElementObject);
    return true;
  } catch (e) {
    throw new Error(e);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const isRetriveble = retriveHTMLFromStorage();
  if (!isRetriveble) {
    messageListener();
  }
});
