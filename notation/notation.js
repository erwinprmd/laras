
"use strict";

// ========================================
// LARAS — MUSIC NOTATION ENGINE
// ========================================

// ---------- CONSTANTS ----------

const pitchNames = ["C", "D", "E", "F", "G", "A", "B"];

const lineSpacing = 22;
const staffStep = lineSpacing / 2;
const staff = document.querySelector(".staff");

if (!staff) {
    throw new Error('Elemen ".staff" tidak ditemukan.');
}

const durationBeats = Object.freeze({
    whole: 4,
    half: 2,
    quarter: 1,
    eighth: 0.5
});

const restSymbols = Object.freeze({
    whole: "𝄻",
    half: "𝄼",
    quarter: "𝄽",
    eighth: "𝄾"
});

const PROJECT_STORAGE_KEY = "laras_saved_compositions_v1";

const supportedTimeSignatures = [
    { beats: 2, beatUnit: 4 },
    { beats: 3, beatUnit: 4 },
    { beats: 4, beatUnit: 4 }
];

const MAX_MEASURES = 500;
const MAX_COORDINATE = 100000;

// ---------- EDITOR STATE ----------

const notes = [];

let measures = [
    { number: 1, startX: 100, endX: 1000 },
    { number: 2, startX: 1000, endX: 1900 }
];

let selectedDuration = "quarter";
let currentClef = "treble";
let currentProjectName = "Untitled composition";

const timeSignature = {
    beats: 4,
    beatUnit: 4
};

let draggedNote = null;
let dragStartY = 0;
let hasDragged = false;
let suppressClickUntil = 0;

// ---------- HTML ELEMENTS ----------

const clefControl = document.getElementById("trebleClef");
const signatureControl = document.getElementById("timeSignature");

const projectStatus = document.getElementById("projectStatus");
const newProjectButton = document.getElementById("newProject");
const saveProjectButton = document.getElementById("saveProject");
const openProjectButton = document.getElementById("openProject");
const exportProjectButton = document.getElementById("exportProject");
const importProjectButton = document.getElementById("importProject");
const importProjectFile = document.getElementById("importProjectFile");

// ========================================
// PITCH ENGINE
// ========================================

function getPitchFromY(y, clef = currentClef) {
    const bottomLineY = lineSpacing * 5;

    const step = Math.round(
        (bottomLineY - y) / staffStep
    );

    // Bottom staff line:
    // Treble = E4
    // Bass   = G2

    const baseIndex = clef === "bass"
        ? 2 * 7 + 4
        : 4 * 7 + 2;

    const absoluteIndex = baseIndex + step;

    const letterIndex =
        ((absoluteIndex % 7) + 7) % 7;

    const octave = Math.floor(absoluteIndex / 7);

    return `${pitchNames[letterIndex]}${octave}`;
}

function getSnappedY(y) {
    return Math.round(y / staffStep) * staffStep;
}

function refreshNotePitches() {
    for (const note of notes) {
        if (note.isRest) continue;

        note.pitch = getPitchFromY(note.y);

        if (note.element) {
            note.element.dataset.pitch = note.pitch;
        }
    }
}

// ========================================
// MEASURE ENGINE
// ========================================

function getMeasure(number) {
    return measures.find(
        measure => measure.number === number
    );
}

// Return the end of the latest occupied beat.
// This avoids placing imported notes on top of
// existing notes when there are gaps in a measure.

function getMeasureBeats(measureNumber) {
    let endBeat = 0;

    for (const note of notes) {
        if (note.measure !== measureNumber) continue;

        endBeat = Math.max(
            endBeat,
            note.beatPosition + note.beats
        );
    }

    return endBeat;
}

function getMeasureStatus(measureNumber) {
    const beats = getMeasureBeats(measureNumber);

    if (beats === 0) return "EMPTY";
    if (beats < timeSignature.beats) return "PARTIAL";
    if (beats === timeSignature.beats) return "FULL";

    return "OVERFULL";
}

function getCurrentMeasure() {
    for (const measure of measures) {
        const status = getMeasureStatus(measure.number);

        if (
            status === "EMPTY" ||
            status === "PARTIAL"
        ) {
            return measure;
        }
    }

    return createNextMeasure();
}

