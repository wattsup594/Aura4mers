"use strict";

// Web App URL of the Google Apps Script connected to the shared Sheet.
// See apps-script/SETUP.md. Leave empty to save reports in this browser only.
const SHEET_API_URL = "https://script.google.com/macros/s/AKfycbyEnxV2kB4BlRmVeiQhcTMMSuoMCffwll8hopLIiCQGjp4GcjqJA8oEBe6JIEK0Bu0/exec";

// How often the item lists check the Sheet for new reports (milliseconds).
const REFRESH_INTERVAL = 30000;

// Photo limits for the report form.
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB after resizing
const MAX_PHOTO_SIDE = 1600; // pixels
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// Store reports in the browser when the Sheet is not connected.
const STORAGE_KEY = "lost-found-reports-v1";

const useSheet = SHEET_API_URL !== "";

// Items loaded from the shared Sheet (null until the first load finishes).
let sheetItems = null;
let sheetError = false;
// 2+ means the Sheet script relays messages privately (no emails on the site).
let sheetApiVersion = 1;

// Sample items shown only when the Sheet is not connected.
const defaultItems = [
  {
    id: "demo-1",
    name: "Black Backpack",
    type: "found",
    date: "2025-10-10",
    location: "Student Center",
    description: "Black backpack with multiple pockets.",
    icon: "🎒",
    email: "",
  },
  {
    id: "demo-2",
    name: "iPhone 14",
    type: "lost",
    date: "2025-10-09",
    location: "Library",
    description: "Phone with a dark case.",
    icon: "📱",
    email: "",
  },
  {
    id: "demo-3",
    name: "Blue Water Bottle",
    type: "found",
    date: "2025-10-08",
    location: "Dining Hall",
    description: "Reusable blue water bottle.",
    icon: "🧴",
    email: "",
  },
  {
    id: "demo-4",
    name: "Keys",
    type: "lost",
    date: "2025-10-07",
    location: "Parking Lot",
    description: "Small keyring lost near the parking lot.",
    icon: "🔑",
    email: "",
  },
];

// Small inline SVG icons (Lucide-style outlines) used by the script.
const ICON_PATHS = {
  "pin": "<path d=\"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0\"/><circle cx=\"12\" cy=\"10\" r=\"3\"/>",
  "moon": "<path d=\"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z\"/>",
  "sun": "<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2\"/><path d=\"M12 20v2\"/><path d=\"m4.93 4.93 1.41 1.41\"/><path d=\"m17.66 17.66 1.41 1.41\"/><path d=\"M2 12h2\"/><path d=\"M20 12h2\"/><path d=\"m6.34 17.66-1.41 1.41\"/><path d=\"m19.07 4.93-1.41 1.41\"/>"
};

function svgIcon(name, className) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.75");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", className || "icon");
  // Paths are fixed strings defined above, never user data.
  svg.innerHTML = ICON_PATHS[name] || "";
  return svg;
}

// Get reports previously saved in this browser.
function savedReports() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    return [];
  }
}

// All items to display, newest reports first.
function allItems() {
  const items = useSheet
    ? sheetItems || []
    : [...savedReports().reverse(), ...defaultItems];

  // Newest date first, whatever order the Sheet rows are in.
  return [...items].sort((a, b) =>
    String(b.date || "").localeCompare(String(a.date || "")),
  );
}

// Load the latest reports from the shared Sheet.
async function loadSheetItems() {
  if (!useSheet) {
    return;
  }

  try {
    const response = await fetch(SHEET_API_URL);
    const result = await response.json();

    if (!result.ok || !Array.isArray(result.items)) {
      throw new Error(result.error || "Bad response");
    }

    sheetItems = result.items;
    sheetApiVersion = Number(result.apiVersion) || 1;
    sheetError = false;
  } catch (error) {
    sheetError = true;
  }

  renderItems();
  renderFoundItems();
}

// Text for the item counters while loading or after an error.
function countLabel(count, noun) {
  if (useSheet && sheetItems === null) {
    return sheetError ? "Could not load items" : "Loading items…";
  }

  // "1 item" / "2 items"
  return count + " " + (count === 1 ? noun.replace(/s$/, "") : noun);
}

// Choose an icon based on the item name.
function itemIcon(name) {
  const lower = name.toLowerCase();

  if (lower.includes("backpack") || lower.includes("bag")) {
    return "🎒";
  }

  // Check "headphone" before "phone" so headphones get the right icon.
  if (lower.includes("headphone") || lower.includes("earbud")) {
    return "🎧";
  }

  if (lower.includes("phone")) {
    return "📱";
  }

  if (lower.includes("glasses") || lower.includes("sunglass")) {
    return "👓";
  }

  if (lower.includes("umbrella")) {
    return "☂️";
  }

  if (lower.includes("notebook") || lower.includes("book")) {
    return "📓";
  }

  if (lower.includes("scarf")) {
    return "🧣";
  }

  if (lower.includes("cup") || lower.includes("mug")) {
    return "🥤";
  }

  if (lower.includes("purse")) {
    return "👛";
  }

  if (lower.includes("laptop")) {
    return "💻";
  }

  if (lower.includes("jacket") || lower.includes("coat")) {
    return "🧥";
  }

  if (lower.includes("key")) {
    return "🔑";
  }

  if (lower.includes("bottle")) {
    return "🧴";
  }

  if (lower.includes("wallet")) {
    return "👛";
  }

  if (lower.includes("headphone")) {
    return "🎧";
  }

  return "📦";
}

// Only show photos from the shared Drive folder or saved in this browser.
function safePhotoUrl(url) {
  if (typeof url !== "string") {
    return "";
  }

  if (
    url.startsWith("https://drive.google.com/") ||
    url.startsWith("data:image/")
  ) {
    return url;
  }

  return "";
}

