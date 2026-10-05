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

// =========================
// MEASURES
// =========================

let measures = [
    { number: 1, startX: 100, endX: 1000 },
    { number: 2, startX: 1000, endX: 1900 }
];

// =========================
// MUSIC SETTINGS
// =========================

let selectedDuration = "quarter";

const timeSignature = {
    beats: 4,
    beatUnit: 4
};

const durationBeats = {
    whole: 4,
    half: 2,
    quarter: 1,
    eighth: 0.5
};

// =========================
// MEASURE FUNCTIONS
// =========================

function getMeasureBeats(measureNumber) {

    return notes
        .filter(note => note.measure === measureNumber)
        .reduce((total, note) => {
            return total + note.beats;
        }, 0);
}

function getMeasureStatus(measureNumber) {

    const beats = getMeasureBeats(measureNumber);
    const maxBeats = timeSignature.beats;

    if (beats === 0) {
        return "EMPTY";
    }

    if (beats < maxBeats) {
        return "PARTIAL";
    }

    if (beats === maxBeats) {
        return "FULL";
    }

    return "OVERFULL";
}

function getCurrentMeasure() {

    for (const measure of measures) {

        const status = getMeasureStatus(measure.number);

        if (status !== "FULL" && status !== "OVERFULL") {
            return measure;
        }
    }

    return createNextMeasure();
}

// =========================
// CREATE NEXT MEASURE
// =========================

function createNextMeasure() {

    const lastMeasure =
        measures[measures.length - 1];

    const measureWidth =
        lastMeasure.endX -
        lastMeasure.startX;

    const newMeasure = {
        number: lastMeasure.number + 1,
        startX: lastMeasure.endX,
        endX: lastMeasure.endX + measureWidth
    };

    measures.push(newMeasure);

    console.log(
        "New measure created:",
        newMeasure
    );

    renderMeasures();

    return newMeasure;
}

// =========================
// RENDER MEASURES
// =========================

function renderMeasures() {

    document
        .querySelectorAll(".barline.dynamic")
        .forEach(barline => {
            barline.remove();
        });

    measures.forEach((measure, index) => {

        if (index === 0) {
            return;
        }

        const barline =
            document.createElement("div");

        barline.classList.add(
            "barline",
            "dynamic"
        );

        barline.style.left =
            `${measure.startX}px`;

        staff.appendChild(barline);
    });

    updateStaffWidth();
}

function updateStaffWidth() {

    const lastMeasure =
        measures[measures.length - 1];

    const width =
        lastMeasure.endX + 100;

    staff.style.width =
        `${width}px`;
}

// Render initial measures
renderMeasures();

// =========================
// INITIAL LOG
// =========================

console.log(
    "Current Measure:",
    getCurrentMeasure()
);

console.log(
    "Time Signature:",
    timeSignature
);

// =========================
// DURATION BUTTONS
// =========================