function createNextMeasure() {
    const lastMeasure = measures[measures.length - 1];

    if (!lastMeasure) {
        throw new Error("Birama terakhir tidak ditemukan.");
    }

    if (lastMeasure.number >= MAX_MEASURES) {
        throw new Error("Batas 500 birama telah tercapai.");
    }

    const measureWidth =
        lastMeasure.endX - lastMeasure.startX;

    const newMeasure = {
        number: lastMeasure.number + 1,
        startX: lastMeasure.endX,
        endX: lastMeasure.endX + measureWidth
    };

    measures.push(newMeasure);

    renderMeasures();

    return newMeasure;
}

// ========================================
// STAFF RENDERING
// ========================================

function updateStaffWidth() {
    const lastMeasure = measures[measures.length - 1];

    if (!lastMeasure) return;

    staff.style.width =
        `${lastMeasure.endX + 100}px`;
}

function renderStaffLines() {
    staff.querySelectorAll(".staff-line").forEach(
        line => line.remove()
    );

    if (!measures.length) return;

    const firstX = Math.min(
        ...measures.map(measure => measure.startX)
    );

    const lastX = Math.max(
        ...measures.map(measure => measure.endX)
    );

    for (let i = 0; i < 5; i++) {
        const line = document.createElement("div");

        line.className = "staff-line";
        line.style.left = `${firstX}px`;
        line.style.width = `${lastX - firstX}px`;
        line.style.top =
            `${lineSpacing + i * lineSpacing}px`;

        line.style.pointerEvents = "none";

        staff.appendChild(line);
    }
}

function renderMeasures() {
    staff.querySelectorAll(".barline").forEach(
        line => line.remove()
    );

    for (const measure of measures) {
        const barline = document.createElement("div");

        barline.className = "barline dynamic";
        barline.style.left = `${measure.startX}px`;
        barline.style.pointerEvents = "none";

        staff.appendChild(barline);
    }

    // Draw the final boundary as well.
    const lastMeasure = measures[measures.length - 1];

    if (lastMeasure) {
        const finalBarline = document.createElement("div");

        finalBarline.className = "barline dynamic final-barline";
        finalBarline.style.left = `${lastMeasure.endX}px`;
        finalBarline.style.pointerEvents = "none";

        staff.appendChild(finalBarline);
    }

    renderStaffLines();
    updateStaffWidth();
}

// ========================================
// CLEF
// ========================================

function renderClef() {
    if (!clefControl) return;

    const symbol = currentClef === "bass"
        ? "𝄢"
        : "𝄞";

    clefControl.textContent = symbol;

    clefControl.setAttribute(
        "aria-label",
        currentClef === "bass"
            ? "Switch to treble clef"
            : "Switch to bass clef"
    );

    clefControl.setAttribute(
        "title",
        currentClef === "bass"
            ? "Bass clef"
            : "Treble clef"
    );
}

if (clefControl) {
    clefControl.addEventListener("click", () => {
        currentClef = currentClef === "treble"
            ? "bass"
            : "treble";

        renderClef();
        refreshNotePitches();

        console.log("Clef changed:", currentClef);
    });
}

// ========================================
// TIME SIGNATURE
// ========================================

function renderTimeSignature() {
    const signatureElement =
        document.querySelector(".time-signature");

    if (signatureElement) {
        signatureElement.replaceChildren();

        const numerator = document.createElement("span");
        const denominator = document.createElement("span");

        numerator.textContent =
            String(timeSignature.beats);

        denominator.textContent =
            String(timeSignature.beatUnit);

        signatureElement.append(numerator, denominator);
    }

    if (signatureControl) {
        signatureControl.textContent =
            `${timeSignature.beats}/${timeSignature.beatUnit}`;
    }
}

