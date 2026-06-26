// Replace this with your deployed Google Apps Script Web App URL.
const API_URL = "https://script.google.com/macros/s/AKfycbwxexiXrszv-I_YV0B8aaxaIg3uNltJ3gPdwCge5Erx5wZ8_g_yjrE0IoT63YKczjTv5w/exec";
const PLAYERS = ["Swetam", "Chirag", "Nikhar", "Rohit", "Saikat", "Sworoop", "Ujjval", "Abhishek"].sort();
let currentPollBookingId = null;
let latestBookings = [];
let bookingListView = "upcoming";
let statsView = "month";
let latestPolls = [];

function showPage(pageId) {
  document.querySelectorAll(".appPage").forEach(page => page.classList.toggle("active", page.id === pageId));
  document.querySelectorAll(".tabBtn").forEach(button => button.classList.toggle("active", button.dataset.page === pageId));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

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
    status: document.getElementById("bookingStatus")?.value || "Active",
    notes: document.getElementById("notes").value.trim()
  };

  setStatus("Checking for duplicate booking...");
  await ensureLatestBookings();
  const duplicate = findDuplicateBooking(booking);
  if (duplicate) {
    const duplicateText = `${formatDate(duplicate.date)} • ${duplicate.place} • ${duplicate.court} • ${duplicate.timing}`;
    setStatus("Duplicate booking found. Please update the existing booking instead.");
    await showAlertDialog(
      "Duplicate booking found",
      `This slot already exists:

${duplicateText}

Please edit the existing booking or choose a different date, time, place, or court.`
    );
    return;
  }

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
    latestBookings = bookings;
    latestPolls = data.polls || [];
    renderBookings(bookings);
    renderPoll(bookings, latestPolls);
    renderWhatsAppReminder(bookings);
    renderPlayerStats(bookings, latestPolls);
  } catch (e) {
    cards.innerHTML = `<p class="muted">Could not load bookings. Check your Apps Script Web App URL.</p>`;
    console.error(e);
  }
}

function setBookingView(view) {
  bookingListView = view === "archive" ? "archive" : "upcoming";
  document.getElementById("upcomingViewBtn")?.classList.toggle("active", bookingListView === "upcoming");
  document.getElementById("archiveViewBtn")?.classList.toggle("active", bookingListView === "archive");
  renderBookings(latestBookings || []);
}

function renderBookings(bookings) {
  const title = document.getElementById("bookingListTitle");
  const description = document.getElementById("bookingListDescription");
  const upcomingBtn = document.getElementById("upcomingViewBtn");
  const archiveBtn = document.getElementById("archiveViewBtn");

  const upcoming = (bookings || [])
    .filter(b => !isArchivedBooking(b))
    .sort((a, b) => new Date(toInputDate(a.date)) - new Date(toInputDate(b.date)) || timeRank(a.timing) - timeRank(b.timing));

  const archive = (bookings || [])
    .filter(isArchivedBooking)
    .sort((a, b) => new Date(toInputDate(b.date)) - new Date(toInputDate(a.date)) || timeRank(a.timing) - timeRank(b.timing));

  const visibleBookings = bookingListView === "archive" ? archive : upcoming;

  if (upcomingBtn) upcomingBtn.innerHTML = `Upcoming <span>${upcoming.length}</span>`;
  if (archiveBtn) archiveBtn.innerHTML = `Archive <span>${archive.length}</span>`;

  if (title) title.textContent = bookingListView === "archive" ? "Booking Archive" : "Upcoming Bookings";
  if (description) {
    description.textContent = bookingListView === "archive"
      ? "Past, cancelled, and completed bookings are stored here."
      : "Manage, edit, or delete your upcoming active court bookings.";
  }

  if (!visibleBookings.length) {
    cards.innerHTML = bookingListView === "archive"
      ? `<div class="emptyState"><strong>No archived bookings yet.</strong><span>Past, cancelled, and completed bookings will appear here automatically.</span></div>`
      : `<div class="emptyState"><strong>No upcoming active bookings.</strong><span>Add a new booking or check the archive for past/cancelled bookings.</span></div>`;
    return;
  }

  cards.innerHTML = visibleBookings.map(b => {
    const status = getDisplayStatus(b);
    const archiveReason = getArchiveReason(b);
    const isArchive = bookingListView === "archive";
    return `
    <article class="booking ${isArchive ? "archivedBooking" : ""} status-${status.toLowerCase()}">
      <div><div class="datePill">${formatDate(b.date)}</div><div class="timePill">${escapeHtml(b.timing)}</div></div>
      <div>
        <h3>${escapeHtml(b.place)} • ${escapeHtml(b.court)}</h3>
        <div class="meta">
          <span class="chip">By ${escapeHtml(b.bookingBy || b.name || "-")}</span>
          <span class="chip statusChip statusChip-${status.toLowerCase()}">${escapeHtml(status)}</span>
          ${isArchive && archiveReason ? `<span class="chip archiveChip">${escapeHtml(archiveReason)}</span>` : ""}
          ${b.notes ? `<span class="chip">${escapeHtml(b.notes)}</span>` : ""}
        </div>
      </div>
      <div class="actions">
        <button class="edit" onclick='editBooking(${safeJson(b)})'>Edit</button>
        <button class="danger" onclick='deleteBooking("${escapeAttr(b.id)}")'>Delete</button>
      </div>
    </article>`;
  }).join("");
}