// Format dates for display.
function formatDate(value) {
  const date = new Date(value + "T12:00:00");

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Words used by the search boxes.
function searchText(item) {
  return (
    item.name +
    " " +
    item.location +
    " " +
    item.description
  ).toLowerCase();
}

// Create the Recent Items cards on the homepage.
function renderItems() {
  const grid = document.querySelector("#item-grid");

  // Only the homepage has an item grid.
  if (!grid) {
    return;
  }

  const query = document
    .querySelector("#search-items")
    .value.trim()
    .toLowerCase();

  const type = document.querySelector("#filter-type").value;

  const filteredItems = allItems().filter((item) => {
    const matchesType = type === "all" || item.type === type;
    const matchesBuilding =
      !activeBuilding || buildingName(item.location) === activeBuilding;

    return matchesType && matchesBuilding && searchText(item).includes(query);
  });

  // Clear previous cards.
  grid.replaceChildren();

  document.querySelector("#item-count").textContent =
    useSheet && sheetItems === null
      ? countLabel(0, "items")
      : String(filteredItems.length);

  document.querySelector("#empty-state").hidden =
    filteredItems.length > 0 || (useSheet && sheetItems === null);

  // Show placeholder cards while the Sheet is loading.
  if (useSheet && sheetItems === null && !sheetError) {
    grid.append(...skeletonCards(4));
  }

  // Create a card for each item.
  filteredItems.forEach((item) => {
    grid.append(createItemCard(item));
  });

  renderCampusMap();
  updateStats();
  renderTicker();
  renderLens();
}

// Hero: a magnifying glass sweeps over scattered items; whatever is under
// the lens comes into focus with a "Found!" tag. Follows the mouse on hover.
const LENS_SPOTS = [
  [14, 24], [46, 18], [80, 24], [26, 52], [62, 46], [88, 58], [12, 82], [44, 80], [74, 86],
];

function renderLens() {
  const scene = document.querySelector("#lens-scene");
  const holder = document.querySelector("#lens-items");

  if (!scene || !holder || scene.dataset.ready) {
    return;
  }

  const latest = allItems().slice(0, LENS_SPOTS.length);
  if (latest.length === 0) {
    return;
  }
  scene.dataset.ready = "1";

  const nodes = latest.map((item, i) => {
    const el = document.createElement("span");
    el.className = "lens-item";
    el.style.left = LENS_SPOTS[i][0] + "%";
    el.style.top = LENS_SPOTS[i][1] + "%";
    el.style.setProperty("--float", (i * 0.4).toFixed(1) + "s");

    const art = document.createElement("span");
    art.className = "lens-emoji";
    art.textContent = item.icon || itemIcon(item.name);

    const tag = document.createElement("span");
    tag.className = "lens-tag " + item.type;
    tag.textContent = (item.type === "found" ? "Found! " : "Lost: ") + item.name;

    el.append(art, tag);
    holder.append(el);
    return el;
  });

  const lens = document.querySelector("#lens");
  let target = null;
  let pos = { x: 0.5, y: 0.5 };
  let t = 0;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  scene.addEventListener("pointermove", (e) => {
    const r = scene.getBoundingClientRect();
    target = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  });
  scene.addEventListener("pointerleave", () => { target = null; });

  function frame() {
    t += 0.006;
    // Wandering figure-eight path when the mouse isn't steering.
    const auto = { x: 0.5 + Math.sin(t * 1.3) * 0.36, y: 0.52 + Math.sin(t * 2.1) * 0.3 };
    const goal = target || auto;
    pos.x += (goal.x - pos.x) * (target ? 0.18 : 0.06);
    pos.y += (goal.y - pos.y) * (target ? 0.18 : 0.06);

    const r = scene.getBoundingClientRect();
    const lx = pos.x * r.width;
    const ly = pos.y * r.height;
    lens.style.transform = `translate(${lx}px, ${ly}px)`;

    nodes.forEach((n) => {
      const nx = (parseFloat(n.style.left) / 100) * r.width;
      const ny = (parseFloat(n.style.top) / 100) * r.height;
      n.classList.toggle("spotted", Math.hypot(nx - lx, ny - ly) < 50);
    });

    if (!still) requestAnimationFrame(frame);
  }

  frame();
}

// Scrolling strip of the latest reports under the hero.
function renderTicker() {
  const track = document.querySelector("#ticker-track");

  if (!track) {
    return;
  }

  const latest = allItems().slice(0, 10);
  track.replaceChildren();

  if (latest.length === 0) {
    return;
  }

  const makeRun = (hidden) => {
    const run = document.createElement("div");
    run.className = "ticker-run";

    if (hidden) {
      run.setAttribute("aria-hidden", "true");
    }

    latest.forEach((item) => {
      const chip = document.createElement("span");
      chip.className = "ticker-item";

      const dot = document.createElement("span");
      dot.className = "ticker-dot " + (isReunited(item) ? "reunited" : item.type);

      const label = document.createElement("span");
      label.textContent =
        (item.icon || itemIcon(item.name)) + " " + item.name + " · " +
        buildingName(item.location);

      chip.append(dot, label);
      run.append(chip);
    });

    return run;
  };

  // Two copies so the loop is seamless.
  track.append(makeRun(false), makeRun(true));
}

// Build one item card (used by both item lists).
function createItemCard(item) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "item-card";

  const art = document.createElement("span");
  art.className = "item-art";

  const photoUrl = safePhotoUrl(item.photo);

  if (photoUrl) {
    const photo = document.createElement("img");
    photo.src = photoUrl;
    photo.alt = "Photo of " + item.name;
    photo.loading = "lazy";
    art.append(photo);
  } else {
    art.textContent = item.icon || itemIcon(item.name);
    art.setAttribute("aria-hidden", "true");
  }

  const body = document.createElement("span");
  body.className = "item-body";

  const title = document.createElement("strong");
  title.textContent = item.name;

  const reunited = isReunited(item);
  const status = document.createElement("span");
  status.className = "status " + (reunited ? "reunited" : item.type);
  status.textContent = reunited
    ? "Reunited"
    : item.type === "found"
      ? "Found"
      : "Lost";

  const date = document.createElement("span");
  date.className = "meta";
  date.textContent = formatDate(item.date);

  const location = document.createElement("span");
  location.className = "meta";
  location.append(svgIcon("pin", "icon meta-icon"), " " + item.location);

  body.append(title, status, date, location);
  card.append(art, body);

  if (reunited) {
    const stamp = document.createElement("span");
    stamp.className = "reunited-stamp";
    stamp.textContent = "REUNITED";
    stamp.setAttribute("aria-hidden", "true");
    card.append(stamp);
  }

  revealOnScroll(card, item);

  // Show the item details window when clicked.
  card.addEventListener("click", () => openItemDialog(item));

  return card;
}

// ===== Homepage extras: map filter, stats, animations =====

// Gray shimmering cards shown while items load.
function skeletonCards(count) {
  return Array.from({ length: count }, () => {
    const card = document.createElement("div");
    card.className = "item-card skeleton";
    card.setAttribute("aria-hidden", "true");
    card.innerHTML =
      '<span class="item-art"></span><span class="item-body">' +
      '<span class="sk-line"></span><span class="sk-line short"></span>' +
      '<span class="sk-line"></span></span>';
    return card;
  });
}

// Item details window (replaces the old alert box).
const itemDialog = document.querySelector("#item-dialog");

function openItemDialog(item) {
  if (!itemDialog || typeof itemDialog.showModal !== "function") {
    return;
  }

  const reunited = isReunited(item);
  const art = itemDialog.querySelector("#item-dialog-art");
  const photoUrl = safePhotoUrl(item.photo);

  art.replaceChildren();
  art.classList.toggle("has-photo", Boolean(photoUrl));

  if (photoUrl) {
    const photo = document.createElement("img");
    photo.src = photoUrl;
    photo.alt = "Photo of " + item.name;
    art.append(photo);
  } else {
    art.textContent = item.icon || itemIcon(item.name);
  }

  itemDialog.querySelector("#item-dialog-title").textContent = item.name;

  const status = itemDialog.querySelector("#item-dialog-status");
  status.className = "status " + (reunited ? "reunited" : item.type);
  status.textContent = reunited
    ? "Reunited"
    : item.type === "found"
      ? "Found"
      : "Lost";

  itemDialog.querySelector("#item-dialog-date").textContent = formatDate(
    item.date,
  );
  itemDialog.querySelector("#item-dialog-location").textContent =
    item.location;
  itemDialog.querySelector("#item-dialog-description").textContent =
    item.description || "No description given.";

  const actions = itemDialog.querySelector("#item-dialog-actions");
  actions.replaceChildren();

  if (reunited) {
    const note = document.createElement("p");
    note.className = "item-note";
    note.textContent = "🎉 This item is already back with its owner.";
    actions.append(note);
  } else if (useSheet && sheetApiVersion >= 2 && item.hasContact) {
    actions.append(buildContactForm(item));
  } else if (item.email) {
    actions.append(...buildEmailFallback(item));
  } else {
    const note = document.createElement("p");
    note.className = "item-note";
    note.textContent = "No contact information was left for this item.";
    actions.append(note);
  }

  itemDialog.showModal();
}

