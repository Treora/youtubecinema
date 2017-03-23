// Be compatible with Chrome|ium. We do not need the full webextension-polyfill.
if (typeof browser === 'undefined') {
  this.browser = chrome
};


var cruftedUrlPattern = /^(https?):\/\/(?:.+\.)youtube\.com\/watch\?.*v=([^&#]+)/;
var embeddableUrlPattern = /^(https?):\/\/(?:.+\.)youtube\.com\/embed\/([^&?#]+)/;

// Keep a set of tabIds for which the user disabled the cinema mode (with the pageAction button)
var tabsWithCinemaModeDisabled = {};

// Turn a video url into its embeddable (full-window) version (and vice versa, if bothDirections==true).
function makeNewUrl(tabId, url, bothDirections) {
  if (!tabsWithCinemaModeDisabled[tabId]) {
    var match = url.match(cruftedUrlPattern);
    if (!match)
      return;
    var scheme = match[1];
    var videoId = match[2];
    return scheme + '://www.youtube.com/embed/' + videoId + '?rel=0&autoplay=1';
  }
  else if (bothDirections) {
    var match = url.match(embeddableUrlPattern);
    if (!match)
      return;
    var scheme = match[1];
    var videoId = match[2];
    return scheme + '://www.youtube.com/watch?v=' + videoId;
  }
}


// Redirect crufted videos to their full-window version.
function onBeforeRequestListener(details) {
  var newUrl = makeNewUrl(details.tabId, details.url, false)

  // From the embed, enable one to follow the "watch on YouTube" link (on browsers that pass originUrl)
  if (newUrl === details.originUrl)
    return

  return {redirectUrl: newUrl};
}

browser.webRequest.onBeforeRequest.addListener(
  onBeforeRequestListener,
  {urls: ["*://*.youtube.com/watch*"]},
  ['blocking']
);


// Show the pageAction button if looking at a video (either with or without cruft).
browser.webNavigation.onCommitted.addListener(handleNavigation);
browser.webNavigation.onHistoryStateUpdated.addListener(handleNavigation);

function handleNavigation(details) {
  // Ignore pages inside frames.
  if (details.frameId !== 0)
    return;

  // Check if the page is a youtube video (either with or without cruft)
  var matchEmbeddable = details.url.match(embeddableUrlPattern);
  var matchCruft = details.url.match(cruftedUrlPattern);
  if (matchEmbeddable || matchCruft) {
    // Show the pageAction button.
    browser.pageAction.show(details.tabId);
    // In Chrome|ium, listeners stay across page changes, in Firefox they don't. So check first.
    if (!browser.pageAction.onClicked.hasListener(handlePageAction))
      browser.pageAction.onClicked.addListener(handlePageAction);
  }
}

// Enable/Disable cinema mode when the pageAction button is clicked.
function handlePageAction(tab) {
  var matchEmbeddable = tab.url.match(embeddableUrlPattern);
  if (matchEmbeddable)
    tabsWithCinemaModeDisabled[tab.id] = true;
  else
    delete tabsWithCinemaModeDisabled[tab.id];

  // Relocate this page to reflect the new mode.
  var newUrl = makeNewUrl(tab.id, tab.url, true)
  if (newUrl)
    browser.tabs.update(tab.id, {url: newUrl});
}
