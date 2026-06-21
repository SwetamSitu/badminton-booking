// Replace this with your deployed Google Apps Script Web App URL.
const API_URL = "https://script.google.com/macros/s/AKfycbwxexiXrszv-I_YV0B8aaxaIg3uNltJ3gPdwCge5Erx5wZ8_g_yjrE0IoT63YKczjTv5w/exec";
const PLAYERS = ["Swetam", "Chirag", "Nikhar", "Rohit", "Saikat", "Sworoop", "Ujjval"].sort();
let currentPollBookingId = null;

const form = document.getElementById("bookingForm");
const statusText = document.getElementById("status");
const cards = document.getElementById("bookingCards");
const timingSelect = document.getElementById("timing");
const customTiming = document.getElementById("customTiming");

for (let i = 1; i <= 12; i++) document.getElementById("court").insertAdjacentHTML("beforeend", `<option>Court ${i}</option>`);

timingSelect.addEventListener("change", () => customTiming.classList.toggle("hidden", timingSelect.value !== "Anything else"));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const place = document.querySelector('input[name="place"]:checked')?.value || "";
  const timing = timingSelect.value === "Anything else" ? customTiming.value.trim() : timingSelect.value;
  if (!timing) return setStatus("Please enter the custom timing.");

  const booking = {
    action: "saveBooking",
    id: document.getElementById("id").value || String(Date.now()),
    bookingBy: document.getElementById("bookingBy").value,
    place,
    date: document.getElementById("date").value,
    timing,
    court: document.getElementById("court").value,
    notes: document.getElementById("notes").value.trim()
  };
  setStatus("Saving...");
  const result = await postData(booking);
  if (result.success) { setStatus("Booking saved successfully."); resetForm(); loadAll(); }
  else setStatus(result.message || "Something went wrong.");
});

async function loadAll() {
  cards.innerHTML = `<p class="muted">Loading bookings...</p>`;
  try {
    const response = await fetch(`${API_URL}?action=getAll`);
    const data = await response.json();
    const bookings = (data.bookings || data || []).filter(b => b.id && b.date);
    bookings.sort((a,b) => new Date(a.date) - new Date(b.date));
    renderBookings(bookings);
    renderPoll(bookings, data.polls || []);
  } catch (e) {
    cards.innerHTML = `<p class="muted">Could not load bookings. Check your Apps Script Web App URL.</p>`;
    console.error(e);
  }
}

function renderBookings(bookings) {
  if (!bookings.length) { cards.innerHTML = `<p class="muted">No bookings yet.</p>`; return; }
  cards.innerHTML = bookings.map(b => `
    <article class="booking">
      <div><div class="datePill">${formatDate(b.date)}</div><div class="timePill">${escapeHtml(b.timing)}</div></div>
      <div>
        <h3>${escapeHtml(b.place)} • ${escapeHtml(b.court)}</h3>
        <div class="meta"><span class="chip">By ${escapeHtml(b.bookingBy || b.name || "-")}</span>${b.notes ? `<span class="chip">${escapeHtml(b.notes)}</span>` : ""}</div>
      </div>
      <div class="actions">
        <button class="edit" onclick='editBooking(${safeJson(b)})'>Edit</button>
        <button class="danger" onclick='deleteBooking("${escapeAttr(b.id)}")'>Delete</button>
      </div>
    </article>
  `).join("");
}

function renderPoll(bookings, polls) {
  const today = new Date(); today.setHours(0,0,0,0);
  const next = bookings.find(b => new Date(b.date + "T00:00:00") >= today);
  const pollCard = document.getElementById("pollCard");
  const pollTitle = document.getElementById("pollTitle");
  const pollMeta = document.getElementById("pollMeta");
  const pollGrid = document.getElementById("pollGrid");
  const pollSummary = document.getElementById("pollSummary");
  const pollVoteBox = document.getElementById("pollVoteBox");
  const pollResultLists = document.getElementById("pollResultLists");

  pollCard.classList.remove("hidden");

  if (!next) {
    currentPollBookingId = null;
    pollTitle.textContent = "Daily Availability Poll";
    pollMeta.textContent = "No future booking found. Add a future booking and the poll will appear here automatically.";
    pollSummary.classList.add("hidden");
    pollVoteBox.classList.add("hidden");
    pollResultLists.classList.add("hidden");
    pollGrid.innerHTML = `<p class="muted">No poll available yet.</p>`;
    return;
  }

  currentPollBookingId = next.id;
  pollTitle.textContent = `Availability Poll • ${formatDate(next.date)}`;
  pollMeta.textContent = `${next.place} • ${next.court} • ${next.timing} • Booking by ${next.bookingBy || "-"}`;

  const latest = Object.fromEntries((polls || []).filter(p => String(p.bookingId) === String(next.id)).map(p => [p.player, p.answer]));
  updatePollSummary(latest);
  renderPollVoteForm(latest);
  renderPollResultLists(latest);
  pollGrid.innerHTML = "";
}

