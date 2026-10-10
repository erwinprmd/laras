
const pitchNames = ["C", "D", "E", "F", "G", "A", "B"];

const lineSpacing = 22;
const staffStep = lineSpacing / 2;
const staff = document.querySelector(".staff");

if (!staff) {
    throw new Error('Elemen ".staff" tidak ditemukan.');
}

// =========================
// MUSIC DATA
// =========================

const notes = [];

let measures = [
    { number: 1, startX: 100, endX: 1000 },
    { number: 2, startX: 1000, endX: 1900 }
];

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

const restSymbols = {
    whole: "𝄻",
    half: "𝄼",
    quarter: "𝄽",
    eighth: "𝄾"
};

let draggedNote = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let dragStartX = 0;
let dragStartY = 0;
let hasDragged = false;
let suppressClickUntil = 0;

// =========================
// MEASURE CALCULATIONS
// =========================

function getMeasureBeats(measureNumber, excludedNote = null) {
    return notes
        .filter(note =>
            note.measure === measureNumber &&
            note !== excludedNote
        )
        .reduce((total, note) => total + note.beats, 0);
}

function getMeasureStatus(measureNumber) {
    const beats = getMeasureBeats(measureNumber);
    const maxBeats = timeSignature.beats;

    if (beats === 0) return "EMPTY";
    if (beats < maxBeats) return "PARTIAL";
    if (beats === maxBeats) return "FULL";

    return "OVERFULL";
}

function getMeasure(number) {
    return measures.find(measure => measure.number === number);
}

function getCurrentMeasure() {
    for (const measure of measures) {
        const status = getMeasureStatus(measure.number);

        if (status === "EMPTY" || status === "PARTIAL") {
            return measure;
        }
    }

    return createNextMeasure();
}

// =========================
// MEASURE CREATION
// =========================

function createNextMeasure() {
    const lastMeasure = measures[measures.length - 1];

    const measureWidth = lastMeasure.endX - lastMeasure.startX;

    const newMeasure = {
        number: lastMeasure.number + 1,
        startX: lastMeasure.endX,
        endX: lastMeasure.endX + measureWidth
    };

    measures.push(newMeasure);

    renderMeasures();

    console.log("New measure created:", newMeasure);

    return newMeasure;
}

// =========================
// STAFF RENDERING
// =========================

function updateStaffWidth() {
    const lastMeasure = measures[measures.length - 1];

    staff.style.width = `${lastMeasure.endX + 100}px`;
}

function renderMeasures() {
    staff.querySelectorAll(".barline.dynamic").forEach(line => line.remove());

    measures.forEach((measure, index) => {
        if (index === 0) return;

        const barline = document.createElement("div");

        barline.className = "barline dynamic";
        barline.style.left = `${measure.startX}px`;
        barline.style.pointerEvents = "none";

        staff.appendChild(barline);
    });

    updateStaffWidth();
}

function renderStaffLines() {
    staff.querySelectorAll(".staff-line").forEach(line => line.remove());

    for (let i = 0; i < 5; i++) {
        const line = document.createElement("div");

        line.className = "staff-line";
        line.style.top = `${lineSpacing + i * lineSpacing}px`;
        line.style.pointerEvents = "none";

        staff.appendChild(line);
    }
}

// =========================
// BEAT POSITIONING
// =========================

function getBeatWidth(measure) {
    const usableWidth =
        (measure.endX - measure.startX) - 100;

    return usableWidth / timeSignature.beats;
}

function getNextBeatPosition(measureNumber) {
    const measure = getMeasure(measureNumber);

    if (!measure) return null;

    const usedBeats = getMeasureBeats(measureNumber);
    const beatWidth = getBeatWidth(measure);

    return measure.startX + 50 + usedBeats * beatWidth;
}

function getNoteX(measureNumber, beatPosition) {
    const measure = getMeasure(measureNumber);

    if (!measure) return 0;

    return measure.startX + 50 +
        beatPosition * getBeatWidth(measure);
}

// =========================
// PITCH CALCULATION
// =========================