function changeTimeSignature() {
    const currentIndex = supportedTimeSignatures.findIndex(
        signature =>
            signature.beats === timeSignature.beats &&
            signature.beatUnit === timeSignature.beatUnit
    );

    const nextSignature =
        supportedTimeSignatures[
            (currentIndex + 1) %
            supportedTimeSignatures.length
        ];

    const hasOverflow = notes.some(note =>
        note.beatPosition + note.beats >
        nextSignature.beats
    );

    if (hasOverflow) {
        alert(
            `Birama ${nextSignature.beats}/4 tidak dapat digunakan. ` +
            "Ada not yang melebihi kapasitas birama tersebut."
        );

        return;
    }

    timeSignature.beats = nextSignature.beats;
    timeSignature.beatUnit = nextSignature.beatUnit;

    renderTimeSignature();
    reflowNotes();
}

if (signatureControl) {
    signatureControl.addEventListener(
        "click",
        changeTimeSignature
    );
}

// ========================================
// NOTE POSITIONING
// ========================================

function getBeatWidth(measure) {
    const measureWidth =
        measure.endX - measure.startX;

    const noteAreaWidth = measureWidth - 100;

    return noteAreaWidth / timeSignature.beats;
}

function getNoteX(measureNumber, beatPosition) {
    const measure = getMeasure(measureNumber);

    if (!measure) return 0;

    return (
        measure.startX +
        50 +
        beatPosition * getBeatWidth(measure)
    );
}

function getNextBeatPosition(measureNumber) {
    const measure = getMeasure(measureNumber);

    if (!measure) return null;

    return getNoteX(
        measureNumber,
        getMeasureBeats(measureNumber)
    );
}

function reflowNotes() {
    for (const note of notes) {
        note.x = getNoteX(
            note.measure,
            note.beatPosition
        );

        if (note.element) {
            note.element.style.left = `${note.x}px`;
        }
    }
}

// ========================================
// NOTE & REST ELEMENTS
// ========================================

function createNoteElement(noteData) {
    const element = document.createElement("span");

    element.className = `note ${noteData.duration}`;
    element.dataset.pitch = noteData.pitch || "";

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

    element.textContent =
        restSymbols[noteData.duration] || "𝄽";

    element.style.left = `${noteData.x}px`;
    element.style.top = `${noteData.y}px`;

    return element;
}

function renderMusicElement(noteData) {
    const oldElement = noteData.element;

    const element = noteData.isRest
        ? createRestElement(noteData)
        : createNoteElement(noteData);

    if (oldElement?.isConnected) {
        oldElement.replaceWith(element);
    } else {
        staff.appendChild(element);
    }

    noteData.element = element;
}

// ========================================
// DURATION TOOLBAR
// ========================================

function updateDurationButtons() {
    document.querySelectorAll(
        "button[data-duration]"
    ).forEach(button => {
        const selected =
            button.dataset.duration === selectedDuration;

        button.classList.toggle("active", selected);

        button.setAttribute(
            "aria-pressed",
            String(selected)
        );
    });
}

document.querySelectorAll(
    "button[data-duration]"
).forEach(button => {
    button.addEventListener("click", () => {
        const duration = button.dataset.duration;

        if (
            !Object.prototype.hasOwnProperty.call(
                durationBeats,
                duration
            )
        ) {
            console.warn("Unknown duration:", duration);
            return;
        }

        selectedDuration = duration;
        updateDurationButtons();
    });
});

// ========================================
// ADD NOTE
// ========================================

function addNote(y) {
    if (!Number.isFinite(y)) return;

    const snappedY = getSnappedY(y);

    const measure = getCurrentMeasure();
    const beats = durationBeats[selectedDuration];
    const beatPosition =
        getMeasureBeats(measure.number);

    if (beatPosition + beats > timeSignature.beats) {
        console.warn("Measure capacity exceeded.");
        return;
    }

    const noteData = {
        x: getNoteX(measure.number, beatPosition),
        y: snappedY,
        pitch: getPitchFromY(snappedY),
        duration: selectedDuration,
        beats,
        beatPosition,
        measure: measure.number,
        isRest: false,
        element: null
    };

    noteData.element = createNoteElement(noteData);

    staff.appendChild(noteData.element);
    notes.push(noteData);
}

staff.addEventListener("click", event => {
    if (Date.now() < suppressClickUntil) return;
    if (event.target !== staff) return;

    const rect = staff.getBoundingClientRect();

    addNote(event.clientY - rect.top);
});

