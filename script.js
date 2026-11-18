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

  // Create a card for each item.
  filteredItems.forEach((item) => {
    grid.append(createItemCard(item));
  });

  renderCampusMap();
  updateStats();
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
  location.textContent = "📍 " + item.location;

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

// ===== Homepage extras: map filter, stats, animations =====

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
  const name = (match ? match[1] : text).trim();

  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Draw one map "building" per location, with a pin and item count.
function renderCampusMap() {
  const map = document.querySelector("#campus-map");

  if (!map) {
    return;
  }

  const counts = new Map();

  allItems().forEach((item) => {
    const name = buildingName(item.location);

    if (name) {
      counts.set(name, (counts.get(name) || 0) + 1);
    }
  });

  if (activeBuilding && !counts.has(activeBuilding)) {
    activeBuilding = null;
  }

  map.replaceChildren();

  [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, count]) => {
      const building = document.createElement("button");
      building.type = "button";
      building.className =
        "building" + (name === activeBuilding ? " active" : "");
      building.setAttribute("aria-pressed", String(name === activeBuilding));

      const pin = document.createElement("span");
      pin.className = "map-pin";
      pin.textContent = "📍";
      pin.setAttribute("aria-hidden", "true");

      const label = document.createElement("span");
      label.textContent = name;

      const total = document.createElement("span");
      total.className = "pin-count";
      total.textContent = count + (count === 1 ? " item" : " items");

      building.append(pin, label, total);
      building.addEventListener("click", () => {
        activeBuilding = activeBuilding === name ? null : name;
        renderItems();
      });

      map.append(building);
    });

  const hint = document.querySelector("#map-hint");

  if (hint) {
    hint.textContent = activeBuilding
      ? "Showing " + activeBuilding + " · tap again to clear"
      : "Tap a building to filter";
  }
}

// Count numbers up from their current value.
function countTo(element, target) {
  if (!element) {
    return;
  }

  const start = Number(element.textContent) || 0;

  if (start === target) {
    return;
  }

  const steps = 20;
  let step = 0;

  clearInterval(element._timer);
  element._timer = setInterval(() => {
    step += 1;
    element.textContent = Math.round(start + ((target - start) * step) / steps);

    if (step >= steps) {
      clearInterval(element._timer);
    }
  }, 30);
}

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

// Typewriter word in the hero subtitle.
const typewriterWord = document.querySelector("#typewriter-word");

if (typewriterWord && !reduceMotion) {
  const words = ["keys", "phone", "backpack", "umbrella", "headphones", "wallet"];
  let index = 0;

  setInterval(() => {
    index = (index + 1) % words.length;
    const word = words[index];
    let letters = 0;

    const typing = setInterval(() => {
      letters += 1;
      typewriterWord.textContent = word.slice(0, letters);

      if (letters >= word.length) {
        clearInterval(typing);
      }
    }, 70);
  }, 2400);
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