const durationButtons =
    document.querySelectorAll(
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
// DRAG STATE
// =========================

let draggedNote = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let hasDragged = false;
let suppressClickUntil = 0;

// =========================
// CLICK STAFF
// =========================

staff.addEventListener("click", (event) => {

    if (Date.now() < suppressClickUntil) {
        return;
    }

    if (event.target !== staff) {
        return;
    }

    const currentMeasure =
        getCurrentMeasure();

    if (!currentMeasure) {

        console.warn(
            "No available measure."
        );

        return;
    }

    const rect =
        staff.getBoundingClientRect();

    const rawX =
        event.clientX - rect.left;

    const rawY =
        event.clientY - rect.top;

    // =========================
    // POSITION X
    // =========================

    const minX =
        currentMeasure.startX + 50;

    const maxX =
        currentMeasure.endX - 50;

    const x =
        Math.max(
            minX,
            Math.min(rawX, maxX)
        );

    // =========================
    // POSITION Y
    // =========================

    const y =
        Math.round(
            rawY / staffStep
        ) * staffStep;

    // =========================
    // PITCH
    // =========================

    const topLineY = lineSpacing;

    const step =
        Math.round(
            (y - topLineY) / staffStep
        );

    const pitch =
        pitchNames[
            ((3 - step) % 7 + 7) % 7
        ];

    // =========================
    // CREATE NOTE
    // =========================

    const note =
        document.createElement("span");

    note.className =
        `note ${selectedDuration}`;

    note.dataset.pitch =
        pitch;

    // =========================
    // STEM
    // =========================

    if (selectedDuration !== "whole") {

        const stem =
            document.createElement("span");

        stem.className =
            "stem";

        note.appendChild(stem);

        if (selectedDuration === "eighth") {

            const flag =
                document.createElement("span");

            flag.className =
                "flag";

            stem.appendChild(flag);
        }
    }

    // =========================
    // PLACE NOTE
    // =========================

    note.style.left =
        `${x}px`;

    note.style.top =
        `${y}px`;

    staff.appendChild(note);

    // =========================
    // SAVE NOTE DATA
    // =========================

    notes.push({
        x: x,
        y: y,
        pitch: pitch,
        duration: selectedDuration,
        beats: durationBeats[selectedDuration],
        measure: currentMeasure.number,
        element: note
    });

    // =========================
    // DEBUG
    // =========================

    console.log(
        "Note added:",
        notes[notes.length - 1]
    );

    console.log(
        `Measure ${currentMeasure.number} beats:`,
        getMeasureBeats(
            currentMeasure.number
        )
    );

    console.log(
        `Measure ${currentMeasure.number} status:`,
        getMeasureStatus(
            currentMeasure.number
        )
    );

    console.log(
        "Current Measure:",
        getCurrentMeasure()
    );
});

// =========================
// START DRAG
// =========================

staff.addEventListener(
    "pointerdown",
    (event) => {

        const noteElement =
            event.target.closest(".note");

        if (!noteElement) {
            return;
        }

        draggedNote =
            noteElement;

        hasDragged = false;

        const rect =
            noteElement.getBoundingClientRect();

        dragOffsetX =
            event.clientX - rect.left;

        dragOffsetY =
            event.clientY - rect.top;

        draggedNote.setPointerCapture(
            event.pointerId
        );
    }
);

// =========================
// DRAG NOTE
// =========================

staff.addEventListener(
    "pointermove",
    (event) => {

        if (!draggedNote) {
            return;
        }

        hasDragged = true;

        const staffRect =
            staff.getBoundingClientRect();

        const x =
            event.clientX -
            staffRect.left -
            dragOffsetX;

        const rawY =
            event.clientY -
            staffRect.top -
            dragOffsetY;

        const y =
            Math.round(
                rawY / staffStep
            ) * staffStep;

        draggedNote.style.left =
            `${x}px`;

        draggedNote.style.top =
            `${y}px`;
    }
);

// =========================
// END DRAG
// =========================

staff.addEventListener(
    "pointerup",
    (event) => {

        if (!draggedNote) {
            return;
        }

        const noteElement =
            draggedNote;

        const x =
            parseFloat(
                noteElement.style.left
            );

        const y =
            parseFloat(
                noteElement.style.top
            );

        // =========================
        // RECALCULATE PITCH
        // =========================

        const topLineY =
            lineSpacing;

        const step =
            Math.round(
                (y - topLineY) / staffStep
            );

        const pitch =
            pitchNames[
                ((3 - step) % 7 + 7) % 7
            ];

        // =========================
        // UPDATE NOTE DATA
        // =========================

        const noteData =
            notes.find(
                note =>
                    note.element ===
                    noteElement
            );

        if (noteData) {

            noteData.x = x;
            noteData.y = y;
            noteData.pitch = pitch;
        }

        noteElement.dataset.pitch =
            pitch;

        // =========================
        // DRAG FINISHED
        // =========================

        if (hasDragged) {

            console.log(
                "Note moved:",
                {
                    x: x,
                    y: y,
                    pitch: pitch
                }
            );

            suppressClickUntil =
                Date.now() + 300;
        }

        draggedNote = null;
        hasDragged = false;
    }
);