// ========================================
// CONVERT NOTE TO REST
// ========================================

staff.addEventListener("dblclick", event => {
    const element = event.target.closest(".note");

    if (!element || !staff.contains(element)) return;

    const note = notes.find(
        item => item.element === element
    );

    if (!note || note.isRest) return;

    note.isRest = true;
    note.pitch = null;

    renderMusicElement(note);
});

// ========================================
// DRAG NOTES VERTICALLY
// ========================================

staff.addEventListener("pointerdown", event => {
    const element = event.target.closest(".note");

    if (!element || !staff.contains(element)) return;

    const note = notes.find(
        item => item.element === element
    );

    if (!note || note.isRest) return;

    draggedNote = element;
    hasDragged = false;
    dragStartY = note.y;

    element.setPointerCapture?.(event.pointerId);
});

staff.addEventListener("pointermove", event => {
    if (!draggedNote) return;

    const rect = staff.getBoundingClientRect();

    const y = getSnappedY(
        event.clientY - rect.top
    );

    draggedNote.style.top = `${y}px`;

    if (Math.abs(y - dragStartY) > 2) {
        hasDragged = true;
    }
});

function finishDrag() {
    if (!draggedNote) return;

    const element = draggedNote;

    const note = notes.find(
        item => item.element === element
    );

    if (note && hasDragged) {
        note.y = getSnappedY(
            parseFloat(element.style.top)
        );

        note.pitch = getPitchFromY(note.y);
        note.x = getNoteX(
            note.measure,
            note.beatPosition
        );

        element.dataset.pitch = note.pitch;
        element.style.left = `${note.x}px`;
        element.style.top = `${note.y}px`;

        suppressClickUntil = Date.now() + 300;
    }

    draggedNote = null;
    hasDragged = false;
}

staff.addEventListener("pointerup", finishDrag);
staff.addEventListener("pointercancel", finishDrag);

// ========================================
// PROJECT STORAGE
// ========================================

function updateProjectStatus(message) {
    if (projectStatus) {
        projectStatus.textContent = message;
    }
}

function getSavedProjects() {
    try {
        const stored =
            localStorage.getItem(PROJECT_STORAGE_KEY);

        const projects = stored
            ? JSON.parse(stored)
            : {};

        if (
            !projects ||
            typeof projects !== "object" ||
            Array.isArray(projects)
        ) {
            return {};
        }

        return projects;
    } catch (error) {
        console.error("Could not read projects:", error);
        return {};
    }
}

function buildProjectData() {
    return {
        format: "LARAS",
        version: 1,
        name: currentProjectName,
        clef: currentClef,
        timeSignature: { ...timeSignature },

        measures: measures.map(measure => ({
            ...measure
        })),

        notes: notes.map(note => ({
            x: note.x,
            y: note.y,
            pitch: note.pitch,
            duration: note.duration,
            beats: note.beats,
            beatPosition: note.beatPosition,
            measure: note.measure,
            isRest: note.isRest
        })),

        updatedAt: new Date().toISOString()
    };
}

function saveProject() {
    const input = prompt(
        "Nama komposisi:",
        currentProjectName
    );

    if (input === null) return;

    const name = input.trim();

    if (!name) {
        alert("Nama komposisi tidak boleh kosong.");
        return;
    }

    try {
        const projects = getSavedProjects();
        const data = buildProjectData();

        data.name = name;
        projects[name] = data;

        localStorage.setItem(
            PROJECT_STORAGE_KEY,
            JSON.stringify(projects)
        );

        currentProjectName = name;

        updateProjectStatus(`Saved: ${name}`);
    } catch (error) {
        console.error("Save failed:", error);

        alert(
            "Komposisi gagal disimpan di browser."
        );
    }
}

function clearComposition() {
    notes.forEach(note => note.element?.remove());
    notes.splice(0, notes.length);

    measures = [
        { number: 1, startX: 100, endX: 1000 },
        { number: 2, startX: 1000, endX: 1900 }
    ];

    renderMeasures();
}