// ===== Private contact form (the reporter's email is never shown) =====
function contactField(labelText, control, hintText) {
  const label = document.createElement("label");
  label.className = "contact-field";
  const span = document.createElement("span");
  span.textContent = labelText;
  label.append(span, control);

  if (hintText) {
    const hint = document.createElement("small");
    hint.className = "field-hint";
    hint.textContent = hintText;
    label.append(hint);
  }

  return label;
}

function buildContactForm(item) {
  const isClaim = item.type === "found";
  const wrap = document.createElement("div");
  wrap.className = "contact-box";

  const open = document.createElement("button");
  open.type = "button";
  open.className = "btn btn-primary contact-open";
  open.textContent = isClaim ? "✋ This is mine" : "🙌 I found this";

  const lead = document.createElement("p");
  lead.className = "item-note";
  lead.textContent = isClaim
    ? "Send the finder a private message. Their email stays hidden, and they'll reply to yours."
    : "Send the owner a private message. Their email stays hidden, and they'll reply to yours.";

  const form = document.createElement("form");
  form.className = "contact-form";
  form.hidden = true;
  form.noValidate = true;

  const name = document.createElement("input");
  name.name = "name";
  name.required = true;
  name.maxLength = 60;
  name.autocomplete = "name";
  name.placeholder = "Your name";

  const email = document.createElement("input");
  email.name = "email";
  email.type = "email";
  email.required = true;
  email.maxLength = 120;
  email.autocomplete = "email";
  email.inputMode = "email";
  email.placeholder = "you@byui.edu";

  const detail = document.createElement("textarea");
  detail.name = "detail";
  detail.required = true;
  detail.rows = 2;
  detail.maxLength = 500;
  detail.placeholder = isClaim
    ? "e.g. the lock screen photo, a sticker, what's inside"
    : "e.g. under a chair in room 120, Tuesday afternoon";

  const message = document.createElement("textarea");
  message.name = "message";
  message.required = true;
  message.rows = 3;
  message.maxLength = 1500;
  message.value = isClaim
    ? "Hi! I think the " + item.name + " you found at " + item.location + " is mine. When and where could I pick it up?"
    : "Hi! I think I found your " + item.name + ". Let me know a good time and place to give it back.";

  // Hidden from people; bots that fill it in are ignored by the script.
  const trap = document.createElement("input");
  trap.name = "website";
  trap.tabIndex = -1;
  trap.autocomplete = "off";
  trap.className = "contact-trap";
  trap.setAttribute("aria-hidden", "true");

  const send = document.createElement("button");
  send.type = "submit";
  send.className = "btn btn-primary";
  send.textContent = "Send message";

  const feedback = document.createElement("p");
  feedback.className = "form-feedback";
  feedback.setAttribute("role", "status");
  feedback.setAttribute("aria-live", "polite");

  const safety = document.createElement("p");
  safety.className = "contact-safety";
  safety.textContent = "🛡️ Meet somewhere public on campus, or hand it in at a staffed front desk.";

  form.append(
    contactField("Your name *", name),
    contactField("Your email *", email, "The other person will reply here."),
    contactField(
      isClaim ? "Prove it's yours *" : "Where did you find it? *",
      detail,
      isClaim ? "Describe something that isn't in the listing, so the finder can check." : "",
    ),
    contactField("Message *", message),
    trap,
    send,
    feedback,
    safety,
  );

  form.addEventListener("input", () => {
    if (feedback.classList.contains("error")) {
      feedback.textContent = "";
      feedback.className = "form-feedback";
    }
  });

  open.addEventListener("click", () => {
    open.hidden = true;
    lead.hidden = true;
    form.hidden = false;
    name.focus();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const values = {
      name: name.value.trim(),
      email: email.value.trim(),
      detail: detail.value.trim(),
      message: message.value.trim(),
    };

    const missing = [name, email, detail, message].find((field) => !field.value.trim());
    if (missing) {
      feedback.textContent = "Please fill in every field.";
      feedback.className = "form-feedback error";
      missing.focus();
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      feedback.textContent = "Please enter a valid email address.";
      feedback.className = "form-feedback error";
      email.focus();
      return;
    }

    send.disabled = true;
    send.textContent = "Sending…";
    feedback.textContent = "";
    feedback.className = "form-feedback";

    try {
      // A plain-text body avoids a CORS preflight, which Apps Script does not answer.
      const response = await fetch(SHEET_API_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "contact",
          itemId: item.id,
          website: trap.value,
          ...values,
        }),
      });
      const result = await response.json();

      if (!result.ok) {
        throw new Error(result.error || "The message could not be sent.");
      }

      const done = document.createElement("div");
      done.className = "contact-done";
      const title = document.createElement("strong");
      title.textContent = "✅ Message sent!";
      const text = document.createElement("p");
      text.textContent =
        (isClaim ? "The finder" : "The owner") +
        " will reply to " + values.email + ". Check your spam folder too, just in case.";
      done.append(title, text);
      wrap.replaceChildren(done);
      celebrate();
    } catch (error) {
      feedback.textContent = error.message || "Could not send. Please try again.";
      feedback.className = "form-feedback error";
      send.disabled = false;
      send.textContent = "Send message";
    }
  });

  wrap.append(open, lead, form);
  return wrap;
}

// Used only until the updated Sheet script is deployed (it still sends emails).
function buildEmailFallback(item) {
  const isClaim = item.type === "found";
  const subject = isClaim
    ? "I think the " + item.name + " you found is mine"
    : "I may have found your " + item.name;
  const bodyText = isClaim
    ? "Hi! I think the " + item.name + " you found at " + item.location + " is mine.\n\nSomething that proves it's mine: \n\nWhen and where could I pick it up?"
    : "Hi! I think I found your " + item.name + ".\n\nWhere I found it: \n\nLet me know a good time and place to give it back.";

  const contact = document.createElement("a");
  contact.className = "btn btn-primary";
  contact.href =
    "mailto:" + encodeURIComponent(item.email).replace("%40", "@") +
    "?subject=" + encodeURIComponent(subject + " (Lost & Found)") +
    "&body=" + encodeURIComponent(bodyText);
  contact.textContent = isClaim ? "✋ This is mine" : "🙌 I found this";

  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "btn btn-outline contact-copy";
  copy.textContent = "Copy email address";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(item.email);
      copy.textContent = "Copied ✓";
    } catch (error) {
      copy.textContent = item.email;
    }
  });

  const hint = document.createElement("p");
  hint.className = "item-note";
  hint.textContent = "Opens an email to " + item.email + ".";
  return [contact, copy, hint];
}

