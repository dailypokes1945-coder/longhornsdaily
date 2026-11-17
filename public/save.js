// "Save Longhorns Daily" button: one-tap install where the browser allows it
// (Android Chrome, desktop Chrome/Edge), otherwise a short how-to tip
// (iPhone Share menu, Android menu, or Ctrl/Cmd+D on computers).
(function () {
  var btn = document.getElementById("save-btn");
  var tip = document.getElementById("save-tip");
  var tipText = document.getElementById("save-tip-text");
  var close = document.getElementById("save-tip-close");
  if (!btn || !tip) return;

  var installPrompt = null;

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  }

  // Opened from the home screen already: no need for the button.
  var standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
                   window.navigator.standalone === true;
  if (standalone) return;
  btn.hidden = false;

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    installPrompt = e;
  });
  window.addEventListener("appinstalled", function () { btn.hidden = true; tip.hidden = true; });

  var timer;
  function showTip(html) {
    tipText.innerHTML = html;
    tip.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(function () { tip.hidden = true; }, 10000);
  }
  close.addEventListener("click", function () { tip.hidden = true; });

  btn.addEventListener("click", function () {
    if (installPrompt) {
      installPrompt.prompt();
      installPrompt.userChoice.finally(function () { installPrompt = null; });
      return;
    }
    var ua = navigator.userAgent;
    var isIOS = /iPhone|iPad|iPod/.test(ua) ||
                (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    var isAndroid = /Android/.test(ua);
    var isMac = /Mac/.test(navigator.platform);
    if (isIOS) {
      showTip("Tap <b>Share</b> <b>&#x2B06;&#xFE0E;</b> at the bottom of Safari, then <b>Add to Home Screen</b>.");
    } else if (isAndroid) {
      showTip("Tap the <b>&#8942; menu</b> in your browser, then <b>Add to Home screen</b>.");
    } else {
      showTip("Press <b>" + (isMac ? "&#8984; + D" : "Ctrl + D") + "</b> to bookmark Longhorns Daily.");
    }
  });
})();
