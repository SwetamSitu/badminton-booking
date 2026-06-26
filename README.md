# Full Gardaa Badminton Court Bookings

A simple shared badminton booking portal for the Full Gardaa Badminton Group.

Live site:

https://fullgardaa-badminton.rweb.site/

## What this site does

- View upcoming badminton court bookings.
- Add a new booking manually.
- Add a booking from a Places Leisure screenshot using OCR.
- Edit existing bookings.
- Set booking status as Active, Cancelled, or Completed.
- Cancel active bookings directly from booking cards and keep them in the Archive.
- View past, cancelled, and completed bookings in the Archive.
- Delete bookings with a confirmation popup.
- Prevent duplicate active bookings for the same date, place, time, and court.
- Vote Yes or No in the daily availability poll.
- See who is available and not available.
- View Player Stats for this month and all time.
- Track Yes/No votes, availability percentage, not-voted count, and bookings created.
- Generate a WhatsApp reminder message when there is a booking today.
- Copy or share the WhatsApp reminder with the group.
- Use the site comfortably on mobile and desktop.

## Main sections

### Dashboard

The Dashboard shows the next upcoming active booking availability poll. Players can select their name, choose Yes or No, and submit their vote.

### New Booking

Use this section to add or update a booking. Required details are:

- Booking by
- Place
- Date
- Timing
- Court number
- Booking status

Notes are optional. New bookings are Active by default.

The site prevents duplicate active bookings. If the same date, place, timing, and court already exist as an active booking, the site will ask you to edit the existing booking instead.

### Screenshot Upload

Upload a clear booking screenshot from the Places Leisure app. The site will try to read the date, time, court, and venue automatically.

If screenshot reading fails, add the booking manually.

### Bookings

The Bookings section has two views:

- **Upcoming**: active upcoming bookings.
- **Archive**: past bookings, cancelled bookings, and completed bookings.

You can edit booking details, cancel active bookings, or delete individual bookings from each card. Cancelled bookings and past/completed bookings are kept in the Archive for history, while deleted bookings are permanently removed.

### Stats

The Stats section shows player-level availability and contribution data. It includes Yes votes, No votes, not-voted count, availability percentage, and how many bookings each player created. You can switch between This Month and All Time.

### Help & FAQ

The Help & FAQ button opens a quick guide for using the site.

## Tech used

- HTML
- CSS
- JavaScript
- GitHub Pages
- Google Apps Script
- Google Sheets
- Tesseract.js for screenshot OCR

## Backend

Bookings and poll votes are stored through a Google Apps Script Web App connected to a Google Sheet.

The frontend API endpoint is configured in `script.js`:

```javascript
const API_URL = "https://script.google.com/macros/s/AKfycbwxexiXrszv-I_YV0B8aaxaIg3uNltJ3gPdwCge5Erx5wZ8_g_yjrE0IoT63YKczjTv5w/exec";
```

## Files

```text
index.html
style.css
script.js
README.md
CNAME
apps-script-code.js
```

## How to update the live site

1. Update the files locally or directly in GitHub.
2. Upload/replace the files in the GitHub repository.
3. Commit the changes to the `main` branch.
4. Wait for GitHub Pages deployment to finish.
5. Hard refresh the site on mobile or desktop.

## Notes for the group

Anyone with the link can view, add, edit, delete, and vote. Please edit or delete carefully.

Made with ❤️ by Swetam Meher.


## v1.14 UI refinement

- Improved the mobile availability card heading so the date appears cleanly in the details line.
- Reduced the Yes/No vote option height on mobile for a more compact layout.
