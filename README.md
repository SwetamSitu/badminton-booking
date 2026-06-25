# Full Gardaa Badminton Court Bookings

A simple shared badminton booking portal for the Full Gardaa Badminton Group.

Live site:

https://swetamsitu.github.io/badminton-booking/

## What this site does

- View upcoming badminton court bookings.
- Add a new booking manually.
- Add a booking from a Places Leisure screenshot using OCR.
- Edit existing bookings.
- Delete bookings with a confirmation popup.
- Prevent duplicate bookings for the same date, place, time, and court.
- Vote Yes or No in the daily availability poll.
- See who is available and not available.
- Generate a WhatsApp reminder message for today's booking.
- Copy or share the WhatsApp reminder with the group.
- Use the site comfortably on mobile and desktop.

## Main sections

### Dashboard

The Dashboard shows today's or the next upcoming availability poll. Players can select their name, choose Yes or No, and submit their vote.

### New Booking

Use this section to add or update a booking. Required details are:

- Booking by
- Place
- Date
- Timing
- Court number

Notes are optional.

The site prevents duplicate bookings. If the same date, place, timing, and court already exist, the site will ask you to edit the existing booking instead.

### Screenshot Upload

Upload a clear booking screenshot from the Places Leisure app. The site will try to read the date, time, court, and venue automatically.

If screenshot reading fails, add the booking manually.

### Bookings

The Bookings section shows the live booking list. You can edit or delete bookings from each booking card.

Past bookings can also be deleted using the Delete Past Bookings button.

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
