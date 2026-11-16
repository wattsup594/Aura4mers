/**
 * Lost & Found – Google Apps Script backend.
 *
 * Paste this into an Apps Script project (script.google.com or the Sheet's
 * Extensions > Apps Script) and deploy it as a Web App.
 * See apps-script/SETUP.md for step-by-step help.
 *
 *  - doPost: saves a "Report an Item" submission as a new row in the Sheet
 *            and saves the uploaded photo to the shared Drive folder.
 *  - doGet:  returns every reported item as JSON so the website can show
 *            the live Recent Items and Found Items lists.
 */

// ID of the shared Google Drive folder where item photos are saved.
// Open the folder in Drive and copy the long ID from the address bar:
// https://drive.google.com/drive/folders/THIS_PART_IS_THE_ID
const PHOTO_FOLDER_ID = "1SizkUDrvnKq-Bd4bcqj-WkqZBYY0SnbT";

// ID of the shared "Lost & Found Reports" Google Sheet, from its address:
// https://docs.google.com/spreadsheets/d/THIS_PART_IS_THE_ID/edit
const SPREADSHEET_ID = "1CBcSftdpPnUTvU9oTrZ95o6atfAI0BMtc5cDhUoHy_E";

// Name of the tab (sheet) inside the spreadsheet that stores reports.
const SHEET_NAME = "Reports";

const HEADERS = [
  "Timestamp",
  "ID",
  "Type",
  "Item Name",
  "Location",
  "Date",
  "Description",
  "Contact Email",
  "Photo URL",
];

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

/** Run this once from the editor to create the Reports tab and headers. */
function setup() {
  getSheet_();
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
  }

  return sheet;
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

// Stop values like "=IMPORTDATA(...)" from being treated as formulas.
function clean_(value, maxLength) {
  let text = String(value == null ? "" : value).trim().slice(0, maxLength);

  if (/^[=+\-@]/.test(text)) {
    text = "'" + text;
  }

  return text;
}

function savePhoto_(photo, itemName) {
  if (!photo || !photo.data) {
    return "";
  }

  if (ALLOWED_PHOTO_TYPES.indexOf(photo.type) === -1) {
    throw new Error("Photo must be a JPG, PNG, GIF, or WebP image.");
  }

  const bytes = Utilities.base64Decode(photo.data);

  if (bytes.length > MAX_PHOTO_BYTES) {
    throw new Error("Photo must be 5 MB or smaller.");
  }

  const safeName = String(itemName).replace(/[^\w\- ]+/g, "").slice(0, 40) || "item";
  const blob = Utilities.newBlob(bytes, photo.type, Date.now() + "-" + safeName);
  const file = DriveApp.getFolderById(PHOTO_FOLDER_ID).createFile(blob);

  // Let anyone with the link view the photo so the website can display it.
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w600";
}

/** Receives a new report from the website. */
function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    const body = JSON.parse(e.postData.contents);
    const type = body.type === "found" ? "found" : "lost";
    const name = clean_(body.name, 60);
    const location = clean_(body.location, 80);
    const date = clean_(body.date, 10);
    const description = clean_(body.description, 1000);
    const email = clean_(body.email, 120);

    if (!name || !location || !date || !description || !email) {
      return json_({ ok: false, error: "Please fill in every required field." });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json_({ ok: false, error: "Date must look like 2025-10-31." });
    }

    const photoUrl = savePhoto_(body.photo, body.name);
    const id = Utilities.getUuid();

    getSheet_().appendRow([
      new Date(),
      id,
      type,
      name,
      location,
      "'" + date, // Keep as plain text so it stays YYYY-MM-DD.
      description,
      email,
      photoUrl,
    ]);

    return json_({ ok: true, id: id });
  } catch (error) {
    return json_({ ok: false, error: String(error.message || error) });
  } finally {
    lock.releaseLock();
  }
}

/** Sends every report to the website, newest first. */
function doGet() {
  const rows = getSheet_().getDataRange().getDisplayValues().slice(1);

  const items = rows
    .filter((row) => row[1] && row[3])
    .map((row) => ({
      id: row[1],
      type: row[2] === "found" ? "found" : "lost",
      name: row[3],
      location: row[4],
      date: row[5],
      description: row[6],
      email: row[7],
      photo: row[8],
    }))
    .reverse();

  return json_({ ok: true, items: items });
}
