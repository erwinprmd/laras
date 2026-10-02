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

let selectedDuration = "quarter";

let draggedNote = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let suppressClickUntil = 0;
let hasDragged = false;

const durationButtons = document.querySelectorAll(
    "[data-duration]"
);

durationButtons.forEach(button => {

    button.addEventListener("click", () => {

        selectedDuration =
            button.dataset.duration;

        console.log(
            "Duration selected:",
            selectedDuration
        );

    });

});
// =========================
// CLICK STAFF / NOTE
// =========================

staff.addEventListener("click", (event) => {

    // Abaikan click otomatis setelah drag
    if (Date.now() < suppressClickUntil) {
        return;
    }

    // Klik note = hapus note
    if (event.target.closest(".note")) {

        const noteElement = event.target.closest(".note");

        const index = notes.findIndex(
            note => note.element === noteElement
        );

        if (index !== -1) {
            notes.splice(index, 1);
        }

        noteElement.remove();

        console.log("Note removed");

        return;
    }

    const rect = staff.getBoundingClientRect();

    const x = event.clientX - rect.left;
    const rawY = event.clientY - rect.top;

    // Snap ke garis atau spasi
    const y = Math.round(rawY / staffStep) * staffStep;

    // Garis staff paling atas berada di 22px
    const topLineY = lineSpacing;

    const step = Math.round(
        (y - topLineY) / staffStep
    );

    // Garis paling atas = F
    const pitch = pitchNames[
        ((3 - step) % 7 + 7) % 7
    ];

    const note = document.createElement("span");

    note.className = `note ${selectedDuration}`;
    note.textContent = "";

    note.dataset.pitch = pitch;

    const stem = document.createElement("span");

stem.className = "stem";

note.appendChild(stem);

if (selectedDuration === "eighth") {

    const flag = document.createElement("span");

    flag.className = "flag";

    stem.appendChild(flag);

}

    note.style.left = `${x}px`;
    note.style.top = `${y}px`;

    staff.appendChild(note);

    notes.push({
    x,
    y,
    pitch,
    duration: selectedDuration,
    element: note
});

    console.log("Note added:", {
    x,
    y,
    pitch,
    duration: selectedDuration
});

});


// =========================
// START DRAG
// =========================

staff.addEventListener("pointerdown", (event) => {

    const noteElement = event.target.closest(".note");

    if (!noteElement) {
        return;
    }

    draggedNote = noteElement;
    hasDragged = false;

    const rect = noteElement.getBoundingClientRect();

    dragOffsetX = event.clientX - rect.left;
    dragOffsetY = event.clientY - rect.top;

    draggedNote.setPointerCapture(event.pointerId);

});


// =========================
// DRAG NOTE
// =========================

staff.addEventListener("pointermove", (event) => {

    if (!draggedNote) {
        return;
    }
    hasDragged = true;

    const staffRect = staff.getBoundingClientRect();

    const x =
        event.clientX -
        staffRect.left -
        dragOffsetX;

    const rawY =
        event.clientY -
        staffRect.top -
        dragOffsetY;

    const y =
        Math.round(rawY / staffStep) *
        staffStep;

    draggedNote.style.left = `${x}px`;
    draggedNote.style.top = `${y}px`;

});


// =========================
// END DRAG
// =========================

staff.addEventListener("pointerup", (event) => {

    if (!draggedNote) {
        return;
    }

    const noteElement = draggedNote;

    const x = parseFloat(
        noteElement.style.left
    );

    const y = parseFloat(
        noteElement.style.top
    );

    const topLineY = lineSpacing;

    const step = Math.round(
        (y - topLineY) / staffStep
    );

    const pitch = pitchNames[
        ((3 - step) % 7 + 7) % 7
    ];

    const noteData = notes.find(
        note => note.element === noteElement
    );

    if (noteData) {

        noteData.x = x;
        noteData.y = y;
        noteData.pitch = pitch;

    }

    noteElement.dataset.pitch = pitch;

    if (hasDragged) {

    console.log("Note moved:", {
        x,
        y,
        pitch
    });

    // Abaikan click yang muncul setelah drag
    suppressClickUntil = Date.now() + 300;

}

draggedNote = null;
hasDragged = false;

});
