/**
 * Lost & Found – Google Apps Script backend.
 *
 * Paste this into an Apps Script project (script.google.com or the Sheet's
 * Extensions > Apps Script) and deploy it as a Web App.
 * See apps-script/SETUP.md for step-by-step help.
 *
 *  - doPost: saves a "Report an Item" submission as a new row in the Sheet,
 *            saves the uploaded photo to the shared Drive folder, and emails
 *            the reporter a private "Mark as returned" link.
 *            With action "contact" it forwards a visitor's message to the
 *            person who reported an item (their email is never shown on the
 *            website) and logs it in the Claims tab.
 *  - doGet:  returns reported items as JSON (without anyone's email) so the
 *            website can show the live lists. With action "returned" it marks
 *            an item as Reunited from the link in the reporter's email.
 *
 * After changing this file: Deploy → Manage deployments → Edit → Version:
 * New version → Deploy. The first time, Google asks you to allow the script
 * to send email as you.
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

// Tab that logs every message sent through the website's contact form.
const CLAIMS_SHEET_NAME = "Claims";

// The public website, used for links in emails.
const SITE_URL = "https://wattsup594.github.io/Aura4mers/";

// Reports older than this many days (by item date) stop showing on the site,
// unless they were reunited. The rows stay in the Sheet.
const EXPIRE_DAYS = 30;

// Bumped when the website needs features from this script.
const API_VERSION = 2;

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
  "Status", // "Reunited" once returned (set by the email link, or by hand).
  "Edit Token", // Private; lets the reporter mark the item returned.
];

const CLAIM_HEADERS = [
  "Timestamp",
  "Item ID",
  "Item Name",
  "Item Type",
  "Sender Name",
  "Sender Email",
  "Message",
  "Detail",
];

// Column numbers (1-based) in the Reports tab.
const COL = { id: 2, type: 3, name: 4, location: 5, date: 6, email: 8, status: 10, token: 11 };

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

/** Run this once from the editor to create the Reports tab and headers. */
function setup() {
  getSheet_();
}

function getSheet_() {
  return getTab_(SHEET_NAME, HEADERS);
}

function getClaimsSheet_() {
  return getTab_(CLAIMS_SHEET_NAME, CLAIM_HEADERS);
}

function getTab_(name, headers) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(name);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  } else {
    // Add any header the tab is missing (e.g. "Edit Token" on older sheets).
    const current = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    headers.forEach((header, i) => {
      if (!current[i]) {
        sheet.getRange(1, i + 1).setValue(header);
      }
    });
  }

  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  return sheet;
}

// Find the Reports row (1-based) for an item ID, or -1.
function findRow_(sheet, id) {
  if (!id) {
    return -1;
  }

  const ids = sheet.getRange(2, COL.id, Math.max(sheet.getLastRow() - 1, 1), 1).getDisplayValues();

  for (let i = 0; i < ids.length; i += 1) {
    if (ids[i][0] === id) {
      return i + 2;
    }
  }

  return -1;
}

function isEmail_(text) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}

function returnedLink_(id, token) {
  return ScriptApp.getService().getUrl() +
    "?action=returned&id=" + encodeURIComponent(id) +
    "&token=" + encodeURIComponent(token);
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

    // Bots fill in the hidden "website" field; real people never see it.
    if (body.website) {
      return json_({ ok: true });
    }

    if (body.action === "contact") {
      return json_(sendContact_(body));
    }

    const type = body.type === "found" ? "found" : "lost";
    const name = clean_(body.name, 60);
    const location = clean_(body.location, 80);
    const date = clean_(body.date, 10);
    const description = clean_(body.description, 1000);
    const email = clean_(body.email, 120);

    if (!name || !location || !date || !description || !email) {
      return json_({ ok: false, error: "Please fill in every required field." });
    }

    if (!isEmail_(email)) {
      return json_({ ok: false, error: "Please enter a valid email address." });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json_({ ok: false, error: "Date must look like 2025-10-31." });
    }

    const photoUrl = savePhoto_(body.photo, body.name);
    const id = Utilities.getUuid();
    const token = Utilities.getUuid().replace(/-/g, "");

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
      "",
      token,
    ]);

    sendReportConfirmation_(email, { id, type, name, location, date }, token);

    return json_({ ok: true, id: id });
  } catch (error) {
    return json_({ ok: false, error: String(error.message || error) });
  } finally {
    lock.releaseLock();
  }
}

/** Emails the reporter a copy of their report and the private return link. */
function sendReportConfirmation_(email, item, token) {
  try {
    const kind = item.type === "found" ? "found" : "lost";
    MailApp.sendEmail({
      to: email,
      name: "Lost & Found",
      subject: "Your " + kind + " item report: " + item.name,
      body: [
        "Thanks for reporting a " + kind + " item on Lost & Found.",
        "",
        "Item: " + item.name,
        "Where: " + item.location,
        "Date: " + item.date,
        "",
        "Your email is not shown on the website. When someone writes about this item,",
        "their message comes to this inbox and you can reply to them directly.",
        "",
        "Once the item is back with its owner, click this private link to mark it returned:",
        returnedLink_(item.id, token),
        "",
        "Don't share that link: anyone who has it can mark the item returned.",
        "",
        "Lost & Found",
        SITE_URL,
      ].join("\n"),
    });
  } catch (error) {
    // The report is saved even if the email can't be sent (e.g. daily quota).
    console.warn("Confirmation email failed: " + error);
  }
}

