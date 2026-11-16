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
  if (useSheet) {
    return sheetItems || [];
  }

  return [...savedReports().reverse(), ...defaultItems];
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

  if (lower.includes("phone")) {
    return "📱";
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

    return matchesType && searchText(item).includes(query);
  });

  // Clear previous cards.
  grid.replaceChildren();

  document.querySelector("#item-count").textContent = countLabel(
    filteredItems.length,
    "items",
  );

  document.querySelector("#empty-state").hidden =
    filteredItems.length > 0 || (useSheet && sheetItems === null);

  // Create a card for each item.
  filteredItems.forEach((item) => {
    grid.append(createItemCard(item));
  });
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

  const status = document.createElement("span");
  status.className = "status " + item.type;
  status.textContent = item.type === "found" ? "Found" : "Lost";

  const date = document.createElement("span");
  date.className = "meta";
  date.textContent = formatDate(item.date);

  const location = document.createElement("span");
  location.className = "meta";
  location.textContent = "📍 " + item.location;

  body.append(title, status, date, location);
  card.append(art, body);

  // Show more information when clicked.
  card.addEventListener("click", () => {
    const contact = item.email
      ? "Contact: " + item.email
      : "No contact information available.";

    alert(
      item.name +
        "\n\n" +
        item.type.toUpperCase() +
        "\n" +
        "Date: " +
        formatDate(item.date) +
        "\n" +
        "Location: " +
        item.location +
        "\n\n" +
        item.description +
        "\n\n" +
        contact,
    );
  });

  return card;
}

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