function getPitchFromY(y) {
    const step = Math.round((y - lineSpacing) / staffStep);

    return pitchNames[((3 - step) % 7 + 7) % 7];
}

function getSnappedY(y) {
    return Math.round(y / staffStep) * staffStep;
}

// =========================
// NOTE ELEMENTS
// =========================

function createNoteElement(noteData) {
    const element = document.createElement("span");

    element.className = `note ${noteData.duration}`;
    element.dataset.pitch = noteData.pitch;

    if (noteData.duration !== "whole") {
        const stem = document.createElement("span");

        stem.className = "stem";
        element.appendChild(stem);

        if (noteData.duration === "eighth") {
            const flag = document.createElement("span");

            flag.className = "flag";
            stem.appendChild(flag);
        }
    }

    element.style.left = `${noteData.x}px`;
    element.style.top = `${noteData.y}px`;

    return element;
}

function createRestElement(noteData) {
    const element = document.createElement("span");

    element.className = "rest";
    element.dataset.duration = noteData.duration;
    element.textContent = restSymbols[noteData.duration] || "𝄽";

    element.style.left = `${noteData.x}px`;
    element.style.top = `${noteData.y}px`;

    return element;
}

function renderMusicElement(noteData) {
    const oldElement = noteData.element;

    const newElement = noteData.isRest
        ? createRestElement(noteData)
        : createNoteElement(noteData);

    if (oldElement?.isConnected) {
        oldElement.replaceWith(newElement);
    } else {
        staff.appendChild(newElement);
    }

    noteData.element = newElement;
}

// =========================
// REFLOW NOTES AND RESTS
// =========================

function reflowNotes() {
    measures.forEach(measure => {
        const measureNotes = notes
            .filter(note => note.measure === measure.number)
            .sort((a, b) => a.beatPosition - b.beatPosition);

        measureNotes.forEach(note => {
            note.x = getNoteX(note.measure, note.beatPosition);

            note.element.style.left = `${note.x}px`;
            note.element.style.top = `${note.y}px`;
        });
    });
}

// =========================
// DURATION TOOLBAR
// =========================

function updateDurationButtons() {
    document.querySelectorAll("[data-duration]").forEach(button => {
        const isSelected = button.dataset.duration === selectedDuration;

        button.classList.toggle("active", isSelected);
        button.setAttribute("aria-pressed", String(isSelected));
    });
}

document.querySelectorAll("[data-duration]").forEach(button => {
    button.addEventListener("click", () => {
        const duration = button.dataset.duration;

        if (!(duration in durationBeats)) {
            console.warn("Durasi tidak dikenali:", duration);
            return;
        }

        selectedDuration = duration;
        updateDurationButtons();

        console.log("Duration selected:", selectedDuration);
    });
});

// =========================
// ADD NOTE
// =========================

function addNote(y) {
    const currentMeasure = getCurrentMeasure();
    const beats = durationBeats[selectedDuration];

    const usedBeats = getMeasureBeats(currentMeasure.number);

    if (usedBeats + beats > timeSignature.beats) {
        console.warn(
            `Not tidak bisa ditambahkan. Birama ${currentMeasure.number} ` +
            `hanya memiliki ${timeSignature.beats - usedBeats} ketukan tersisa.`
        );

        return;
    }

    // Simpan posisi ketukan SEBELUM menambahkan not.
    const beatPosition = usedBeats;
    const x = getNextBeatPosition(currentMeasure.number);
    const snappedY = getSnappedY(y);
    const pitch = getPitchFromY(snappedY);

    const noteData = {
        x,
        y: snappedY,
        pitch,
        duration: selectedDuration,
        beats,
        beatPosition,
        measure: currentMeasure.number,
        isRest: false,
        element: null
    };

    noteData.element = createNoteElement(noteData);

    staff.appendChild(noteData.element);
    notes.push(noteData);

    console.log(
        `Note added: ${pitch} | Measure ${noteData.measure} | ` +
        `Beat ${beatPosition} | ${selectedDuration}`
    );

    logMeasureStatus(noteData.measure);
}