if (itemDialog) {
  itemDialog
    .querySelector(".close-item-dialog")
    .addEventListener("click", () => itemDialog.close());

  itemDialog.addEventListener("click", (event) => {
    if (event.target === itemDialog) {
      itemDialog.close();
    }
  });
}

// All / Lost / Found filter buttons (they drive the hidden dropdown).
document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const select = document.querySelector("#filter-type");

    if (!select) {
      return;
    }

    select.value = chip.dataset.value;
    document.querySelectorAll(".chip").forEach((other) => {
      const on = other === chip;
      other.classList.toggle("active", on);
      other.setAttribute("aria-pressed", String(on));
    });
    renderItems();
  });
});

// Dark mode toggle (remembers the choice in this browser).
const themeToggle = document.querySelector(".theme-toggle");

function syncThemeButton() {
  if (!themeToggle) {
    return;
  }

  const dark = document.documentElement.dataset.theme === "dark";
  themeToggle.replaceChildren(svgIcon(dark ? "sun" : "moon"));
  themeToggle.setAttribute(
    "aria-label",
    dark ? "Switch to light mode" : "Switch to dark mode",
  );
}

if (themeToggle) {
  syncThemeButton();
  themeToggle.addEventListener("click", () => {
    const dark = document.documentElement.dataset.theme !== "dark";

    if (dark) {
      document.documentElement.dataset.theme = "dark";
    } else {
      delete document.documentElement.dataset.theme;
    }

    try {
      localStorage.setItem("lf-theme", dark ? "dark" : "light");
    } catch (error) {
      // Storage can be unavailable (private mode); the toggle still works.
    }

    syncThemeButton();
  });
}

// Building chosen on the campus map (null = show every building).
let activeBuilding = null;

// An item counts as reunited when its Status in the Sheet says so.
function isReunited(item) {
  return String(item.status || "").trim().toLowerCase() === "reunited";
}

// "Smith Building, room 280" -> "Smith Building", "McKay Library, 2nd floor" -> "McKay Library".
function buildingName(location) {
  const text = String(location || "").split(",")[0].trim();
  const match = text.match(
    /^(.*?\b(building|center|centre|library|hall|gym|stadium|chapel|lot))\b/i,
  );
  const campus = CAMPUS.find((spot) => spot.match.test(location));

  if (campus) {
    return campus.name;
  }

  let name = (match ? match[1] : text).trim();

  // "Library" and "McKay Library" are the same building.
  if (/^(the )?library$/i.test(name)) {
    name = "McKay Library";
  }

  return name.charAt(0).toUpperCase() + name.slice(1);
}

// ===== Illustrated campus map (idea from paulfey.me/about) =====
// Building positions come from Google Maps coordinates for each BYU-Idaho
// building, projected onto the drawing (north is up). Artwork is illustrative.
const MAP_BOUNDS = { west: -111.7868, east: -111.7786, north: 43.8222, south: 43.8139 };
const MAP_W = 1000;
const MAP_H = 880;
const MAP_PAD = 40;

function mapX(lng) {
  return MAP_PAD + ((lng - MAP_BOUNDS.west) / (MAP_BOUNDS.east - MAP_BOUNDS.west)) * (MAP_W - MAP_PAD * 2);
}

function mapY(lat) {
  return MAP_PAD + ((MAP_BOUNDS.north - lat) / (MAP_BOUNDS.north - MAP_BOUNDS.south)) * (MAP_H - MAP_PAD * 2);
}

const CAMPUS = [
  { code: "SNO", name: "Snow Performing Arts Center", lat: 43.82150, lng: -111.78322, w: 104, h: 40, color: "#c9a27f", match: /\bsnow\b|\bsno\b|performing arts/i },
  { code: "SPO", name: "Spori Building", lat: 43.82089, lng: -111.78240, w: 78, h: 38, color: "#c98b6b", match: /spori|\bspo\b/i },
  { code: "ROM", name: "Romney Building", lat: 43.82020, lng: -111.78380, w: 66, h: 34, color: "#b9a68c", match: /romney|\brom\b/i },
  { code: "CLK", name: "Clarke Building", lat: 43.82034, lng: -111.78130, w: 66, h: 36, color: "#a7b6a0", match: /clarke|\bclk\b/i },
  { code: "STA", name: "BYU-Idaho Stadium", lat: 43.82095, lng: -111.78602, stadium: true, match: /stadium|\bsta\b/i },
  { code: "HFC", name: "Hart Building", lat: 43.81960, lng: -111.78597, w: 110, h: 44, color: "#9fb0bf", match: /\bhart\b|fitness|\bgym\b/i },
  { code: "MCK", name: "McKay Library", lat: 43.81950, lng: -111.78282, w: 84, h: 42, color: "#c7b37f", match: /mckay|library|\bmck\b/i },
  { code: "SMI", name: "Smith Building", lat: 43.81914, lng: -111.78146, w: 72, h: 46, color: "#a9b8c6", match: /smith|\bsmi\b/i },
  { code: "BCTR", name: "BYU-Idaho Center", lat: 43.81849, lng: -111.78574, w: 136, h: 70, color: "#b4bcc4", match: /byu-?i(daho)? center|\bbctr\b|i-center/i },
  { code: "MC", name: "Manwaring Center", lat: 43.81843, lng: -111.78260, w: 112, h: 58, color: "#8fb3a5", match: /manwaring|crossroads|\bmc\b/i },
  { code: "CHP", name: "Chapman Hall", lat: 43.81798, lng: -111.78059, w: 70, h: 34, color: "#d2b8a3", match: /chapman|\bchp\b/i },
  { code: "BID", name: "Biddulph Hall", lat: 43.81736, lng: -111.78496, w: 56, h: 30, color: "#cdb9a0", match: /biddulph|\bbid\b/i },
  { code: "RIG", name: "Rigby Hall", lat: 43.81701, lng: -111.78443, w: 56, h: 30, color: "#b8c4b0", match: /rigby|\brig\b/i },
  { code: "TAY", name: "Taylor Building", lat: 43.81696, lng: -111.78249, w: 72, h: 40, color: "#d1c2a6", match: /taylor|\btay\b/i, spire: true },
  { code: "KIM", name: "Kimball Building", lat: 43.81709, lng: -111.78150, w: 66, h: 40, color: "#b7a3b8", match: /kimball|\bkim\b/i },
  { code: "SHC", name: "Student Health Center", lat: 43.81679, lng: -111.77930, w: 62, h: 32, color: "#c7d3d9", match: /health|counsel|\bshc\b/i },
  { code: "P", name: "Kimball Parking Lot", lat: 43.81745, lng: -111.77985, lot: true, match: /parking|\blot\b/i },
  { code: "HIN", name: "Hinckley Building", lat: 43.81588, lng: -111.77987, w: 70, h: 36, color: "#bfa98f", match: /hinckley|\bhin\b/i },
  { code: "AUS", name: "Austin Building", lat: 43.81584, lng: -111.78429, w: 74, h: 36, color: "#a4abb5", match: /austin|\baus\b/i },
  { code: "BEN", name: "Benson Building", lat: 43.81540, lng: -111.78320, w: 72, h: 40, color: "#b3c2a2", match: /benson|\bben\b/i },
  { code: "RKS", name: "Ricks Building", lat: 43.81483, lng: -111.78100, w: 66, h: 36, color: "#d0b48c", match: /\bricks building\b|\brks\b/i },
  { code: "STC", name: "Science & Technology Center", lat: 43.81457, lng: -111.78428, w: 88, h: 44, color: "#8fa9c2", match: /\bstc\b|science|technology/i },
].map((b) => ({ ...b, x: mapX(b.lng), y: mapY(b.lat) }));