function renderPoll(bookings, polls) {
  const today = new Date(); today.setHours(0,0,0,0);
  const next = bookings.find(b => isActiveBooking(b) && new Date(toInputDate(b.date) + "T00:00:00") >= today);
  const pollCard = document.getElementById("pollCard");
  const pollTitle = document.getElementById("pollTitle");
  const pollMeta = document.getElementById("pollMeta");
  const pollGrid = document.getElementById("pollGrid");
  const pollSummary = document.getElementById("pollSummary");
  const pollVoteBox = document.getElementById("pollVoteBox");
  const pollResultLists = document.getElementById("pollResultLists");
  const pollEyebrow = document.getElementById("pollEyebrow");

  pollCard.classList.remove("hidden");

  if (!next) {
    currentPollBookingId = null;
    if (pollEyebrow) pollEyebrow.textContent = "🏸 Next Availability";
    pollTitle.textContent = "Next Availability";
    pollMeta.textContent = "No future active booking found. Add a future booking and the poll will appear here automatically.";
    pollSummary.classList.add("hidden");
    pollVoteBox.classList.add("hidden");
    pollResultLists.classList.add("hidden");
    pollGrid.innerHTML = `<p class="muted">No poll available yet.</p>`;
    return;
  }

  const nextDate = new Date(toInputDate(next.date) + "T00:00:00");
  const isTodayPoll = nextDate.getTime() === today.getTime();
  const availabilityLabel = isTodayPoll ? "Today's Availability" : "Next Availability";

  currentPollBookingId = next.id;
  if (pollEyebrow) pollEyebrow.textContent = `🏸 ${availabilityLabel}`;
  pollTitle.textContent = `${availabilityLabel} • ${formatDate(next.date)}`;
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

function renderWhatsAppReminder(bookings) {
  const meta = document.getElementById("whatsappReminderMeta");
  const box = document.getElementById("whatsappReminderBox");
  const textArea = document.getElementById("whatsappReminderText");
  const shareBtn = document.getElementById("whatsappShareBtn");
  const copyStatus = document.getElementById("whatsappCopyStatus");

  if (!meta || !box || !textArea || !shareBtn) return;
  if (copyStatus) copyStatus.textContent = "";

  const now = new Date();
  const todayIso = now.toLocaleDateString("en-CA");
  const todayBookings = (bookings || [])
    .filter(b => isActiveBooking(b) && toInputDate(b.date) === todayIso)
    .sort((a, b) => timeRank(a.timing) - timeRank(b.timing));

  if (!todayBookings.length) {
    box.classList.add("hidden");
    meta.textContent = "No booking found for today. The WhatsApp reminder button will appear here on booking days after 7 AM.";
    return;
  }

  if (now.getHours() < 7) {
    box.classList.add("hidden");
    meta.textContent = `There is a booking today. The WhatsApp reminder button will appear after 7 AM.`;
    return;
  }

  const reminderText = buildWhatsAppReminderText(todayBookings);
  textArea.value = reminderText;
  shareBtn.href = `https://wa.me/?text=${encodeURIComponent(reminderText)}`;
  meta.textContent = `Reminder ready for today's booking${todayBookings.length > 1 ? "s" : ""}. Tap the button and choose your WhatsApp group.`;
  box.classList.remove("hidden");
}

function buildWhatsAppReminderText(bookings) {
  const siteUrl = "https://fullgardaa-badminton.rweb.site/";
  const bookingLines = bookings.map((b, index) => {
    const prefix = bookings.length > 1 ? `${index + 1}. ` : "";
    return `${prefix}📅 ${formatDate(b.date)}\n📍 ${b.place}\n🏟️ ${b.court}\n⏰ ${b.timing}\n👤 Booked by: ${b.bookingBy || "-"}`;
  }).join("\n\n");

  return `🏸 Badminton Availability Reminder\n\nWe have a court booking today. Please vote Yes/No.\n\n${bookingLines}\n\nVote here:\n${siteUrl}`;
}

async function copyWhatsAppReminder() {
  const text = document.getElementById("whatsappReminderText")?.value || "";
  const status = document.getElementById("whatsappCopyStatus");
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    if (status) status.textContent = "Message copied.";
  } catch (e) {
    if (status) status.textContent = "Could not copy automatically. Please select the text and copy it manually.";
  }
}


