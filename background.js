// Be compatible with Chrome|ium. We do not need the full webextension-polyfill.
if (typeof browser === 'undefined') {
  this.browser = chrome
};

var urlPattern = /^(https?):\/\/(?:.+\.)youtube\.com\/watch\?.*v=([^&#]+)/;

function onBeforeRequestListener(details) {
  var match = details.url.match(urlPattern);
  var scheme = match[1];
  var videoId = match[2];
  if (scheme && videoId) {
    // Watch the embedded version instead. And without related video suggestions!
    var newUrl = scheme + '://www.youtube.com/embed/' + videoId + '?rel=0&autoplay=1';

    // From the embed, one should be able to follow the "watch on YouTube" link
    if (newUrl === details.originUrl)
      return

    return {redirectUrl: newUrl};
  }
}

browser.webRequest.onBeforeRequest.addListener(
  onBeforeRequestListener,
  {urls: ["*://*.youtube.com/watch*"]},
  ['blocking']
);