const ROADS = {
  secondSouth: mapY(43.8219),
  viking: mapY(43.81765),
  centerSt: mapX(-111.78370),
  secondEast: mapX(-111.77895),
  firstWest: mapX(-111.78655),
};

function campusSvg(tag, attrs, parent) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (v !== null && v !== undefined) el.setAttribute(k, v);
  });
  if (parent) parent.append(el);
  return el;
}

function seeded(seed) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, v + amount));
  return "rgb(" + c(n >> 16) + "," + c((n >> 8) & 255) + "," + c(n & 255) + ")";
}

function drawCampusBase(svg) {
  const defs = campusSvg("defs", {}, svg);
  const pat = campusSvg("pattern", { id: "lot-lines", width: 12, height: 12, patternUnits: "userSpaceOnUse" }, defs);
  campusSvg("rect", { width: 12, height: 12, fill: "#c9ced2" }, pat);
  campusSvg("line", { x1: 0, y1: 0, x2: 0, y2: 12, stroke: "#fff", "stroke-width": 2 }, pat);

  campusSvg("rect", { x: 0, y: 0, width: MAP_W, height: MAP_H, rx: 28, class: "cm-grass" }, svg);

  // Rexburg city canal: runs between the stadium and Hart, then south-west.
  campusSvg("path", {
    d: `M${mapX(-111.7849)} -10 C ${mapX(-111.7851)} ${mapY(43.8213)}, ${mapX(-111.7856)} ${mapY(43.8203)}, ${mapX(-111.7860)} ${mapY(43.8201)} S ${mapX(-111.7866)} ${mapY(43.8193)}, -10 ${mapY(43.8185)}`,
    class: "cm-water",
  }, svg);

  const roads = campusSvg("g", { class: "cm-roads" }, svg);
  [
    `M0 ${ROADS.secondSouth} H${MAP_W}`,
    `M0 ${ROADS.viking} H${MAP_W}`,
    `M${ROADS.centerSt} ${ROADS.viking} V${MAP_H}`,
    `M${ROADS.secondEast} 0 V${MAP_H}`,
    `M${ROADS.firstWest} 0 V${MAP_H}`,
  ].forEach((d) => campusSvg("path", { d }, roads));

  // Thomas E. Ricks Gardens
  const gx = mapX(-111.78147);
  const gy = mapY(43.81548);
  campusSvg("rect", { x: gx - 62, y: gy - 34, width: 124, height: 68, rx: 18, class: "cm-garden" }, svg);
  const gl = campusSvg("text", { x: gx, y: gy + 5, class: "cm-place" }, svg);
  gl.textContent = "Ricks Gardens";

  // Walkways between neighbouring buildings (animated dashes)
  const byCode = Object.fromEntries(CAMPUS.map((b) => [b.code, b]));
  const walks = campusSvg("g", { class: "cm-walks" }, svg);
  [
    ["SNO", "SPO"], ["SPO", "CLK"], ["SPO", "ROM"], ["ROM", "MCK"], ["CLK", "SMI"],
    ["MCK", "MC"], ["SMI", "MC"], ["SMI", "CHP"], ["MC", "TAY"], ["MC", "KIM"],
    ["MC", "BCTR"], ["BCTR", "HFC"], ["TAY", "RIG"], ["RIG", "BID"], ["KIM", "SHC"],
    ["TAY", "BEN"], ["RIG", "AUS"], ["AUS", "STC"], ["BEN", "RKS"], ["SHC", "HIN"],
  ].forEach(([a, b]) => {
    const A = byCode[a];
    const B = byCode[b];
    const mx = (A.x + B.x) / 2 + (A.y - B.y) * 0.12;
    const my = (A.y + B.y) / 2 + (B.x - A.x) * 0.12;
    campusSvg("path", { d: `M${A.x} ${A.y} Q ${mx} ${my} ${B.x} ${B.y}` }, walks);
  });

  [["Viking Dr", mapX(-111.7864) + 14, ROADS.viking - 7], ["E 2nd S", mapX(-111.7808), ROADS.secondSouth - 7],
   ["S Center St", ROADS.centerSt - 7, mapY(43.8142), -90], ["S 2nd E", ROADS.secondEast - 7, mapY(43.8160), -90]]
    .forEach(([t, x, y, r]) => {
      const el = campusSvg("text", { x, y, class: "cm-street", transform: r ? `rotate(${r} ${x} ${y})` : null }, svg);
      el.textContent = t;
    });

  // Trees, kept clear of buildings, roads and the garden.
  const rand = seeded(11);
  const trees = campusSvg("g", { class: "cm-trees" }, svg);
  let placed = 0;

  for (let tries = 0; tries < 2500 && placed < 120; tries += 1) {
    const x = 18 + rand() * (MAP_W - 36);
    const y = 18 + rand() * (MAP_H - 36);
    const nearBuilding = CAMPUS.some((b) => {
      const w = b.stadium ? 120 : b.lot ? 80 : b.w;
      const h = b.stadium ? 150 : b.lot ? 60 : b.h;
      return Math.abs(b.x - x) < w / 2 + 16 && y > b.y - h / 2 - 50 && y < b.y + h / 2 + 18;
    });
    const onRoad = [ROADS.secondSouth, ROADS.viking].some((r) => Math.abs(y - r) < 18) ||
      [ROADS.secondEast, ROADS.firstWest].some((r) => Math.abs(x - r) < 18) ||
      (Math.abs(x - ROADS.centerSt) < 18 && y > ROADS.viking);
    const inGarden = Math.abs(x - gx) < 75 && Math.abs(y - gy) < 45;
    if (nearBuilding || onRoad || inGarden) continue;

    const r = 6 + rand() * 7;
    const t = campusSvg("g", { class: "cm-tree", style: "--d:" + (rand() * 3).toFixed(2) + "s" }, trees);
    campusSvg("ellipse", { cx: x + 3, cy: y + r * 0.8, rx: r, ry: r * 0.45, class: "cm-shadow" }, t);
    campusSvg("circle", { cx: x, cy: y, r, fill: rand() > 0.5 ? "#5f9a5b" : "#4f8a55" }, t);
    campusSvg("circle", { cx: x - r * 0.3, cy: y - r * 0.3, r: r * 0.45, fill: "#ffffff22" }, t);
    placed += 1;
  }
}