function setStatsView(view) {
  statsView = view === "all" ? "all" : "month";
  document.getElementById("statsMonthBtn")?.classList.toggle("active", statsView === "month");
  document.getElementById("statsAllTimeBtn")?.classList.toggle("active", statsView === "all");
  renderPlayerStats(latestBookings || [], latestPolls || []);
}

function renderPlayerStats(bookings = [], polls = []) {
  const overview = document.getElementById("statsOverview");
  const highlights = document.getElementById("statsHighlights");
  const grid = document.getElementById("playerStatsGrid");
  const description = document.getElementById("statsDescription");
  if (!overview || !highlights || !grid) return;

  const now = new Date();
  const periodLabel = statsView === "month"
    ? now.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    : "All Time";

  const periodBookings = (bookings || []).filter(booking => {
    if (!booking || !booking.id || !booking.date) return false;
    if (statsView === "all") return true;
    const date = new Date(toInputDate(booking.date) + "T00:00:00");
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });

  const pollEligibleBookings = periodBookings.filter(booking => normalizeStatus(booking.status) !== "Cancelled");
  const eligibleIds = new Set(pollEligibleBookings.map(booking => String(booking.id)));
  const latestVoteByBookingPlayer = {};

  (polls || []).forEach(poll => {
    const bookingId = String(poll.bookingId || "");
    const player = normalizePlayerName(poll.player);
    const answer = normalizePollAnswer(poll.answer);
    if (!eligibleIds.has(bookingId) || !player || !answer) return;
    latestVoteByBookingPlayer[`${bookingId}|${player}`] = answer;
  });

  const stats = PLAYERS.map(player => ({
    player,
    yes: 0,
    no: 0,
    votes: 0,
    missed: 0,
    bookingsCreated: 0,
    availability: 0
  }));

  const statsByPlayer = Object.fromEntries(stats.map(item => [item.player, item]));

  Object.entries(latestVoteByBookingPlayer).forEach(([key, answer]) => {
    const player = key.split("|")[1];
    const playerStats = statsByPlayer[player];
    if (!playerStats) return;
    if (answer === "Yes") playerStats.yes += 1;
    if (answer === "No") playerStats.no += 1;
  });

  periodBookings.forEach(booking => {
    const player = normalizePlayerName(booking.bookingBy || booking.name);
    if (player && statsByPlayer[player]) statsByPlayer[player].bookingsCreated += 1;
  });

  stats.forEach(playerStats => {
    playerStats.votes = playerStats.yes + playerStats.no;
    playerStats.missed = Math.max(0, pollEligibleBookings.length - playerStats.votes);
    playerStats.availability = playerStats.votes ? Math.round((playerStats.yes / playerStats.votes) * 100) : 0;
  });

  const totalYes = stats.reduce((sum, player) => sum + player.yes, 0);
  const totalNo = stats.reduce((sum, player) => sum + player.no, 0);
  const totalBookings = periodBookings.length;
  const completedBookings = periodBookings.filter(booking => getDisplayStatus(booking) === "Completed").length;
  const activeBookings = periodBookings.filter(booking => getDisplayStatus(booking) === "Active").length;
  const cancelledBookings = periodBookings.filter(booking => normalizeStatus(booking.status) === "Cancelled").length;

  if (description) {
    description.textContent = statsView === "month"
      ? `Stats for ${periodLabel}: availability votes, missed votes, and bookings created.`
      : "All-time availability votes, missed votes, and bookings created.";
  }

  overview.innerHTML = `
    <div class="statsOverviewCard"><span>Period</span><strong>${escapeHtml(periodLabel)}</strong></div>
    <div class="statsOverviewCard"><span>Bookings</span><strong>${totalBookings}</strong></div>
    <div class="statsOverviewCard yesStat"><span>Total Yes</span><strong>${totalYes}</strong></div>
    <div class="statsOverviewCard noStat"><span>Total No</span><strong>${totalNo}</strong></div>
    <div class="statsOverviewCard"><span>Active</span><strong>${activeBookings}</strong></div>
    <div class="statsOverviewCard"><span>Completed</span><strong>${completedBookings}</strong></div>
    <div class="statsOverviewCard"><span>Cancelled</span><strong>${cancelledBookings}</strong></div>
  `;

  const topAvailable = [...stats]
    .filter(player => player.votes > 0)
    .sort((a, b) => b.yes - a.yes || b.availability - a.availability || a.player.localeCompare(b.player))[0];
  const topBooker = [...stats]
    .filter(player => player.bookingsCreated > 0)
    .sort((a, b) => b.bookingsCreated - a.bookingsCreated || a.player.localeCompare(b.player))[0];
  const mostMissed = [...stats]
    .filter(player => player.missed > 0 && pollEligibleBookings.length > 0)
    .sort((a, b) => b.missed - a.missed || a.player.localeCompare(b.player))[0];

  highlights.innerHTML = `
    <div class="highlightCard">
      <span>🏆 Most Available</span>
      <strong>${topAvailable ? escapeHtml(topAvailable.player) : "No votes yet"}</strong>
      <small>${topAvailable ? `${topAvailable.yes} Yes • ${topAvailable.availability}%` : "Vote data will appear here."}</small>
    </div>
    <div class="highlightCard">
      <span>📌 Most Bookings Created</span>
      <strong>${topBooker ? escapeHtml(topBooker.player) : "No bookings yet"}</strong>
      <small>${topBooker ? `${topBooker.bookingsCreated} booking${topBooker.bookingsCreated === 1 ? "" : "s"}` : "Booking data will appear here."}</small>
    </div>
    <div class="highlightCard">
      <span>⏳ Most Missed Votes</span>
      <strong>${mostMissed ? escapeHtml(mostMissed.player) : "No missed votes"}</strong>
      <small>${mostMissed ? `${mostMissed.missed} missed` : "Everyone is up to date for this period."}</small>
    </div>
  `;

  if (!periodBookings.length) {
    grid.innerHTML = `<div class="emptyState"><strong>No player stats yet.</strong><span>Add bookings and votes to see player stats for this period.</span></div>`;
    return;
  }

  grid.innerHTML = stats
    .sort((a, b) => b.yes - a.yes || b.bookingsCreated - a.bookingsCreated || a.player.localeCompare(b.player))
    .map(player => renderPlayerStatCard(player, pollEligibleBookings.length))
    .join("");
}