function createNewProject() {
    if (notes.length > 0) {
        const confirmed = confirm(
            "Mulai komposisi baru? Simpan pekerjaanmu terlebih dahulu."
        );

        if (!confirmed) return;
    }

    clearComposition();

    currentProjectName = "Untitled composition";
    currentClef = "treble";

    timeSignature.beats = 4;
    timeSignature.beatUnit = 4;

    selectedDuration = "quarter";

    renderClef();
    renderTimeSignature();
    updateDurationButtons();

    updateProjectStatus(currentProjectName);
}

// ========================================
// VALIDATE IMPORTED PROJECT
// ========================================

function normalizeProject(data) {
    if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data) ||
        data.format !== "LARAS"
    ) {
        throw new Error(
            "File bukan komposisi LARAS yang valid."
        );
    }

    if (
        !Array.isArray(data.notes) ||
        !Array.isArray(data.measures)
    ) {
        throw new Error(
            "Data notasi atau birama tidak valid."
        );
    }

    const signature = data.timeSignature == null
        ? { beats: 4, beatUnit: 4 }
        : data.timeSignature;

    if (
        !signature ||
        typeof signature !== "object" ||
        Array.isArray(signature) ||
        ![2, 3, 4].includes(signature.beats) ||
        signature.beatUnit !== 4
    ) {
        throw new Error(
            "Time signature belum didukung."
        );
    }

    const importedClef = data.clef === "bass"
        ? "bass"
        : "treble";

    if (data.measures.length === 0) {
        throw new Error(
            "Tidak ditemukan birama yang valid."
        );
    }

    if (
        data.measures.length > MAX_MEASURES ||
        data.notes.length > 10000
    ) {
        throw new Error(
            "File memiliki terlalu banyak data."
        );
    }

    const measureNumbers = new Set();

    const normalizedMeasures = data.measures.map(
        (measure, index) => {
            if (
                !measure ||
                typeof measure !== "object" ||
                !Number.isInteger(measure.number) ||
                measure.number < 1 ||
                measure.number > MAX_MEASURES ||
                !Number.isFinite(measure.startX) ||
                !Number.isFinite(measure.endX) ||
                Math.abs(measure.startX) > MAX_COORDINATE ||
                Math.abs(measure.endX) > MAX_COORDINATE ||
                measure.endX <= measure.startX
            ) {
                throw new Error(
                    `Data birama ke-${index + 1} tidak valid.`
                );
            }

            if (measureNumbers.has(measure.number)) {
                throw new Error(
                    `Nomor birama ${measure.number} terduplikasi.`
                );
            }

            measureNumbers.add(measure.number);

            return {
                number: measure.number,
                startX: measure.startX,
                endX: measure.endX
            };
        }
    ).sort((a, b) => a.number - b.number);

    const normalizedNotes = data.notes.map(
        (note, index) => {
            if (
                !note ||
                typeof note !== "object" ||
                Array.isArray(note)
            ) {
                throw new Error(
                    `Data not ke-${index + 1} tidak valid.`
                );
            }

            if (
                !Object.prototype.hasOwnProperty.call(
                    durationBeats,
                    note.duration
                )
            ) {
                throw new Error(
                    `Durasi not ke-${index + 1} tidak valid.`
                );
            }

            if (
                !Number.isInteger(note.measure) ||
                note.measure < 1 ||
                note.measure > MAX_MEASURES ||
                !Number.isFinite(note.beatPosition) ||
                note.beatPosition < 0 ||
                !Number.isFinite(note.y) ||
                Math.abs(note.y) > MAX_COORDINATE
            ) {
                throw new Error(
                    `Posisi not ke-${index + 1} tidak valid.`
                );
            }

            if (
                note.isRest !== undefined &&
                typeof note.isRest !== "boolean"
            ) {
                throw new Error(
                    `Jenis not ke-${index + 1} tidak valid.`
                );
            }

            const isRest = note.isRest === true;

            let pitch = isRest ? null : note.pitch;

            if (!isRest) {
                // Accept both legacy pitches ("E")
                // and octave-aware pitches ("E4").
                const validPitch =
                    typeof pitch === "string" &&
                    /^[A-G](?:[0-9])?$/.test(pitch);

                if (!validPitch) {
                    throw new Error(
                        `Pitch not ke-${index + 1} tidak valid.`
                    );
                }

                if (pitch.length === 1) {
                    pitch = getPitchFromY(
                        note.y,
                        importedClef
                    );

                    if (
                        typeof pitch !== "string" ||
                        !/^[A-G][0-9]$/.test(pitch)
                    ) {
                        throw new Error(
                            `Pitch not ke-${index + 1} tidak valid.`
                        );
                    }
                }
            }

            return {
                x: Number.isFinite(note.x) &&
                    Math.abs(note.x) <= MAX_COORDINATE
                    ? note.x
                    : 0,

                y: note.y,
                pitch,
                duration: note.duration,
                beats: durationBeats[note.duration],
                beatPosition: note.beatPosition,
                measure: note.measure,
                isRest,
                element: null
            };
        }
    );

    let maxMeasure = 2;

    for (const measure of normalizedMeasures) {
        maxMeasure = Math.max(
            maxMeasure,
            measure.number
        );
    }

    for (const note of normalizedNotes) {
        maxMeasure = Math.max(
            maxMeasure,
            note.measure
        );
    }

    if (maxMeasure > MAX_MEASURES) {
        throw new Error(
            "File memiliki terlalu banyak birama."
        );
    }

    const firstMeasure = normalizedMeasures[0];

    const measureWidth =
        firstMeasure.endX - firstMeasure.startX;

    const measureMap = new Map(
        normalizedMeasures.map(measure => [
            measure.number,
            measure
        ])
    );

    for (
        let number = 1;
        number <= maxMeasure;
        number++
    ) {
        if (measureMap.has(number)) continue;

        const startX =
            firstMeasure.startX +
            (number - firstMeasure.number) *
                measureWidth;

        const endX = startX + measureWidth;

        if (
            !Number.isFinite(startX) ||
            !Number.isFinite(endX) ||
            Math.abs(startX) > MAX_COORDINATE ||
            Math.abs(endX) > MAX_COORDINATE
        ) {
            throw new Error(
                "Koordinat birama berada di luar batas."
            );
        }

        measureMap.set(number, {
            number,
            startX,
            endX
        });
    }

    const finalMeasures = Array.from(
        measureMap.values()
    ).sort((a, b) => a.number - b.number);

    const notesByMeasure = new Map();

    for (const note of normalizedNotes) {
        if (!notesByMeasure.has(note.measure)) {
            notesByMeasure.set(note.measure, []);
        }

        notesByMeasure.get(note.measure).push(note);
    }

    for (const measure of finalMeasures) {
        const measureNotes =
            notesByMeasure.get(measure.number) || [];

        measureNotes.sort(
            (a, b) => a.beatPosition - b.beatPosition
        );

        let previousEnd = 0;

        for (const note of measureNotes) {
            const noteEnd =
                note.beatPosition + note.beats;

            if (
                note.beatPosition < previousEnd ||
                noteEnd > signature.beats
            ) {
                throw new Error(
                    `Susunan ketukan pada birama ${measure.number} tidak valid.`
                );
            }

            previousEnd = noteEnd;
        }
    }

    return {
        name:
            typeof data.name === "string" &&
            data.name.trim()
                ? data.name.trim()
                : "Imported composition",

        clef: importedClef,

        timeSignature: {
            beats: signature.beats,
            beatUnit: signature.beatUnit
        },

        measures: finalMeasures,
        notes: normalizedNotes
    };
}

