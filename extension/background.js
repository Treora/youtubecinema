// Be compatible with Chrome|ium. We do not need the full webextension-polyfill.
if (typeof browser === 'undefined') {
  this.browser = chrome;
}

// Keep a set of tabIds for which the user disabled the cinema mode (with the pageAction button)
var tabsWithCinemaModeDisabled = {};

function hasCinemaModeEnabled(tabId) {
  return !tabsWithCinemaModeDisabled[tabId];
}

// Our request filters should make use of this test unnecessary, but I prefer to keep it explicit.
function isYoutube(url) {
  return new URL(url).hostname.endsWith('.youtube.com');
}

function isEmbeddedVideo(url) {
  return (
    isYoutube(url)
    && new URL(url).pathname.startsWith('/embed/')
  );
}

function isCruftedVideo(url) {
  return (
    isYoutube(url)
    && new URL(url).pathname === '/watch'
  );
}

function cruftedToEmbeddableVideoUrl(url) {
  url = new URL(url);
  var videoId = url.searchParams.get('v');
  url.pathname = '/embed/' + videoId;
  url.searchParams.delete('v');
  url.searchParams.set('rel', '0'); // no suggestions after my video, please.
  url.searchParams.set('autoplay', '1');
  return url.href;
}

function embeddableToCruftedVideoUrl(url) {
  url = new URL(url);
  var videoId = url.pathname.match(/\/embed\/(.*)/)[1];
  url.pathname = '/watch';
  url.searchParams.set('v', videoId);
  url.searchParams.delete('rel');
  url.searchParams.delete('autoplay');
  return url.href;
}

// Turn a video url into its embeddable (full-window) version, or vice versa if not in cinema mode.
function makeNewUrl(url, cinemaModeEnabled) {
  if (cinemaModeEnabled) {
    if (isCruftedVideo(url)) {
      return cruftedToEmbeddableVideoUrl(url);
    }
  }
  else {
    if (isEmbeddedVideo(url)) {
      return embeddableToCruftedVideoUrl(url);
    }
  }
  return undefined;
}


// Redirect crufted videos to their full-window version.
function onBeforeRequestListener(details) {
  if (hasCinemaModeEnabled(details.tabId)) {
    var newUrl = makeNewUrl(details.url, true);

    // Return if we were not visiting a embedded youtube video
    if (newUrl === undefined) return;

    return {redirectUrl: newUrl};
  }
}

browser.webRequest.onBeforeRequest.addListener(
  onBeforeRequestListener,
  {urls: ["*://*.youtube.com/watch*"]},
  ['blocking']
);


// Show the pageAction button if looking at a video (either with or without cruft).
var youtubeUrlFilter = {url: [{hostSuffix: '.youtube.com'}]}
browser.webNavigation.onCommitted.addListener(handleNavigation, youtubeUrlFilter);
browser.webNavigation.onHistoryStateUpdated.addListener(handleNavigation, youtubeUrlFilter);

function handleNavigation(details) {
  if (details.frameId !== 0) {
    return;
  }

  // If we are on youtube, show the button.
  if (isYoutube(details.url)) {
    // Show the pageAction button.
    browser.pageAction.show(details.tabId);
    // In Chrome|ium, listeners stay across page changes, in Firefox they don't. So check first.
    if (!browser.pageAction.onClicked.hasListener(handlePageAction))
      browser.pageAction.onClicked.addListener(handlePageAction);
  }
}

// Enable/Disable cinema mode when the pageAction button is clicked.
function handlePageAction(tab) {
  if (
    hasCinemaModeEnabled(tab.id)
    // When viewing an embedded video with cinema mode disabled, behave as if it was enabled.
    || isEmbeddedVideo(tab.url)
  ) {
    // Disable cinema mode.
    tabsWithCinemaModeDisabled[tab.id] = true;
  } else {
    // Enable cinema mode.
    delete tabsWithCinemaModeDisabled[tab.id];
  }

  // Relocate this page to reflect the new mode.
  var newUrl = makeNewUrl(tab.url, hasCinemaModeEnabled(tab.id));
  if (newUrl)
    browser.tabs.update(tab.id, {url: newUrl});
}