// Replace this with your deployed Google Apps Script Web App URL.
const API_URL = "https://script.google.com/macros/s/AKfycbzpUJatBVZ1K8naxNRiIsu8bBuWU7QTUnN8Cd5b0blIe3WcSLn3r2zaKwEAyHVlcv9L8g/exec";

const form = document.getElementById("bookingForm");
const statusText = document.getElementById("status");
const tableBody = document.getElementById("bookingTable");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const booking = {
    id: document.getElementById("id").value || Date.now().toString(),
    name: document.getElementById("name").value.trim(),
    place: document.getElementById("place").value.trim(),
    date: document.getElementById("date").value,
    timing: document.getElementById("timing").value.trim(),
    court: document.getElementById("court").value.trim(),
    players: document.getElementById("players").value.trim(),
    notes: document.getElementById("notes").value.trim()
  };

  statusText.textContent = "Saving...";

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(booking)
    });

    const result = await response.json();

    if (result.success) {
      statusText.textContent = "Booking saved successfully.";
      resetForm();
      loadBookings();
    } else {
      statusText.textContent = "Something went wrong while saving.";
    }
  } catch (error) {
    statusText.textContent = "Error: Please check your Apps Script URL.";
    console.error(error);
  }
});

async function loadBookings() {
  tableBody.innerHTML = `<tr><td colspan="8">Loading...</td></tr>`;

  try {
    const response = await fetch(API_URL);
    const bookings = await response.json();

    if (!bookings.length) {
      tableBody.innerHTML = `<tr><td colspan="8">No bookings yet.</td></tr>`;
      return;
    }

    bookings.sort((a, b) => new Date(a.date) - new Date(b.date));

    tableBody.innerHTML = bookings.map((booking) => `
      <tr>
        <td>${escapeHtml(booking.date)}</td>
        <td>${escapeHtml(booking.timing)}</td>
        <td>${escapeHtml(booking.place)}</td>
        <td>${escapeHtml(booking.court)}</td>
        <td>${escapeHtml(booking.name)}</td>
        <td>${escapeHtml(booking.players || "")}</td>
        <td>${escapeHtml(booking.notes || "")}</td>
        <td><button class="editBtn" onclick='editBooking(${JSON.stringify(booking)})'>Edit</button></td>
      </tr>
    `).join("");
  } catch (error) {
    tableBody.innerHTML = `<tr><td colspan="8">Could not load bookings. Check your Apps Script URL.</td></tr>`;
    console.error(error);
  }
}

function editBooking(booking) {
  document.getElementById("id").value = booking.id;
  document.getElementById("name").value = booking.name;
  document.getElementById("place").value = booking.place;
  document.getElementById("date").value = booking.date;
  document.getElementById("timing").value = booking.timing;
  document.getElementById("court").value = booking.court;
  document.getElementById("players").value = booking.players || "";
  document.getElementById("notes").value = booking.notes || "";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  form.reset();
  document.getElementById("id").value = "";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

loadBookings();