function drawBuilding(group, b) {
  if (b.stadium) {
    campusSvg("rect", { x: b.x - 52, y: b.y - 74, width: 104, height: 148, rx: 52, class: "cm-track" }, group);
    campusSvg("rect", { x: b.x - 36, y: b.y - 58, width: 72, height: 116, rx: 36, class: "cm-field" }, group);
    campusSvg("line", { x1: b.x - 36, y1: b.y, x2: b.x + 36, y2: b.y, stroke: "#ffffff88", "stroke-width": 2 }, group);
    return;
  }

  if (b.lot) {
    campusSvg("rect", { x: b.x - 40, y: b.y - 28, width: 80, height: 56, rx: 6, fill: "url(#lot-lines)", class: "cm-body" }, group);
    const p = campusSvg("text", { x: b.x, y: b.y + 9, class: "cm-lot" }, group);
    p.textContent = "P";
    return;
  }

  const { x, y, w, h, color } = b;
  const depth = 14;
  campusSvg("ellipse", { cx: x + 5, cy: y + h / 2 + 3, rx: w / 2 + 6, ry: 7, class: "cm-shadow" }, group);
  campusSvg("rect", { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: 3, fill: color, class: "cm-body" }, group);
  campusSvg("path", {
    d: `M${x - w / 2} ${y - h / 2} L${x - w / 2 + 8} ${y - h / 2 - depth} L${x + w / 2 + 8} ${y - h / 2 - depth} L${x + w / 2} ${y - h / 2} Z`,
    fill: shade(color, -28),
  }, group);
  campusSvg("path", {
    d: `M${x + w / 2} ${y - h / 2} L${x + w / 2 + 8} ${y - h / 2 - depth} L${x + w / 2 + 8} ${y + h / 2 - depth} L${x + w / 2} ${y + h / 2} Z`,
    fill: shade(color, -45),
  }, group);

  const cols = Math.max(2, Math.floor(w / 16));
  for (let c = 0; c < cols; c += 1) {
    campusSvg("rect", {
      x: x - w / 2 + 6 + c * ((w - 12) / cols), y: y - h / 2 + 6,
      width: (w - 12) / cols - 4, height: 7, rx: 1.5, class: "cm-window",
    }, group);
  }

  // Building code painted on the wall, like the campus abbreviations.
  const code = campusSvg("text", { x, y: y + h / 2 - 7, class: "cm-code" }, group);
  code.textContent = b.code;

  if (b.spire) {
    campusSvg("path", {
      d: `M${x - 5} ${y - h / 2 - depth + 2} L${x + 2} ${y - h / 2 - depth - 34} L${x + 9} ${y - h / 2 - depth + 2} Z`,
      fill: "#f2efe6", stroke: "#cfc7b3",
    }, group);
  }
}

function renderCampusMap() {
  const map = document.querySelector("#campus-map");

  if (!map) {
    return;
  }

  const counts = new Map();
  let other = 0;

  allItems().forEach((item) => {
    const name = buildingName(item.location);
    if (CAMPUS.some((b) => b.name === name)) {
      counts.set(name, (counts.get(name) || 0) + 1);
    } else {
      other += 1;
    }
  });

  if (activeBuilding && !counts.has(activeBuilding)) {
    activeBuilding = null;
  }

  const firstDraw = !map.classList.contains("illustrated");
  map.classList.add("illustrated");
  map.replaceChildren();

  const wrap = document.createElement("div");
  wrap.className = "cm-wrap";

  const svg = campusSvg("svg", {
    viewBox: `0 0 ${MAP_W} ${MAP_H}`,
    class: "campus-svg",
    role: "group",
    "aria-label": "Illustrated BYU-Idaho campus map. Pins show how many items were reported at each building.",
  });
  drawCampusBase(svg);

  const tip = document.createElement("div");
  tip.className = "cm-tip";
  tip.hidden = true;

  const showTip = (b, count) => {
    tip.hidden = false;
    tip.textContent = b.name + (count ? " · " + count + (count === 1 ? " item" : " items") : " · no reports");
    tip.style.left = (b.x / MAP_W) * 100 + "%";
    tip.style.top = ((b.y - (b.h || 60) / 2 - 22) / MAP_H) * 100 + "%";
  };

  // Draw from north to south so nearer buildings overlap farther ones.
  const layer = campusSvg("g", {}, svg);
  const pins = campusSvg("g", { class: "cm-pins" }, svg);

  [...CAMPUS].sort((a, b) => a.y - b.y).forEach((b) => {
    const count = counts.get(b.name) || 0;
    const g = campusSvg("g", {
      class: "cm-building" + (count ? " has-items" : "") + (b.name === activeBuilding ? " active" : ""),
      tabindex: 0,
      role: count ? "button" : "img",
      "aria-label": b.name + ": " + count + (count === 1 ? " item" : " items"),
      "aria-pressed": count ? String(b.name === activeBuilding) : null,
    }, layer);

    drawBuilding(g, b);

    g.addEventListener("mouseenter", () => showTip(b, count));
    g.addEventListener("focus", () => showTip(b, count));
    g.addEventListener("mouseleave", () => { tip.hidden = true; });
    g.addEventListener("blur", () => { tip.hidden = true; });

    g.addEventListener("touchstart", () => {
      showTip(b, count);
      clearTimeout(tip.hideTimer);
      tip.hideTimer = setTimeout(() => { tip.hidden = true; }, 1800);
    }, { passive: true });

    if (!count) {
      return;
    }

    const toggle = () => {
      activeBuilding = activeBuilding === b.name ? null : b.name;
      renderItems();
      document.querySelector("#item-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    g.addEventListener("click", toggle);
    g.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });

    // Pin with the count, dropped above the roof. Clicking the pin works too.
    const top = b.stadium ? b.y - 74 : b.lot ? b.y - 28 : b.y - b.h / 2 - 14;
    const pin = campusSvg("g", {
      class: "cm-pin" + (b.name === activeBuilding ? " active" : ""),
      style: "--drop:" + (b.y / MAP_H * 0.8).toFixed(2) + "s",
    }, pins);
    const inner = campusSvg("g", { class: "cm-pin-inner" }, pin);
    campusSvg("path", {
      d: `M${b.x} ${top - 2} c -12 -14 -15 -20 -15 -27 a 15 15 0 0 1 30 0 c 0 7 -3 13 -15 27 z`,
      class: "cm-pin-shape",
    }, inner);
    const ct = campusSvg("text", { x: b.x, y: top - 24, class: "cm-pin-count" }, inner);
    ct.textContent = String(count);
    pin.addEventListener("click", toggle);
    pin.addEventListener("mouseenter", () => showTip(b, count));
    pin.addEventListener("mouseleave", () => { tip.hidden = true; });
  });

  const compass = campusSvg("g", { class: "cm-compass", transform: `translate(${MAP_W - 44} ${MAP_H - 44})` }, svg);
  campusSvg("circle", { r: 20 }, compass);
  const n = campusSvg("text", { y: 5 }, compass);
  n.textContent = "N";

  wrap.append(svg, tip);
  map.append(wrap);

  // On phones the map scrolls sideways: start centred on the middle of campus.
  if (wrap.scrollWidth > wrap.clientWidth) {
    requestAnimationFrame(() => {
      const mc = CAMPUS.find((b) => b.name === activeBuilding) || CAMPUS.find((b) => b.code === "MC");
      const ratio = wrap.scrollWidth / MAP_W;
      wrap.scrollLeft = mc.x * ratio - wrap.clientWidth / 2;
    });
  }

  // Pins drop in the first time the map scrolls into view.
  if (firstDraw && "IntersectionObserver" in window) {
    map.classList.add("pins-waiting");
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        map.classList.remove("pins-waiting");
        io.disconnect();
      }
    }, { threshold: 0.25 });
    io.observe(map);
  }

  // Building key: every building, code and live count.
  const key = document.createElement("details");
  key.className = "cm-key";
  const sum = document.createElement("summary");
  sum.textContent = "Building key (" + CAMPUS.length + " buildings)";
  const list = document.createElement("ul");
  [...CAMPUS].sort((a, b) => a.name.localeCompare(b.name)).forEach((b) => {
    const li = document.createElement("li");
    const c = document.createElement("strong");
    c.textContent = b.code;
    const nm = document.createElement("span");
    nm.textContent = b.name;
    const ct = document.createElement("em");
    const count = counts.get(b.name) || 0;
    ct.textContent = count ? String(count) : "–";
    if (count) li.className = "has-items";
    li.append(c, nm, ct);
    list.append(li);
  });
  key.append(sum, list);
  map.append(key);

  if (other) {
    const legend = document.createElement("p");
    legend.className = "cm-legend";
    legend.textContent = other + " item" + (other === 1 ? "" : "s") + " reported somewhere not on the map.";
    map.append(legend);
  }

  const hint = document.querySelector("#map-hint");
  if (hint) {
    hint.textContent = activeBuilding
      ? "Showing " + activeBuilding + " · tap again to clear"
      : "Tap a pin to see what was reported there";
  }
}

