/**
 * The one inline script the site runs before first paint. It is the first
 * thing in <body>, so it executes before any content is rendered and nothing
 * it changes causes a visible restyle.
 *
 * 1. Theme: resolves the visitor's saved choice (or the admin default) and
 *    sets the `dark` class. The server already renders that class for a dark
 *    default, so in the common case this writes nothing at all.
 * 2. Performance tier: marks low-memory devices and data-saver or 2G
 *    connections with `data-perf="low"`. CSS and the reveal controller use it
 *    to switch decorative motion and blur off. Never affects content or any
 *    unlock/payment flow.
 *
 *    The core count is only trusted together with `deviceMemory` (so, on
 *    Chromium/Android, where budget phones are). Safari reports at most 2
 *    cores on every iPhone as a privacy measure; reading that alone would
 *    have switched motion off for all iOS visitors.
 *
 * Kept dependency-free and ES5 so it runs in every in-app browser and old
 * WebView. Wrapped in try/catch: storage can throw in private mode.
 */
export function bootScript(defaultMode: "system" | "dark" | "light"): string {
  return `(function(){try{var d=document.documentElement,c=null;try{c=localStorage.getItem("theme")}catch(e){}
if(c!=="light"&&c!=="dark"&&c!=="system")c=${JSON.stringify(defaultMode)};
var k=c==="system"?(window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):c;
if((k==="dark")!==d.classList.contains("dark")){if(k==="dark")d.classList.add("dark");else d.classList.remove("dark")}
var n=navigator,o=n.connection||n.mozConnection||n.webkitConnection,low=false;
if(n.deviceMemory&&(n.deviceMemory<=2||(n.hardwareConcurrency&&n.hardwareConcurrency<=2)))low=true;
if(o&&(o.saveData||/(^|-)2g$/.test(o.effectiveType||"")))low=true;
if(low)d.setAttribute("data-perf","low");
}catch(e){}})();`;
}
