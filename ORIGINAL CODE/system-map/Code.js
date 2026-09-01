/**
 * VCB System Operating Map — Google Apps Script web app
 * Serves the self-contained interactive HTML map as a web page.
 *
 * Setup: this project needs ONE HTML file named exactly "Index"
 * containing the full contents of VCB_System_Map_v8.51.html.
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('VCB System Operating Map')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