// Count numbers up from their current value.
// Rolling-digit counter: each digit is a 0-9 strip that slides into place.
function countTo(element, target) {
  if (!element) {
    return;
  }

  if (element.dataset.value === String(target)) {
    return;
  }

  element.dataset.value = String(target);
  element.setAttribute("aria-label", String(target));

  const digits = String(target).split("");
  element.replaceChildren();
  element.classList.add("odometer");

  digits.forEach((digit, index) => {
    const slot = document.createElement("span");
    slot.className = "odo-slot";
    slot.setAttribute("aria-hidden", "true");

    const strip = document.createElement("span");
    strip.className = "odo-strip";
    for (let n = 0; n <= 9; n += 1) {
      const d = document.createElement("span");
      d.textContent = String(n);
      strip.append(d);
    }
    strip.style.transitionDelay = index * 120 + "ms";

    slot.append(strip);
    element.append(slot);

    // Start at 0, then roll to the real digit on the next frame.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        strip.style.transform = "translateY(-" + Number(digit) * 10 + "%)";
      }),
    );
  });
}

// Fade sections up as they scroll into view.
(function revealSections() {
  const targets = document.querySelectorAll(
    ".compare-section, .compare-card, .home-faq, .steps-grid article",
  );

  if (!("IntersectionObserver" in window)) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 },
  );

  targets.forEach((el, i) => {
    el.classList.add("reveal");
    el.style.setProperty("--reveal-delay", (i % 3) * 120 + "ms");
    observer.observe(el);
  });
})();

function updateStats() {
  if (useSheet && sheetItems === null) {
    return;
  }

  const items = allItems();

  countTo(document.querySelector("#stat-total"), items.length);
  countTo(
    document.querySelector("#stat-found"),
    items.filter((item) => item.type === "found" && !isReunited(item)).length,
  );
  countTo(
    document.querySelector("#stat-reunited"),
    items.filter(isReunited).length,
  );
}

// Fade cards in as they scroll into view (only the first time each is shown,
// so the 30-second refresh doesn't replay the animation).
const shownCards = new Set();
const reduceMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;
const cardObserver =
  "IntersectionObserver" in window
    ? new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const card = entry.target;
              const delay = Number(card.dataset.delay || 0);

              setTimeout(() => card.classList.add("in"), delay);
              cardObserver.unobserve(card);
            }
          });
        },
        { threshold: 0.15 },
      )
    : null;

let revealBatch = 0;

function revealOnScroll(card, item) {
  const key = item.id || item.name;

  if (!cardObserver || reduceMotion || shownCards.has(key)) {
    return;
  }

  shownCards.add(key);
  card.classList.add("reveal");
  card.dataset.delay = String((revealBatch++ % 4) * 90);
  cardObserver.observe(card);
}

// Confetti burst (used after a report is submitted).
function celebrate() {
  if (typeof window.confetti !== "function" || reduceMotion) {
    return;
  }

  window.confetti({
    particleCount: 120,
    spread: 80,
    origin: { y: 0.6 },
    colors: ["#4e806e", "#9fc4b4", "#f6c453", "#e57373", "#263946"],
  });
}

// Rotating keyword in the hero subtitle (slides up and fades).
const typewriterWord = document.querySelector("#typewriter-word");

if (typewriterWord && !reduceMotion) {
  const words = ["keys", "phone", "backpack", "umbrella", "headphones", "wallet"];
  let index = 0;

  setInterval(() => {
    index = (index + 1) % words.length;
    typewriterWord.classList.add("word-out");

    setTimeout(() => {
      typewriterWord.textContent = words[index];
      typewriterWord.classList.remove("word-out");
      typewriterWord.classList.add("word-in");

      // Next frame: let it slide into place.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => typewriterWord.classList.remove("word-in")),
      );
    }, 280);
  }, 2600);
}

// "Reset filters" buttons in the empty states.
document.querySelectorAll(".reset-filters").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.target === "found") {
      const search = document.querySelector("#search-found-items");
      const sort = document.querySelector("#sort-found-items");

      if (search) search.value = "";
      if (sort) sort.value = "newest";
      renderFoundItems();
      return;
    }

    const search = document.querySelector("#search-items");
    const select = document.querySelector("#filter-type");

    if (search) search.value = "";
    if (select) select.value = "all";
    activeBuilding = null;
    document.querySelectorAll(".chip").forEach((chip) => {
      const on = chip.dataset.value === "all";
      chip.classList.toggle("active", on);
      chip.setAttribute("aria-pressed", String(on));
    });
    renderItems();
  });
});

// Mobile navigation menu.
const menuButton = document.querySelector(".menu-toggle");
const nav = document.querySelector(".nav-links");

if (menuButton && nav) {
  menuButton.addEventListener("click", () => {
    const opened = nav.classList.toggle("open");

    menuButton.setAttribute("aria-expanded", String(opened));
  });
}

