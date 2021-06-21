function getTextFromRightClick() {
  const DOT_MIN_LENGTH = 5;
  const DOT_MAX_LENGTH = 10;

  const getText = (event) => {
    const reDOT = /^[0-9]+$/gim;

    const target = event?.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.nodeName === "INPUT") {
      const targetText = target?.value?.trim();
      if (
        targetText &&
        targetText.length >= DOT_MIN_LENGTH &&
        targetText.length <= DOT_MAX_LENGTH &&
        reDOT.test(targetText)
      ) {
        return targetText;
      }
    }

    if (!target.hasChildNodes()) return;

    const originalTargetElement = target.cloneNode(true);

    const textNodesArray = Array.from(target.childNodes).filter(
      (node) => node.nodeName === "#text"
    );
    if (!textNodesArray.length) return;

    textNodesArray.forEach((textNode) => {
      let textArray = textNode?.nodeValue?.split(/(\s|\n|\r)/gim);
      if (!textArray.length) return;

      const fragment = new DocumentFragment();
      textArray.forEach((text) => {
        if (/\s/gim.test(text)) return;

        const span = document.createElement("span");
        span.innerText = text;
        fragment.append(span, " ");
      });
      textNode.replaceWith(fragment);
    });

    const targetSpan = document.elementFromPoint(event.clientX, event.clientY);
    target.replaceWith(originalTargetElement);
    const targetText = targetSpan?.innerText?.trim();
    if (
      targetText &&
      targetText.length >= DOT_MIN_LENGTH &&
      targetText.length <= DOT_MAX_LENGTH &&
      reDOT.test(targetText)
    ) {
      return targetText;
    }
    return false;
  };

  const handleContextMenu = (event) => {
    if(!(chrome.runtime && chrome.runtime.id)) return;
    
    const handleMessage = (request, _, sendResponse) => {
      if (request.message === "DOTScannerClicked") {
        const rightClickText = getText(event);
      
        if(rightClickText) {
          sendResponse({ rightClickText })
        }
      }
      chrome.runtime.onMessage.removeListener(handleMessage);
      
    };
    chrome.runtime.onMessage.addListener(handleMessage);
  };
  document.addEventListener("contextmenu", handleContextMenu);
}

(() => {
  getTextFromRightClick();
})();