function renderPlayerStatCard(playerStats, eligibleBookingCount) {
  const percent = playerStats.votes ? playerStats.availability : 0;
  const voteLabel = playerStats.votes ? `${playerStats.yes} Yes / ${playerStats.no} No` : "No votes yet";
  const progressWidth = Math.max(0, Math.min(100, percent));

  return `
    <article class="playerStatCard">
      <div class="playerStatTop">
        <div>
          <strong>${escapeHtml(playerStats.player)}</strong>
          <span>${escapeHtml(voteLabel)}</span>
        </div>
        <div class="availabilityBadge">${playerStats.votes ? `${percent}%` : "—"}</div>
      </div>
      <div class="statProgress" aria-label="Availability ${percent}%">
        <span style="width:${progressWidth}%"></span>
      </div>
      <div class="playerStatMetrics">
        <span class="yesMetric">Yes <b>${playerStats.yes}</b></span>
        <span class="noMetric">No <b>${playerStats.no}</b></span>
        <span>Missed <b>${eligibleBookingCount ? playerStats.missed : 0}</b></span>
        <span>Booked <b>${playerStats.bookingsCreated}</b></span>
      </div>
    </article>`;
}

function normalizePlayerName(name) {
  const raw = String(name || "").trim().toLowerCase();
  return PLAYERS.find(player => player.toLowerCase() === raw) || "";
}

