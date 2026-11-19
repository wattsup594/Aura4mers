# Connecting the "Report an Item" form to the shared Google Sheet

The website's report form sends each submission to a small Google Apps Script.
The script adds a row to the shared Sheet and saves the photo to the shared
Drive folder. The website reads the same Sheet to show the live
**Recent Items** and **Found Items** lists.

Until these steps are done, the site still works but saves reports only in
the visitor's own browser.

## Where things are (already set up)
- Drive folder **Lost & Found (Aura4mers)** contains:
  - Sheet **Lost & Found Reports** (tab `Reports`, with headers)
  - Folder **Lost Item Photos** (uploaded photos are saved here)
- Apps Script project **Lost & Found Reports API** (script.google.com, owned
  by Chris Titus) holds [`Code.gs`](Code.gs). It points at the Sheet and
  photo folder by ID (`SPREADSHEET_ID` and `PHOTO_FOLDER_ID` at the top).

To move to a different Sheet or folder, change those two IDs in the script.

## 1. Authorize the script (one time)
1. Open the **Lost & Found Reports API** project on script.google.com.
2. In the function dropdown at the top, pick **`setup`** and click **Run**.
3. Google asks you to review permissions: choose your account and allow
   access to Sheets and Drive. If you see "Google hasn't verified this app",
   click **Advanced → Go to Lost & Found Reports API**. This is normal for
   your own scripts.

## 2. Deploy it as a Web App
1. Click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Click **Deploy**, and copy the **Web app URL** (it ends in `/exec`).

## 3. Put the URL in the website
Open `script.js` and paste the URL into the line near the top:

```js
const SHEET_API_URL = "https://script.google.com/macros/s/XXXX/exec";
```

Commit and push. GitHub Pages republishes the site automatically.

## Changing the script later
If you edit `Code.gs` in Apps Script, use **Deploy → Manage deployments →
Edit (pencil) → Version: New version → Deploy**. This keeps the same URL, so
`script.js` does not need to change.

## What gets stored
| Column | Example |
|---|---|
| Timestamp | 11/16/2026 10:42:00 |
| ID | (random unique ID) |
| Type | lost / found |
| Item Name | Black Backpack |
| Location | Student Center |
| Date | 2026-11-15 |
| Description | Black backpack with multiple pockets |
| Contact Email | someone@example.com |
| Photo URL | link to the photo in the shared Drive folder |

Note: the contact email is shown on the website when someone clicks an item
(the same as before), so remind testers to use fake emails.

## Marking items as reunited (optional)

When an item gets back to its owner, open the Sheet and type `reunited` in the
**Status** column (column J) of that item's row. If your Sheet doesn't have
that column yet, add the header `Status` in cell J1. Nothing else in the Sheet
needs to change, and existing rows are kept as they are.

The website then shows a "REUNITED" stamp on the card and counts it in the
Reunited stat. After updating `Code.gs`, redeploy the Web App
(**Deploy → Manage deployments → Edit → New version**) and keep the same URL.

## Private messages and "Mark as returned" links (script version 2)
`Code.gs` now:
- **Hides every email address** from the website. Visitors use a short form on
  the item instead; the script emails their message to the person who reported
  the item, with *Reply-To* set to the visitor, and logs it in a **Claims** tab.
- **Emails each new reporter** a copy of their report with a private
  *Mark as returned* link. Clicking it sets **Status** to `Reunited`.
- **Hides reports older than 30 days** (by item date) unless they were reunited.
  Change `EXPIRE_DAYS` to adjust. Rows are never deleted.
- Adds an **Edit Token** column (K) to Reports. Leave it alone; it's what makes
  the private link work. Older rows have no token, so mark those by typing
  `Reunited` in Status.

To switch it on:
1. Open the Apps Script project, replace all of `Code.gs` with this file, Save.
2. **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy.**
3. Google asks for permission to **send email as you**: allow it.

The website notices the new version automatically (`apiVersion: 2`); until
then it keeps showing the email button. Gmail accounts can send about 100
emails a day through Apps Script.