// ========================================
// LOAD PROJECT
// ========================================

function loadProjectData(data) {
    // Validate before changing the current composition.
    const project = normalizeProject(data);

    clearComposition();

    currentProjectName = project.name;
    currentClef = project.clef;

    timeSignature.beats =
        project.timeSignature.beats;

    timeSignature.beatUnit =
        project.timeSignature.beatUnit;

    measures = project.measures;

    for (const note of project.notes) {
        notes.push(note);
        renderMusicElement(note);
    }

    renderMeasures();

    // Recalculate horizontal positions, but preserve
    // imported pitch and vertical position.
    reflowNotes();

    renderClef();
    renderTimeSignature();
    updateDurationButtons();

    updateProjectStatus(
        `Opened: ${currentProjectName}`
    );

    console.log(
        "Project loaded:",
        currentProjectName
    );
}

// ========================================
// OPEN PROJECT
// ========================================

function openProject() {
    const projects = getSavedProjects();
    const names = Object.keys(projects);

    if (!names.length) {
        alert(
            "Belum ada komposisi tersimpan di browser ini."
        );
        return;
    }

    const menu = names
        .map((name, index) => `${index + 1}. ${name}`)
        .join("\n");

    const choice = prompt(
        `Pilih nomor komposisi:\n\n${menu}`
    );

    if (choice === null) return;

    const index = Number(choice) - 1;

    if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= names.length
    ) {
        alert("Nomor komposisi tidak valid.");
        return;
    }

    if (
        notes.length > 0 &&
        !confirm(
            "Komposisi saat ini akan diganti. Lanjutkan?"
        )
    ) {
        return;
    }

    try {
        loadProjectData(projects[names[index]]);
    } catch (error) {
        console.error("Open failed:", error);

        alert(
            `Komposisi gagal dibuka: ${error.message}`
        );
    }
}