function normalizePollAnswer(answer) {
  const value = String(answer || "").trim().toLowerCase();
  if (value === "yes") return "Yes";
  if (value === "no") return "No";
  return "";
}

function timeRank(timing) {
  const text = String(timing || "").toUpperCase();
  if (text.includes("6-7")) return 1;
  if (text.includes("7-8")) return 2;
  if (text.includes("8-9")) return 3;
  const hour = Number((text.match(/\d{1,2}/) || [99])[0]);
  return Number.isFinite(hour) ? hour : 99;
}

async function deleteBooking(id) {
  const booking = (latestBookings || []).find(item => String(item.id) === String(id));
  const bookingText = booking
    ? `${formatDate(booking.date)} • ${booking.place} • ${booking.court} • ${booking.timing} • ${normalizeStatus(booking.status)}`
    : "this booking";

  const confirmed = await showConfirmDialog({
    title: "Delete booking?",
    message: `Are you sure you want to delete ${bookingText}? This action cannot be undone.`,
    confirmText: "Yes, Delete",
    cancelText: "Cancel",
    danger: true
  });

  if (!confirmed) return;

  const result = await postData({ action: "deleteBooking", id });
  if (result.success) loadAll(); else alert(result.message || "Delete failed.");
}

async function deletePastBookings() {
  const deleteStatus = document.getElementById("deletePastStatus");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pastBookings = (latestBookings || []).filter(booking => {
    const bookingDate = new Date(toInputDate(booking.date) + "T00:00:00");
    return bookingDate < today;
  });

  if (!pastBookings.length) {
    if (deleteStatus) deleteStatus.textContent = "No past bookings found.";
    else alert("No past bookings found.");
    return;
  }

  const confirmed = await showConfirmDialog({
    title: "Delete past bookings?",
    message: `You are about to delete ${pastBookings.length} past booking${pastBookings.length > 1 ? "s" : ""}. This action cannot be undone.`,
    confirmText: "Delete Past Bookings",
    cancelText: "Cancel",
    danger: true
  });

  if (!confirmed) return;

  if (deleteStatus) deleteStatus.textContent = "Deleting past bookings...";

  try {
    const results = await Promise.all(pastBookings.map(booking =>
      postData({ action: "deleteBooking", id: booking.id })
    ));

    const failed = results.filter(result => !result.success);
    if (failed.length) {
      if (deleteStatus) deleteStatus.textContent = `${failed.length} booking${failed.length > 1 ? "s" : ""} could not be deleted.`;
      alert(`${failed.length} booking${failed.length > 1 ? "s" : ""} could not be deleted. Please try again.`);
    } else if (deleteStatus) {
      deleteStatus.textContent = "Past bookings deleted successfully.";
    }

    loadAll();
  } catch (e) {
    console.error(e);
    if (deleteStatus) deleteStatus.textContent = "Delete failed. Please try again.";
    else alert("Delete failed. Please try again.");
  }
}


function normalizeStatus(status) {
  const value = String(status || "Active").trim().toLowerCase();
  if (value === "cancelled" || value === "canceled") return "Cancelled";
  if (value === "completed" || value === "complete") return "Completed";
  return "Active";
}

function getBookingDateOnly(booking) {
  const bookingDate = new Date(toInputDate(booking.date) + "T00:00:00");
  bookingDate.setHours(0, 0, 0, 0);
  return bookingDate;
}

function getTodayOnly() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function isPastBooking(booking) {
  return getBookingDateOnly(booking) < getTodayOnly();
}