function renderPollVoteForm(latest) {
  const pollVoteBox = document.getElementById("pollVoteBox");
  const playerSelect = document.getElementById("pollPlayer");
  const selectedPlayer = playerSelect.value;

  playerSelect.innerHTML = `<option value="">Choose name</option>` + PLAYERS.map(player => `<option value="${player}">${player}</option>`).join("");
  if (selectedPlayer) playerSelect.value = selectedPlayer;

  document.querySelectorAll('input[name="pollAnswer"]').forEach(radio => radio.checked = false);
  if (playerSelect.value && latest[playerSelect.value]) {
    const selectedAnswer = latest[playerSelect.value];
    const radio = document.querySelector(`input[name="pollAnswer"][value="${selectedAnswer}"]`);
    if (radio) radio.checked = true;
  }

  playerSelect.onchange = () => {
    document.querySelectorAll('input[name="pollAnswer"]').forEach(radio => radio.checked = radio.value === latest[playerSelect.value]);
  };

  pollVoteBox.classList.remove("hidden");
}

function renderPollResultLists(latest) {
  const yesPlayers = PLAYERS.filter(player => latest[player] === "Yes");
  const noPlayers = PLAYERS.filter(player => latest[player] === "No");

  document.getElementById("yesNames").innerHTML = yesPlayers.length
    ? yesPlayers.map(name => `<span class="nameChip yesChip">${name}</span>`).join("")
    : `<span class="muted">No Yes votes yet.</span>`;

  document.getElementById("noNames").innerHTML = noPlayers.length
    ? noPlayers.map(name => `<span class="nameChip noChip">${name}</span>`).join("")
    : `<span class="muted">No votes yet.</span>`;

  document.getElementById("pollResultLists").classList.remove("hidden");
}

function updatePollSummary(latest) {
  const pollSummary = document.getElementById("pollSummary");
  const yesCount = Object.values(latest).filter(answer => answer === "Yes").length;
  const noCount = Object.values(latest).filter(answer => answer === "No").length;

  document.getElementById("yesCount").textContent = yesCount;
  document.getElementById("noCount").textContent = noCount;
  pollSummary.classList.remove("hidden");
}

async function submitPollVote() {
  const player = document.getElementById("pollPlayer").value;
  const answer = document.querySelector('input[name="pollAnswer"]:checked')?.value;
  const pollVoteStatus = document.getElementById("pollVoteStatus");

  if (!currentPollBookingId) { pollVoteStatus.textContent = "No active poll found."; return; }
  if (!player) { pollVoteStatus.textContent = "Please select your name."; return; }
  if (!answer) { pollVoteStatus.textContent = "Please select Yes or No."; return; }

  pollVoteStatus.textContent = "Saving vote...";
  const result = await postData({ action: "savePoll", bookingId: currentPollBookingId, player, answer });
  if (result.success) {
    pollVoteStatus.textContent = "Vote saved.";
    loadAll();
  } else {
    pollVoteStatus.textContent = result.message || "Could not save vote.";
  }
}

async function deleteBooking(id) {
  if (!confirm("Delete this booking?")) return;
  const result = await postData({ action: "deleteBooking", id });
  if (result.success) loadAll(); else alert(result.message || "Delete failed.");
}

