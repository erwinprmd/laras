const pitchNames = [
    "C",
    "D",
    "E",
    "F",
    "G",
    "A",
    "B"
];

const staffStep = 11;

const staff = document.querySelector(".staff");

const notes = [];

staff.addEventListener("click", (event) => {

    if (event.target.classList.contains("note")) {
        return;
    }

    const rect = staff.getBoundingClientRect();

    const x = event.clientX - rect.left;
const rawY = event.clientY - rect.top;

// Jarak antar garis staff
const lineSpacing = 22;

// Snap ke garis atau spasi
const y = Math.round(rawY / (lineSpacing / 2)) * (lineSpacing / 2);
    const step = Math.round(y / staffStep);

const pitch = pitchNames[
    ((-step % 7) + 7) % 7
];

    const note = document.createElement("span");

    note.className = "note";
    note.textContent = "";
    note.dataset.pitch = pitch;

    note.style.left = `${x}px`;
    note.style.top = `${y}px`;

    staff.appendChild(note);

    notes.push({
    x,
    y,
    pitch
});

    console.log("Note added:", {
    x,
    y,
    pitch
});

});
