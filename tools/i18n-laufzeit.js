/* wird von tools/englisch.py in assets/js/i18n-en.js eingebettet; T = Wörterbuch, M = Muster */
var ATTR = ["title", "aria-label", "placeholder", "alt", "aria-roledescription", "data-label", "data-cursor"];
var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1, NOSCRIPT: 1 };
function norm(s) { return s.replace(/\s+/g, " ").trim(); }
function one(k) {
  if (Object.prototype.hasOwnProperty.call(T, k)) return T[k];
  for (var i = 0; i < M.length; i++) { if (M[i][0].test(k)) return k.replace(M[i][0], M[i][1]); }
  return null;
}
function tr(s) {
  var k = norm(s);
  if (!k || !/[A-Za-zÄÖÜäöü]/.test(k)) return null;
  var r = one(k);
  if (r !== null) return r;
  if (k.indexOf(" · ") > -1) {           /* zusammengesetzte Angaben: «Projekte · Lernen» */
    var parts = k.split(" · "), out = [], hit = false;
    for (var i = 0; i < parts.length; i++) {
      var t = /[A-Za-zÄÖÜäöü]/.test(parts[i]) ? one(parts[i]) : parts[i];
      if (t === null) t = parts[i]; else if (t !== parts[i]) hit = true;
      out.push(t);
    }
    if (hit) return out.join(" · ");
  }
  return null;
}
function textNode(n) {
  var v = n.nodeValue, r = tr(v);
  if (r === null || r === norm(v)) return;
  n.nodeValue = (/^\s/.test(v) ? " " : "") + r + (/\s$/.test(v) ? " " : "");
}
function attrs(el) {
  for (var i = 0; i < ATTR.length; i++) {
    var v = el.getAttribute && el.getAttribute(ATTR[i]);
    if (v) { var r = tr(v); if (r !== null && r !== v) el.setAttribute(ATTR[i], r); }
  }
}
function walk(root) {
  if (root.nodeType === 3) { if (root.parentNode && !SKIP[root.parentNode.nodeName]) textNode(root); return; }
  if (root.nodeType !== 1 || SKIP[root.nodeName] || (root.closest && root.closest("[data-no-i18n]"))) return;
  attrs(root);
  var w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: function (n) { return n.nodeType === 1 && (SKIP[n.nodeName] || n.hasAttribute("data-no-i18n")) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
  });
  var n; while ((n = w.nextNode())) { if (n.nodeType === 3) textNode(n); else attrs(n); }
}
var busy = false;
var mo = new MutationObserver(function (list) {
  if (busy) return; busy = true;
  for (var i = 0; i < list.length; i++) {
    var m = list[i];
    if (m.type === "childList") for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
    else if (m.type === "characterData") { if (m.target.parentNode && !SKIP[m.target.parentNode.nodeName]) textNode(m.target); }
    else if (m.type === "attributes") attrs(m.target);
  }
  busy = false;
});
function start() { walk(document.body); mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTR }); }
window.APB_T = function (s) { var r = tr(s); return r === null ? s : r; };
if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