function logMeasureStatus(measureNumber) {
    console.log(
        `Measure ${measureNumber} beats:`,
        getMeasureBeats(measureNumber)
    );

    console.log(
        `Measure ${measureNumber} status:`,
        getMeasureStatus(measureNumber)
    );

    console.log("Current Measure:", getCurrentMeasure());
}

staff.addEventListener("click", event => {
    if (Date.now() < suppressClickUntil) return;

    // Hanya klik area kosong yang menambahkan not.
    if (event.target !== staff) return;

    const rect = staff.getBoundingClientRect();
    const y = event.clientY - rect.top;

    addNote(y);
});

// =========================
// CONVERT NOTE TO REST
// =========================

staff.addEventListener("dblclick", event => {
    const element = event.target.closest(".note");

    if (!element || !staff.contains(element)) return;

    const noteData = notes.find(note => note.element === element);

    if (!noteData || noteData.isRest) return;

    noteData.isRest = true;
    noteData.pitch = null;

    renderMusicElement(noteData);

    console.log("Note converted to rest:", {
        duration: noteData.duration,
        beats: noteData.beats,
        beatPosition: noteData.beatPosition,
        measure: noteData.measure
    });

    console.log(
        `Measure ${noteData.measure} beats:`,
        getMeasureBeats(noteData.measure)
    );

    console.log(
        `Measure ${noteData.measure} status:`,
        getMeasureStatus(noteData.measure)
    );
});

// =========================
// DRAG NOTES
// =========================

staff.addEventListener("pointerdown", event => {
    const element = event.target.closest(".note");

    // Rest bukan not bernada dan tidak bisa di-drag sebagai not.
    if (!element || !staff.contains(element)) return;

    const noteData = notes.find(note => note.element === element);

    if (!noteData || noteData.isRest) return;

    draggedNote = element;
    hasDragged = false;

    const rect = element.getBoundingClientRect();

    dragOffsetX = event.clientX - rect.left;
    dragOffsetY = event.clientY - rect.top;

    dragStartX = noteData.x;
    dragStartY = noteData.y;

    element.setPointerCapture(event.pointerId);
});

staff.addEventListener("pointermove", event => {
    if (!draggedNote) return;

    const staffRect = staff.getBoundingClientRect();

    const rawY =
        event.clientY - staffRect.top - dragOffsetY;

    const y = getSnappedY(rawY);

    // Drag vertikal mengubah pitch.
    // Posisi horizontal tetap mengikuti ketukan agar
    // durasi dan urutan musik tidak rusak.
    draggedNote.style.left = `${dragStartX}px`;
    draggedNote.style.top = `${y}px`;

    if (Math.abs(y - dragStartY) > 2) {
        hasDragged = true;
    }
});

function finishDrag() {
    if (!draggedNote) return;

    const element = draggedNote;
    const noteData = notes.find(note => note.element === element);

    if (noteData && hasDragged) {
        const y = getSnappedY(parseFloat(element.style.top));

        noteData.y = y;
        noteData.pitch = getPitchFromY(y);

        element.dataset.pitch = noteData.pitch;

        // Pastikan x tetap sesuai posisi ketukan.
        noteData.x = getNoteX(noteData.measure, noteData.beatPosition);
        element.style.left = `${noteData.x}px`;

        console.log("Note moved:", {
            measure: noteData.measure,
            beatPosition: noteData.beatPosition,
            pitch: noteData.pitch,
            x: noteData.x,
            y: noteData.y
        });

        suppressClickUntil = Date.now() + 300;
    }

    draggedNote = null;
    hasDragged = false;
}

staff.addEventListener("pointerup", finishDrag);
staff.addEventListener("pointercancel", finishDrag);

// =========================
// INITIALIZE EDITOR
// =========================

renderStaffLines();
renderMeasures();
updateDurationButtons();

console.log("LARAS notation engine initialized.");
console.log("Time Signature:", timeSignature);
console.log("Current Measure:", getCurrentMeasure());
