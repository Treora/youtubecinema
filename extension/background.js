// Be compatible with Chrome|ium. We do not need the full webextension-polyfill.
if (typeof browser === 'undefined') {
  this.browser = chrome;
}

// Keep a set of tabIds for which the user disabled the cinema mode (with the pageAction button)
var tabsWithCinemaModeDisabled = {};

function hasCinemaModeEnabled(tabId) {
  return !tabsWithCinemaModeDisabled[tabId];
}

function appearsToHaveCinemaModeEnabled(tabId, url) {
  return (
    hasCinemaModeEnabled(tabId)
    // When viewing an embedded video with cinema mode disabled, behave as if it was enabled.
    || isEmbeddedVideo(url)
  );
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

function timeStringToSeconds(t) {
  // If t is an integer, it indicates the number of seconds.
  if (/^\d+$/.test(t)) {
    return t;
  }
  // If t looks like e.g. 1h20m30s, convert to seconds.
  match = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/)
  if (match) {
    var seconds = (
      (Number(match[3]) || 0)
      + (Number(match[2]) || 0) * 60
      + (Number(match[1]) || 0) * 3600
    )
    return seconds.toString();
  }
  // No idea. Let's just return it.
  return t
}

function cruftedToEmbeddableVideoUrl(url) {
  url = new URL(url);
  // Move the video's id into the path
  var videoId = url.searchParams.get('v');
  url.pathname = '/embed/' + videoId;
  url.searchParams.delete('v');
  // Rename start time parameter if present, converting to seconds if needed.
  var startTime = url.searchParams.get('t');
  if (startTime !== null) {
    url.searchParams.set('start', timeStringToSeconds(startTime))
    url.searchParams.delete('t')
  }
  // Tweak some other settings for pleasant viewing. See API docs: https://developers.google.com/youtube/player_parameters
  url.searchParams.set('rel', '0'); // no suggestions after my video, please.
  url.searchParams.set('iv_load_policy', '3'); // no video annotations, thanks.
  url.searchParams.set('modestbranding', '1'); // no YouTube branding either.
  url.searchParams.set('autoplay', '1'); // do play my video! :)
  return url.href;
}

function embeddableToCruftedVideoUrl(url) {
  url = new URL(url);
  // Move the video's id into the query parameters.
  var videoId = url.pathname.match(/\/embed\/(.*)/)[1];
  url.pathname = '/watch';
  url.searchParams.set('v', videoId);
  // Rename start time parameter if present.
  var startTime = url.searchParams.get('start');
  if (startTime !== null) {
    url.searchParams.set('t', startTime)
    url.searchParams.delete('start')
  }
  // Remove added settings specific to embedded videos.
  url.searchParams.delete('rel');
  url.searchParams.delete('modestbranding');
  url.searchParams.delete('iv_load_policy');
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
    setIconActive(details.tabId, appearsToHaveCinemaModeEnabled(details.tabId, details.url))

    // In Chrome|ium, listeners stay across page changes, in Firefox they don't. So check first.
    if (!browser.pageAction.onClicked.hasListener(handlePageAction))
      browser.pageAction.onClicked.addListener(handlePageAction);
  }
}

// Enable/Disable cinema mode when the pageAction button is clicked.
function handlePageAction(tab) {
  var enable = !appearsToHaveCinemaModeEnabled(tab.id, tab.url)
  if (enable) {
    delete tabsWithCinemaModeDisabled[tab.id];
  } else {
    tabsWithCinemaModeDisabled[tab.id] = true;
  }

  setIconActive(tab.id, enable);

  // Relocate this page to reflect the new mode.
  var newUrl = makeNewUrl(tab.url, hasCinemaModeEnabled(tab.id));
  if (newUrl)
    browser.tabs.update(tab.id, {url: newUrl});
}


var activeIcons = {
  '19': '/img/icon_active/19.png',
  '38': '/img/icon_active/38.png',
  '48': '/img/icon_active/48.png',
  '96': '/img/icon_active/96.png',
  '128': '/img/icon_active/128.png',
}
var inactiveIcons = {
  '19': '/img/icon_inactive/19.png',
  '38': '/img/icon_inactive/38.png',
  '48': '/img/icon_inactive/48.png',
  '96': '/img/icon_inactive/96.png',
  '128': '/img/icon_inactive/128.png',
}

function setIconActive(tabId, active) {
  browser.pageAction.setIcon({
    tabId: tabId,
    path: active ? activeIcons : inactiveIcons,
  })
}