// ========================================
// EXPORT PROJECT AS JSON
// ========================================

function exportProject() {
    let url = null;

    try {
        const data = buildProjectData();

        const blob = new Blob(
            [JSON.stringify(data, null, 2)],
            { type: "application/json" }
        );

        url = URL.createObjectURL(blob);

        const link = document.createElement("a");

        const safeName = currentProjectName
            .replace(/[^a-z0-9_-]+/gi, "-")
            .replace(/^-+|-+$/g, "")
            || "laras-composition";

        link.href = url;
        link.download = `${safeName}.json`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        updateProjectStatus(
            `Exported: ${currentProjectName}`
        );
    } catch (error) {
        console.error("Export failed:", error);
        alert("Komposisi gagal diekspor.");
    } finally {
        if (url) {
            setTimeout(
                () => URL.revokeObjectURL(url),
                1000
            );
        }
    }
}

// ========================================
// IMPORT PROJECT FROM JSON
// ========================================


 // ========================================
 // IMPORT PROJECT FROM JSON
 // ========================================

function importProject() {
    importProjectFile?.click();
}

if (importProjectFile) {
    importProjectFile.addEventListener(
        "change",
        async event => {
            const file = event.target.files?.[0];

            if (!file) return;

            try {
                const text = await file.text();
                const data = JSON.parse(text);

                // Validate the original file data first.
                // Keep the original format for loadProjectData().
                normalizeProject(data);

                if (
                    notes.length > 0 &&
                    !confirm(
                        "Komposisi saat ini akan diganti. Lanjutkan impor?"
                    )
                ) {
                    return;
                }

                // Pass the original data, not the normalized result.
                // loadProjectData() performs its own validation.
                loadProjectData(data);

                updateProjectStatus(
                    `Imported: ${currentProjectName}`
                );

                console.log(
                    "Project imported successfully:",
                    currentProjectName
                );
            } catch (error) {
                console.error("Import failed:", error);

                alert(
                    `Impor gagal: ${error.message}`
                );
            } finally {
                importProjectFile.value = "";
            }
        }
    );
}


// ========================================
// CONNECT PROJECT BUTTONS
// ========================================

if (newProjectButton) {
    newProjectButton.addEventListener(
        "click",
        createNewProject
    );
}

if (saveProjectButton) {
    saveProjectButton.addEventListener(
        "click",
        saveProject
    );
}

if (openProjectButton) {
    openProjectButton.addEventListener(
        "click",
        openProject
    );
}

if (exportProjectButton) {
    exportProjectButton.addEventListener(
        "click",
        exportProject
    );
}

if (importProjectButton) {
    importProjectButton.addEventListener(
        "click",
        importProject
    );
}

// ========================================
// INITIALIZE LARAS
// ========================================

renderStaffLines();
renderMeasures();
renderClef();
renderTimeSignature();
updateDurationButtons();

updateProjectStatus(currentProjectName);

console.log("LARAS notation engine initialized.");
console.log("Clef:", currentClef);
console.log("Time signature:", { ...timeSignature });