function getDisplayStatus(booking) {
  const status = normalizeStatus(booking.status);
  if (status === "Cancelled") return "Cancelled";
  if (status === "Completed") return "Completed";
  return isPastBooking(booking) ? "Completed" : "Active";
}

function isActiveBooking(booking) {
  return getDisplayStatus(booking) === "Active";
}

function isArchivedBooking(booking) {
  return isPastBooking(booking) || normalizeStatus(booking.status) !== "Active";
}

function getArchiveReason(booking) {
  const savedStatus = normalizeStatus(booking.status);
  const displayStatus = getDisplayStatus(booking);

  if (bookingListView !== "archive") return "";
  if (savedStatus === "Active" && displayStatus === "Completed") return "Auto-archived";
  return "";
}

function normalizeBookingPart(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
}

function bookingSignature(booking) {
  return [
    toInputDate(booking.date),
    normalizeBookingPart(booking.place),
    normalizeBookingPart(booking.timing),
    normalizeBookingPart(booking.court)
  ].join("|");
}

function findDuplicateBooking(booking) {
  const currentSignature = bookingSignature(booking);
  if (!currentSignature || currentSignature.includes("||")) return null;

  return (latestBookings || []).find(existing => {
    if (!existing || !existing.id) return false;
    if (String(existing.id) === String(booking.id)) return false;
    if (!isActiveBooking(existing)) return false;
    return bookingSignature(existing) === currentSignature;
  }) || null;
}

async function ensureLatestBookings() {
  try {
    const response = await fetch(`${API_URL}?action=getAll`);
    const data = await response.json();
    latestBookings = (data.bookings || data || []).filter(b => b.id && b.date);
  } catch (error) {
    console.warn("Could not refresh bookings before duplicate check. Using currently loaded bookings.", error);
  }

  return latestBookings || [];
}

let activeConfirmDialog = null;

function showAlertDialog(title, message) {
  return showConfirmDialog({
    title,
    message,
    confirmText: "OK",
    showCancel: false,
    danger: false
  });
}

function showConfirmDialog({
  title = "Are you sure?",
  message = "Please confirm this action.",
  confirmText = "Confirm",
  cancelText = "Cancel",
  danger = false,
  showCancel = true
} = {}) {
  const overlay = document.getElementById("confirmOverlay");
  const titleEl = document.getElementById("confirmTitle");
  const messageEl = document.getElementById("confirmMessage");
  const confirmBtn = document.getElementById("confirmActionBtn");
  const cancelBtn = document.getElementById("confirmCancelBtn");

  if (!overlay || !titleEl || !messageEl || !confirmBtn || !cancelBtn) {
    return Promise.resolve(window.confirm(message));
  }

  return new Promise(resolve => {
    const close = result => {
      overlay.classList.add("hidden");
      document.body.classList.remove("modalOpen");
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
      overlay.removeEventListener("click", onOverlayClick);
      activeConfirmDialog = null;
      resolve(result);
    };

    const onConfirm = () => close(true);
    const onCancel = () => close(false);
    const onOverlayClick = event => {
      if (event.target === overlay) close(false);
    };

    titleEl.textContent = title;
    messageEl.textContent = message;
    confirmBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;

    confirmBtn.classList.toggle("danger", danger);
    confirmBtn.classList.toggle("primaryConfirm", !danger);
    cancelBtn.classList.toggle("hidden", !showCancel);

    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
    overlay.addEventListener("click", onOverlayClick);

    overlay.classList.remove("hidden");
    document.body.classList.add("modalOpen");
    activeConfirmDialog = { close };
    setTimeout(() => confirmBtn.focus(), 0);
  });
}

function closeActiveConfirmDialog(result = false) {
  if (activeConfirmDialog) activeConfirmDialog.close(result);
}

function editBooking(b) {
  document.getElementById("id").value = b.id;
  const formTitle = document.getElementById("bookingFormTitle");
  if (formTitle) formTitle.textContent = "Edit Booking";
  document.getElementById("bookingBy").value = b.bookingBy || b.name || "";
  document.querySelectorAll('input[name="place"]').forEach(r => r.checked = r.value === b.place);
  document.getElementById("date").value = toInputDate(b.date);
  const knownTiming = ["6-7PM","7-8PM","8-9PM"].includes(b.timing);
  timingSelect.value = knownTiming ? b.timing : "Anything else";
  customTiming.classList.toggle("hidden", knownTiming);
  customTiming.value = knownTiming ? "" : b.timing;
  document.getElementById("court").value = b.court;
  const statusSelect = document.getElementById("bookingStatus");
  if (statusSelect) statusSelect.value = normalizeStatus(b.status);
  document.getElementById("notes").value = b.notes || "";
  showPage("managePage");
}