/** Forwards a website visitor's message to the person who reported an item. */
function sendContact_(body) {
  const itemId = clean_(body.itemId, 60);
  const senderName = clean_(body.name, 60);
  const senderEmail = clean_(body.email, 120);
  const message = clean_(body.message, 1500);
  const detail = clean_(body.detail, 500);

  if (!itemId || !senderName || !senderEmail || !message || !detail) {
    return { ok: false, error: "Please fill in every required field." };
  }

  if (!isEmail_(senderEmail)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  // Simple flood protection: one message per sender per item every 2 minutes.
  const cache = CacheService.getScriptCache();
  const cacheKey = "c_" + Utilities.base64EncodeWebSafe(senderEmail.toLowerCase() + "|" + itemId).slice(0, 200);
  if (cache.get(cacheKey)) {
    return { ok: false, error: "You just sent a message about this item. Please wait a couple of minutes." };
  }

  const sheet = getSheet_();
  const row = findRow_(sheet, itemId);
  if (row === -1) {
    return { ok: false, error: "That item could not be found. It may have been removed." };
  }

  const values = sheet.getRange(row, 1, 1, COL.token).getDisplayValues()[0];
  const item = {
    type: values[COL.type - 1] === "found" ? "found" : "lost",
    name: values[COL.name - 1],
    location: values[COL.location - 1],
    date: values[COL.date - 1],
    reporter: values[COL.email - 1],
    status: String(values[COL.status - 1] || "").trim().toLowerCase(),
  };

  if (item.status === "reunited") {
    return { ok: false, error: "This item has already been returned to its owner." };
  }

  if (!isEmail_(item.reporter)) {
    return { ok: false, error: "No contact email was left for this item." };
  }

  const isClaim = item.type === "found";
  const subject = isClaim
    ? senderName + " says the " + item.name + " you found is theirs"
    : senderName + " may have found your " + item.name;

  MailApp.sendEmail({
    to: item.reporter,
    replyTo: senderEmail,
    name: "Lost & Found",
    subject: subject + " (Lost & Found)",
    body: [
      isClaim
        ? "Someone thinks the item you reported as found belongs to them."
        : "Someone may have found the item you reported as lost.",
      "",
      "Item: " + item.name + " (" + item.location + ", " + item.date + ")",
      "From: " + senderName + " <" + senderEmail + ">",
      "",
      isClaim ? "Detail they gave to prove it's theirs:" : "Where they found it:",
      detail,
      "",
      "Their message:",
      message,
      "",
      isClaim
        ? "Check that detail against the item before handing it over."
        : "Make sure the item really is yours before you meet.",
      "Meet somewhere public on campus, or leave it at a staffed front desk.",
      "",
      "Just reply to this email to answer " + senderName + ".",
      "Your email address was not shown on the website.",
      "",
      "Lost & Found",
      SITE_URL,
    ].join("\n"),
  });

  getClaimsSheet_().appendRow([
    new Date(),
    itemId,
    item.name,
    item.type,
    senderName,
    senderEmail,
    message,
    detail,
  ]);

  cache.put(cacheKey, "1", 120);
  return { ok: true };
}

/** Marks an item Reunited from the reporter's private link. */
function markReturned_(id, token) {
  const sheet = getSheet_();
  const row = findRow_(sheet, id);
  const saved = row === -1 ? "" : sheet.getRange(row, COL.token).getDisplayValue();

  if (row === -1 || !token || saved !== token) {
    return page_("Link not recognised", "This link doesn't match any report. It may have been copied incompletely.");
  }

  sheet.getRange(row, COL.status).setValue("Reunited");
  const name = sheet.getRange(row, COL.name).getDisplayValue();
  return page_("Marked as returned 🎉", "\"" + name + "\" now shows as Reunited on the website. Thanks for helping!");
}

function page_(title, message) {
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const html =
    '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">' +
    "<title>" + esc(title) + "</title></head>" +
    '<body style="font-family:system-ui,sans-serif;max-width:480px;margin:15vh auto;padding:0 20px;text-align:center;color:#263946">' +
    "<h1>" + esc(title) + "</h1><p>" + esc(message) + "</p>" +
    '<p><a href="' + SITE_URL + '" target="_top" style="color:#416f63;font-weight:bold">Back to Lost &amp; Found</a></p>' +
    "</body></html>";
  return HtmlService.createHtmlOutput(html).setTitle(title);
}

/** Sends reports to the website, newest first. Emails are never included. */
function doGet(e) {
  const params = (e && e.parameter) || {};

  if (params.action === "returned") {
    return markReturned_(String(params.id || ""), String(params.token || ""));
  }

  const rows = getSheet_().getDataRange().getDisplayValues().slice(1);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - EXPIRE_DAYS);
  const cutoffText = Utilities.formatDate(cutoff, Session.getScriptTimeZone(), "yyyy-MM-dd");

  const items = rows
    .filter((row) => row[1] && row[3])
    .filter((row) => {
      const reunited = String(row[9] || "").trim().toLowerCase() === "reunited";
      return reunited || !row[5] || row[5] >= cutoffText;
    })
    .map((row) => ({
      id: row[1],
      type: row[2] === "found" ? "found" : "lost",
      name: row[3],
      location: row[4],
      date: row[5],
      description: row[6],
      hasContact: isEmail_(String(row[7] || "").trim()),
      photo: row[8],
      status: row[9] || "",
    }))
    .reverse();

  return json_({ ok: true, apiVersion: API_VERSION, items: items });
}
