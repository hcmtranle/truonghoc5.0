/** Trường học 5.0 — bản xem thử giao diện. */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Trường học 5.0 · Tổ chuyên môn 4')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
