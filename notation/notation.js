const pitchNames = [
    "C",
    "D",
    "E",
    "F",
    "G",
    "A",
    "B"
];

const lineSpacing = 22;
const staffStep = lineSpacing / 2;

const staff = document.querySelector(".staff");

const notes = [];

staff.addEventListener("click", (event) => {

    if (event.target.classList.contains("note")) {
        return;
    }

    const rect = staff.getBoundingClientRect();

    const x = event.clientX - rect.left;
    const rawY = event.clientY - rect.top;

    // Snap ke garis atau spasi
    const y = Math.round(rawY / staffStep) * staffStep;

    // Tentukan posisi nada pada staff
    // Garis staff paling atas berada sekitar 22px
const topLineY = lineSpacing;

const step = Math.round(
    (y - topLineY) / staffStep
);

// Garis paling atas = F
const pitch = pitchNames[
    ((3 - step) % 7 + 7) % 7
];

    const note = document.createElement("span");

    note.className = "note";
    note.textContent = "";

    note.dataset.pitch = pitch;

    const stem = document.createElement("span");

    stem.className = "stem";

    note.appendChild(stem);

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
