/**
 * Minimal local stand-in for the canvas editor's own support script.
 *
 * Every `*.dc.html` artboard references `./support.js`, but the file the canvas
 * published never made it into the repo — so opening a single artboard straight
 * from disk left `<x-dc>` and `<helmet>` as unknown inline elements and the
 * layout could come out subtly wrong.
 *
 * This does only what an artboard actually needs to render on its own: give the
 * two custom wrappers sane boxes, and keep the helmet (which holds a stylesheet
 * link and a style block, no visible content) out of the flow. The styles inside
 * it still apply — browsers honour <style> and <link> in the body.
 *
 * It deliberately does nothing else. If the real editor script turns up later it
 * can replace this file wholesale.
 */
(function () {
  var css =
    'x-dc{display:block}' +
    'helmet{display:none}' +
    /* Centre a lone artboard on the neutral canvas grey the artboards assume. */
    'body{margin:0;background:#E9E2DA;display:flex;justify-content:center;align-items:flex-start;padding:24px 0}';

  var style = document.createElement('style');
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);
})();