// Automatically update footer year.
document.querySelectorAll(".year").forEach((year) => {
  year.textContent = new Date().getFullYear();
});

// Report item form.
const dialog = document.querySelector("#report-dialog");
const reportForm = document.querySelector("#report-form");
const reportFeedback = document.querySelector("#report-feedback");
const reportSubmit = reportForm
  ? reportForm.querySelector('button[type="submit"]')
  : null;

function showReportMessage(message, isError) {
  if (reportFeedback) {
    reportFeedback.textContent = message;
    reportFeedback.classList.toggle("error", Boolean(isError));
  }
}

// Open the report dialog.
document.querySelectorAll(".report-trigger").forEach((button) => {
  button.addEventListener("click", () => {
    if (dialog && reportForm) {
      reportForm.reset();
      showReportMessage("", false);

      const dateField = reportForm.querySelector('[name="date"]');

      if (dateField) {
        dateField.value = new Date().toLocaleDateString("en-CA");
      }

      dialog.showModal();

      // Start keyboard users on the first field instead of the close button.
      const firstField = reportForm.querySelector('[name="type"]');

      if (firstField) {
        firstField.focus();
      }
    }
  });
});

// Close the report dialog.
const closeButton = document.querySelector(".close-dialog");

if (closeButton && dialog) {
  closeButton.addEventListener("click", () => {
    dialog.close();
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });
}

// Read an image file into an <img> element.
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };

    image.src = url;
  });
}

// Shrink large photos so they upload quickly. Returns { type, data, dataUrl }.
async function preparePhoto(file, maxSide) {
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    throw new Error("Please choose a JPG, PNG, GIF, or WebP image.");
  }

  const image = await loadImage(file);
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext("2d");

  // White background so transparent PNGs don't turn black as JPEGs.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  const data = dataUrl.split(",")[1];

  // Base64 is about 4/3 the size of the real file.
  if ((data.length * 3) / 4 > MAX_PHOTO_BYTES) {
    throw new Error("That photo is too large. Please choose one under 5 MB.");
  }

  return { type: "image/jpeg", data: data, dataUrl: dataUrl };
}

// Send a report to the shared Sheet.
async function sendToSheet(report, photo) {
  // A plain-text body avoids a CORS preflight, which Apps Script does not answer.
  const response = await fetch(SHEET_API_URL, {
    method: "POST",
    body: JSON.stringify({
      ...report,
      photo: photo ? { type: photo.type, data: photo.data } : null,
    }),
  });

  const result = await response.json();

  if (!result.ok) {
    throw new Error(result.error || "The report could not be saved.");
  }
}

// Save a report in this browser (when the Sheet is not connected).
function saveLocally(report, photo) {
  const reports = savedReports();

  reports.push({ ...report, photo: photo ? photo.dataUrl : "" });

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  } catch (error) {
    // The browser may be out of space for photos; save without it.
    reports[reports.length - 1].photo = "";
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  }
}

// Submit newly reported items.
if (reportForm) {
  reportForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const data = new FormData(reportForm);

    const report = {
      id: String(Date.now()),
      type: String(data.get("type")),
      name: String(data.get("name")).trim(),
      location: String(data.get("location")).trim(),
      date: String(data.get("date")),
      description: String(data.get("description")).trim(),
      email: String(data.get("email")).trim(),
    };

    if (
      !report.name ||
      !report.location ||
      !report.description ||
      !report.email
    ) {
      showReportMessage("Please fill in every required field.", true);
      return;
    }

    reportSubmit.disabled = true;
    showReportMessage("Submitting your report…", false);

    try {
      const file = data.get("photo");
      let photo = null;

      if (file && file.size > 0) {
        photo = await preparePhoto(file, useSheet ? MAX_PHOTO_SIDE : 600);
      }

      if (useSheet) {
        await sendToSheet(report, photo);
      } else {
        saveLocally(report, photo);
      }

      reportForm.reset();
      dialog.close();
      celebrate();

      if (document.body.dataset.page === "home") {
        document.querySelector("#search-items").value = "";
        document.querySelector("#filter-type").value = "all";

        if (useSheet) {
          await loadSheetItems();
        } else {
          renderItems();
          renderFoundItems();
        }

        document
          .querySelector("#recent-items")
          .scrollIntoView({ behavior: "smooth" });
      } else {
        window.location.href = "index.html#recent-items";
      }
    } catch (error) {
      showReportMessage(
        error.message || "Could not save the report. Please try again.",
        true,
      );
    } finally {
      reportSubmit.disabled = false;
    }
  });
}

// Search and filter functionality.
const searchInput = document.querySelector("#search-items");
const typeFilter = document.querySelector("#filter-type");

if (searchInput) {
  searchInput.addEventListener("input", renderItems);
}

if (typeFilter) {
  typeFilter.addEventListener("change", renderItems);
}

// Display and browse all found items.
function renderFoundItems() {
  const grid = document.querySelector("#found-item-grid");

  if (!grid) return;

  const search = document
    .querySelector("#search-found-items")
    .value.trim()
    .toLowerCase();

  const sort = document.querySelector("#sort-found-items").value;

  const foundItems = allItems().filter(
    (item) => item.type === "found" && searchText(item).includes(search),
  );

  // Sort found items.
  if (sort === "newest") {
    foundItems.sort((a, b) => b.date.localeCompare(a.date));
  } else if (sort === "oldest") {
    foundItems.sort((a, b) => a.date.localeCompare(b.date));
  } else if (sort === "name") {
    foundItems.sort((a, b) => a.name.localeCompare(b.name));
  }

  grid.replaceChildren();

  document.querySelector("#found-item-count").textContent = countLabel(
    foundItems.length,
    "found items",
  );

  document.querySelector("#found-empty-state").hidden =
    foundItems.length > 0 || (useSheet && sheetItems === null);

  if (useSheet && sheetItems === null && !sheetError) {
    grid.append(...skeletonCards(4));
  }

  foundItems.forEach((item) => {
    grid.append(createItemCard(item));
  });
}

// Search found items.
const foundSearch = document.querySelector("#search-found-items");

if (foundSearch) {
  foundSearch.addEventListener("input", renderFoundItems);
}

// Sort found items.
const foundSort = document.querySelector("#sort-found-items");

if (foundSort) {
  foundSort.addEventListener("change", renderFoundItems);
}

// Display both lists when the homepage opens.
renderItems();
renderFoundItems();

// Keep both lists updated live.
if (useSheet && document.querySelector("#item-grid")) {
  loadSheetItems();

  setInterval(() => {
    if (!document.hidden) {
      loadSheetItems();
    }
  }, REFRESH_INTERVAL);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      loadSheetItems();
    }
  });
} else {
  // Without the Sheet, update when reports change in another tab.
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      renderItems();
      renderFoundItems();
    }
  });
}

// Contact form demonstration.
const contactForm = document.querySelector("#contact-form");

if (contactForm) {
  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const feedback = document.querySelector("#contact-feedback");

    feedback.textContent =
      "Your form is complete! This demo does not " +
      "have an email service connected, so your " +
      "message has not been sent.";
  });
}