function editBooking(b) {
  document.getElementById("id").value = b.id;
  document.getElementById("bookingBy").value = b.bookingBy || b.name || "";
  document.querySelectorAll('input[name="place"]').forEach(r => r.checked = r.value === b.place);
  document.getElementById("date").value = toInputDate(b.date);
  const knownTiming = ["6-7PM","7-8PM","8-9PM"].includes(b.timing);
  timingSelect.value = knownTiming ? b.timing : "Anything else";
  customTiming.classList.toggle("hidden", knownTiming);
  customTiming.value = knownTiming ? "" : b.timing;
  document.getElementById("court").value = b.court;
  document.getElementById("notes").value = b.notes || "";
  scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm(){ form.reset(); document.getElementById("id").value=""; customTiming.classList.add("hidden"); }
function setStatus(msg){ statusText.textContent = msg; }
async function postData(payload){ const r = await fetch(API_URL,{method:"POST",body:JSON.stringify(payload)}); return r.json(); }

async function readScreenshot() {
  const file = document.getElementById("screenshotInput").files[0];
  const ocrStatus = document.getElementById("ocrStatus");
  const preview = document.getElementById("ocrPreview");
  if (!file) { ocrStatus.textContent = "Please choose a screenshot first."; return; }
  ocrStatus.textContent = "Reading screenshot... this can take 10-30 seconds.";
  preview.classList.add("hidden");
  try {
    const { data } = await Tesseract.recognize(file, "eng");
    const parsed = parseBookingScreenshot(data.text);
    if (!parsed.length) { ocrStatus.textContent = "Could not read booking details. Please add manually."; preview.textContent = data.text; preview.classList.remove("hidden"); return; }
    preview.innerHTML = parsed.map((b, i) => `<button onclick='fillFromParsed(${safeJson(b)})'>Use booking ${i+1}: ${formatDate(b.date)} • ${b.timing} • ${b.court} • ${b.place}</button>`).join("<br><br>");
    preview.classList.remove("hidden");
    ocrStatus.textContent = `Found ${parsed.length} booking(s). Tap one to fill the form, then choose Booking by and save.`;
  } catch (e) { ocrStatus.textContent = "OCR failed. Please add manually."; console.error(e); }
}

function fillFromParsed(b) {
  document.querySelectorAll('input[name="place"]').forEach(r => r.checked = r.value === b.place);
  document.getElementById("date").value = b.date;
  const knownTiming = ["6-7PM","7-8PM","8-9PM"].includes(b.timing);
  timingSelect.value = knownTiming ? b.timing : "Anything else";
  customTiming.classList.toggle("hidden", knownTiming);
  customTiming.value = knownTiming ? "" : b.timing;
  document.getElementById("court").value = b.court;
  document.getElementById("notes").value = "Added from screenshot";
}

function parseBookingScreenshot(text) {
  const lines = text.split(/\n+/).map(x => x.trim()).filter(Boolean);
  const results = [];
  const monthMap = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
  for (let i=0; i<lines.length; i++) {
    const dateMatch = lines[i].match(/(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})/);
    if (!dateMatch) continue;
    const day = Number(dateMatch[1]), mon = monthMap[dateMatch[2].slice(0,3).toLowerCase()], yr = Number(dateMatch[3]);
    if (mon === undefined) continue;
    const iso = new Date(yr, mon, day).toLocaleDateString("en-CA");
    const block = lines.slice(i, i+8).join(" ");
    const time = (block.match(/(0?[6-9]|1[0-2])[:.]?00\s*(pm|PM|p m)?/) || [])[0] || "";
    const timing = normalizeTime(time);
    const court = (block.match(/Court\s*\d{1,2}/i) || [""])[0].replace(/court/i,"Court");
    const place = /triangle/i.test(block) ? "The Triangle" : (/dolphin/i.test(block) ? "The Dolphin" : "");
    if (iso && timing && court && place) results.push({ date: iso, timing, court, place });
  }
  return results;
}
function normalizeTime(t){ const h = Number((t.match(/\d{1,2}/)||[])[0]); if(h===6)return"6-7PM"; if(h===7)return"7-8PM"; if(h===8)return"8-9PM"; return t.replace(/\s+/g,"").toUpperCase(); }
function formatDate(value){ const d = new Date(toInputDate(value)+"T00:00:00"); return d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"2-digit"}).replace(/ /g,"-"); }
function toInputDate(value){ if(!value)return""; if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value; return new Date(value).toLocaleDateString("en-CA"); }
function escapeHtml(v){ return String(v||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
function escapeAttr(v){ return escapeHtml(v).replaceAll('"', '&quot;'); }
function safeJson(obj){ return JSON.stringify(obj).replaceAll("<","\\u003c").replaceAll("'","&#39;"); }

loadAll();
