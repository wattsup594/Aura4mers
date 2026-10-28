
"use strict";

// Store reports in the browser.
const STORAGE_KEY = "lost-found-reports-v1";

// Sample items to display.
const defaultItems = [
  {
    id: "demo-1",
    name: "Black Backpack",
    type: "found",
    date: "2025-10-10",
    location: "Student Center",
    description: "Black backpack with multiple pockets.",
    icon: "🎒",
    email: ""
  },
  {
    id: "demo-2",
    name: "iPhone 14",
    type: "lost",
    date: "2025-10-09",
    location: "Library",
    description: "Phone with a dark case.",
    icon: "📱",
    email: ""
  },
  {
    id: "demo-3",
    name: "Blue Water Bottle",
    type: "found",
    date: "2025-10-08",
    location: "Dining Hall",
    description: "Reusable blue water bottle.",
    icon: "🧴",
    email: ""
  },
  {
    id: "demo-4",
    name: "Keys",
    type: "lost",
    date: "2025-10-07",
    location: "Parking Lot",
    description: "Small keyring lost near the parking lot.",
    icon: "🔑",
    email: ""
  }
];

// Get previously saved reports.
function savedReports() {
  try {
    const stored = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );

    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    return [];
  }
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

// Format dates for display.
function formatDate(value) {
  const date = new Date(value + "T12:00:00");

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

// Create the item cards on the homepage.
function renderItems() {
  const grid = document.querySelector("#item-grid");

  // Only the homepage has an item grid.
  if (!grid) {
    return;
  }

  const query = document.querySelector("#search-items")
    .value.trim().toLowerCase();

  const type = document.querySelector("#filter-type").value;

  const items = [
    ...savedReports().reverse(),
    ...defaultItems
  ];

  const filteredItems = items.filter(item => {
    const matchesType =
      type === "all" || item.type === type;

    const searchText = (
      item.name + " " +
      item.location + " " +
      item.description
    ).toLowerCase();

    return matchesType && searchText.includes(query);
  });

  // Clear previous cards.
  grid.replaceChildren();

  document.querySelector("#item-count").textContent =
    filteredItems.length + " items";

  document.querySelector("#empty-state").hidden =
    filteredItems.length > 0;

  // Create a card for each item.
  filteredItems.forEach(item => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "item-card";

    const art = document.createElement("span");
    art.className = "item-art";
    art.textContent = item.icon || itemIcon(item.name);

    const body = document.createElement("span");
    body.className = "item-body";

    const title = document.createElement("strong");
    title.textContent = item.name;

    const status = document.createElement("span");
    status.className = "status " + item.type;
    status.textContent =
      item.type === "found" ? "Found" : "Lost";

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
        item.name + "\n\n" +
        item.type.toUpperCase() + "\n" +
        "Date: " + formatDate(item.date) + "\n" +
        "Location: " + item.location + "\n\n" +
        item.description + "\n\n" +
        contact
      );
    });

    grid.append(card);
  });
}

// Mobile navigation menu.
const menuButton = document.querySelector(".menu-toggle");
const nav = document.querySelector(".nav-links");

if (menuButton && nav) {
  menuButton.addEventListener("click", () => {
    const opened = nav.classList.toggle("open");

    menuButton.setAttribute(
      "aria-expanded",
      String(opened)
    );
  });
}

// Automatically update footer year.
document.querySelectorAll(".year").forEach(year => {
  year.textContent = new Date().getFullYear();
});

// Report item form.
const dialog = document.querySelector("#report-dialog");
const reportForm = document.querySelector("#report-form");

// Open the report dialog.
document.querySelectorAll(".report-trigger").forEach(button => {
  button.addEventListener("click", () => {
    if (dialog && reportForm) {
      reportForm.reset();

      const dateField = reportForm.querySelector(
        '[name="date"]'
      );

      if (dateField) {
        dateField.value = new Date()
          .toLocaleDateString("en-CA");
      }

      dialog.showModal();
    }
  });
});

// Close the report dialog.
const closeButton = document.querySelector(".close-dialog");

if (closeButton && dialog) {
  closeButton.addEventListener("click", () => {
    dialog.close();
  });

  dialog.addEventListener("click", event => {
    if (event.target === dialog) {
      dialog.close();
    }
  });
}

// Save newly reported items.
if (reportForm) {
  reportForm.addEventListener("submit", event => {
    event.preventDefault();

    const data = new FormData(reportForm);

    const report = {
      id: String(Date.now()),
      type: String(data.get("type")),
      name: String(data.get("name")).trim(),
      location: String(data.get("location")).trim(),
      date: String(data.get("date")),
      description: String(data.get("description")).trim(),
      email: String(data.get("email")).trim()
    };

    if (
      !report.name ||
      !report.location ||
      !report.description ||
      !report.email
    ) {
      return;
    }

    try {
      const reports = savedReports();

      reports.push(report);

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(reports)
      );

      reportForm.reset();
      dialog.close();

      if (document.body.dataset.page === "home") {
        document.querySelector("#search-items").value = "";
        document.querySelector("#filter-type").value = "all";

        renderItems();

        document.querySelector("#recent-items")
          .scrollIntoView({ behavior: "smooth" });
      } else {
        window.location.href = "index.html#recent-items";
      }
    } catch (error) {
      document.querySelector("#report-feedback").textContent =
        "Could not save the report.";
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

// Display reports when the homepage opens.
renderItems();

// Contact form demonstration.
const contactForm = document.querySelector("#contact-form");

if (contactForm) {
  contactForm.addEventListener("submit", event => {
    event.preventDefault();

    const feedback = document.querySelector(
      "#contact-feedback"
    );

    feedback.textContent =
      "Your form is complete! This demo does not " +
      "have an email service connected, so your " +
      "message has not been sent.";
  });
}