function resetForm(){
  form.reset();
  document.getElementById("id").value="";
  customTiming.classList.add("hidden");
  const statusSelect = document.getElementById("bookingStatus");
  if (statusSelect) statusSelect.value = "Active";
  const formTitle = document.getElementById("bookingFormTitle");
  if (formTitle) formTitle.textContent = "New Booking";
}
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
  showPage("managePage");
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
function formatDate(value){ const d = new Date(toInputDate(value)+"T00:00:00"); return d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}).replace(/ /g,"-"); }
function toInputDate(value){ if(!value)return""; if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value; return new Date(value).toLocaleDateString("en-CA"); }
function escapeHtml(v){ return String(v||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
function escapeAttr(v){ return escapeHtml(v).replaceAll('"', '&quot;'); }
function safeJson(obj){ return JSON.stringify(obj).replaceAll("<","\\u003c").replaceAll("'","&#39;"); }


function toggleHelpPanel() {
  const panel = document.getElementById("helpPanel");
  if (panel && panel.classList.contains("open")) {
    closeHelpPanel();
  } else {
    openHelpPanel();
  }
}

function setHelpButtonState(isOpen) {
  const btn = document.getElementById("helpFloatingBtn");
  if (!btn) return;
  btn.innerHTML = isOpen ? "✕ Close" : "❓ Help";
  btn.setAttribute("aria-label", isOpen ? "Close help section" : "Open help section");
  btn.classList.toggle("helpIsOpen", isOpen);
}

function openHelpPanel() {
  const panel = document.getElementById("helpPanel");
  const overlay = document.getElementById("helpOverlay");
  if (!panel || !overlay) return;
  panel.classList.add("open");
  panel.setAttribute("aria-hidden", "false");
  overlay.classList.remove("hidden");
  document.body.classList.add("helpOpen");
  setHelpButtonState(true);
}

function closeHelpPanel() {
  const panel = document.getElementById("helpPanel");
  const overlay = document.getElementById("helpOverlay");
  if (!panel || !overlay) return;
  panel.classList.remove("open");
  panel.setAttribute("aria-hidden", "true");
  overlay.classList.add("hidden");
  document.body.classList.remove("helpOpen");
  setHelpButtonState(false);
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeHelpPanel();
    closeActiveConfirmDialog(false);
  }
});


async function refreshPollWithLoading(button) {
  const refreshButton = button || document.querySelector(".pollRefreshBtn");
  if (!refreshButton) {
    await loadAll();
    return;
  }

  const originalHtml = refreshButton.innerHTML;
  refreshButton.disabled = true;
  refreshButton.classList.add("isLoading");
  refreshButton.innerHTML = '<span class="refreshSpinner" aria-hidden="true"></span><span class="refreshText">Updating...</span>';

  try {
    await loadAll();
  } catch (error) {
    console.error("Refresh failed", error);
  } finally {
    refreshButton.disabled = false;
    refreshButton.classList.remove("isLoading");
    refreshButton.innerHTML = originalHtml;
  }
}

async function refreshLiveListWithLoading(button) {
  const refreshButton = button || document.querySelector(".liveRefreshBtn");
  if (!refreshButton) {
    await loadAll();
    return;
  }

  const originalHtml = refreshButton.innerHTML;
  refreshButton.disabled = true;
  refreshButton.classList.add("isLoading");
  refreshButton.innerHTML = '<span class="refreshSpinner" aria-hidden="true"></span><span class="refreshText">Updating...</span>';

  try {
    await loadAll();
  } catch (error) {
    console.error("Live list refresh failed", error);
  } finally {
    refreshButton.disabled = false;
    refreshButton.classList.remove("isLoading");
    refreshButton.innerHTML = originalHtml;
  }
}

loadAll();
