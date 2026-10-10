
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

const PROJECT_STORAGE_KEY = "laras_saved_compositions_v1";

const supportedTimeSignatures = [
    { beats: 2, beatUnit: 4 },
    { beats: 3, beatUnit: 4 },
    { beats: 4, beatUnit: 4 }
];

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
// MEASURE ENGINE
// ========================================

function getMeasure(number) {
    return measures.find(measure => measure.number === number);
}

function getMeasureBeats(measureNumber) {
    return notes
        .filter(note => note.measure === measureNumber)
        .reduce((total, note) => total + note.beats, 0);
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

        if (status === "EMPTY" || status === "PARTIAL") {
            return measure;
        }
    }

    return createNextMeasure();
}

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

// ========================================
// STAFF RENDERING
// ========================================


function updateStaffWidth() {
    const lastMeasure = measures[measures.length - 1];

    if (!lastMeasure) return;

    // Reserve a little room after the final barline.
    staff.style.width = `${lastMeasure.endX + 100}px`;
}

function renderMeasures() {
    staff.querySelectorAll(".barline").forEach(line => line.remove());

    measures.forEach(measure => {
        const barline = document.createElement("div");

        barline.className = "barline dynamic";
        barline.style.left = `${measure.startX}px`;

        staff.appendChild(barline);
    });

    updateStaffWidth();
}



function renderStaffLines() {
    staff.querySelectorAll(".staff-line").forEach(line => line.remove());

    for (let i = 0; i < 5; i++) {
        const line = document.createElement("div");

        line.className = "staff-line";
        line.style.left = "100px";
        line.style.width = `${Math.max(
            0,
            measures[measures.length - 1].endX - 100
        )}px`;
        line.style.top = `${lineSpacing + i * lineSpacing}px`;

        staff.appendChild(line);
    }
}


// ========================================
// CLEF & PITCH
// ========================================


function getPitchFromY(y) {
    const letterNames = ["C", "D", "E", "F", "G", "A", "B"];

    // Garis paling bawah paranada berada di y = 110
    const bottomLineY = lineSpacing * 5;

    // Setiap langkah berpindah satu garis atau satu spasi
    const step = Math.round((bottomLineY - y) / staffStep);

    // Indeks nada pada garis paling bawah:
    // Treble clef: E4
    // Bass clef: G2
    const baseIndex = currentClef === "bass"
        ? 2 * 7 + 4
        : 4 * 7 + 2;

    const absoluteIndex = baseIndex + step;
    const letterIndex =
        ((absoluteIndex % 7) + 7) % 7;
    const octave = Math.floor(absoluteIndex / 7);

    return `${letterNames[letterIndex]}${octave}`;
}

function refreshNotePitches() {
    notes.forEach(note => {
        if (note.isRest) return;

        note.pitch = getPitchFromY(note.y);

        if (note.element) {
            note.element.dataset.pitch = note.pitch;
        }
    });
}


// ========================================
// TIME SIGNATURE
// ========================================

function renderTimeSignature() {
    const signature = document.querySelector(".time-signature");

    if (signature) {
        signature.replaceChildren();

        const numerator = document.createElement("span");
        const denominator = document.createElement("span");

        numerator.textContent = String(timeSignature.beats);
        denominator.textContent = String(timeSignature.beatUnit);

        signature.append(numerator, denominator);
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
            (currentIndex + 1) % supportedTimeSignatures.length
        ];

    // Do not allow a meter change that makes existing notes
    // exceed the capacity of their measure.
    const hasOverflow = measures.some(measure =>
        notes
            .filter(note => note.measure === measure.number)
            .some(note =>
                note.beatPosition + note.beats > nextSignature.beats
            )
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

    console.log("Time signature changed:", { ...timeSignature });
}

if (clefControl) {
    clefControl.addEventListener("click", () => {
        currentClef = currentClef === "treble" ? "bass" : "treble";

        renderClef();
        refreshNotePitches();

        console.log("Clef changed:", currentClef);
    });
}

if (signatureControl) {
    signatureControl.addEventListener("click", changeTimeSignature);
}

// ========================================
// NOTE POSITIONING
// ========================================


function getBeatWidth(measure) {
    const measureWidth = measure.endX - measure.startX;
    const noteAreaWidth = measureWidth - 100;

    return noteAreaWidth / timeSignature.beats;
}

function getNextBeatPosition(measureNumber) {
    const measure = getMeasure(measureNumber);

    if (!measure) return null;

    const usedBeats = getMeasureBeats(measureNumber);

    return getNoteX(measureNumber, usedBeats);
}

function getNoteX(measureNumber, beatPosition) {
    const measure = getMeasure(measureNumber);

    if (!measure) return 0;

    const beatWidth = getBeatWidth(measure);

    return measure.startX + 50 + beatPosition * beatWidth;
}


// ========================================
// NOTE & REST ELEMENTS
// ========================================

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
    document.querySelectorAll("button[data-duration]").forEach(button => {
        const selected =
            button.dataset.duration === selectedDuration;

        button.classList.toggle("active", selected);
        button.setAttribute("aria-pressed", String(selected));
    });
}

document.querySelectorAll("button[data-duration]").forEach(button => {
    button.addEventListener("click", () => {
        const duration = button.dataset.duration;

        if (!Object.hasOwn(durationBeats, duration)) {
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
    const measure = getCurrentMeasure();
    const beats = durationBeats[selectedDuration];
    const usedBeats = getMeasureBeats(measure.number);

    if (usedBeats + beats > timeSignature.beats) {
        console.warn("Measure capacity exceeded.");
        return;
    }

    const beatPosition = usedBeats;
    const snappedY = getSnappedY(y);

    const noteData = {
        x: getNextBeatPosition(measure.number),
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

    console.log("Note added:", {
        pitch: noteData.pitch,
        measure: noteData.measure,
        beatPosition,
        duration: selectedDuration,
        status: getMeasureStatus(measure.number)
    });
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

    const note = notes.find(item => item.element === element);

    if (!note || note.isRest) return;

    note.isRest = true;
    note.pitch = null;

    renderMusicElement(note);

    console.log("Note converted to rest:", note.measure);
});

// ========================================
// DRAG NOTES VERTICALLY
// ========================================

staff.addEventListener("pointerdown", event => {
    const element = event.target.closest(".note");

    if (!element || !staff.contains(element)) return;

    const note = notes.find(item => item.element === element);

    if (!note || note.isRest) return;

    draggedNote = element;
    hasDragged = false;
    dragStartY = note.y;

    element.setPointerCapture(event.pointerId);
});

staff.addEventListener("pointermove", event => {
    if (!draggedNote) return;

    const rect = staff.getBoundingClientRect();
    const y = getSnappedY(event.clientY - rect.top);

    draggedNote.style.top = `${y}px`;

    if (Math.abs(y - dragStartY) > 2) {
        hasDragged = true;
    }
});

function finishDrag() {
    if (!draggedNote) return;

    const element = draggedNote;
    const note = notes.find(item => item.element === element);

    if (note && hasDragged) {
        note.y = getSnappedY(parseFloat(element.style.top));
        note.pitch = getPitchFromY(note.y);
        note.x = getNoteX(note.measure, note.beatPosition);

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
        const stored = localStorage.getItem(PROJECT_STORAGE_KEY);
        const projects = stored ? JSON.parse(stored) : {};

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
        measures: measures.map(measure => ({ ...measure })),
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
    const input = prompt("Nama komposisi:", currentProjectName);

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

        console.log("Project saved:", name);
    } catch (error) {
        console.error("Save failed:", error);
        alert("Komposisi gagal disimpan di browser.");
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
        if (!confirm("Mulai komposisi baru? Simpan pekerjaanmu terlebih dahulu.")) {
            return;
        }
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
    if (!data || data.format !== "LARAS") {
        throw new Error("File bukan komposisi LARAS yang valid.");
    }

    if (!Array.isArray(data.notes) || !Array.isArray(data.measures)) {
        throw new Error("Data notasi atau birama tidak valid.");
    }

    const signature = data.timeSignature || {
        beats: 4,
        beatUnit: 4
    };

    if (
        ![2, 3, 4].includes(signature.beats) ||
        signature.beatUnit !== 4
    ) {
        throw new Error("Time signature belum didukung.");
    }

    const clef = data.clef === "bass" ? "bass" : "treble";

    const normalizedMeasures = data.measures
        .filter(measure =>
            measure &&
            Number.isInteger(measure.number) &&
            measure.number >= 1 &&
            Number.isFinite(measure.startX) &&
            Number.isFinite(measure.endX) &&
            measure.endX > measure.startX
        )
        .map(measure => ({
            number: measure.number,
            startX: measure.startX,
            endX: measure.endX
        }))
        .sort((a, b) => a.number - b.number);

    if (!normalizedMeasures.length) {
        throw new Error("Tidak ditemukan birama yang valid.");
    }

    const normalizedNotes = data.notes.map(note => {
        if (
            !note ||
            !Object.hasOwn(durationBeats, note.duration) ||
            !Number.isInteger(note.measure) ||
            note.measure < 1 ||
            !Number.isFinite(note.beatPosition) ||
            note.beatPosition < 0 ||
            !Number.isFinite(note.y)
        ) {
            throw new Error("Data salah satu not tidak valid.");
        }

        const isRest = Boolean(note.isRest);
        const pitch = isRest ? null : note.pitch;

        if (!isRest && !pitchNames.includes(pitch)) {
            throw new Error("Pitch pada file tidak valid.");
        }

        return {
            x: Number.isFinite(note.x) ? note.x : 0,
            y: note.y,
            pitch,
            duration: note.duration,
            beats: durationBeats[note.duration],
            beatPosition: note.beatPosition,
            measure: note.measure,
            isRest,
            element: null
        };
    });

    const maxMeasure = Math.max(
        2,
        ...normalizedMeasures.map(measure => measure.number),
        ...normalizedNotes.map(note => note.measure)
    );

    if (maxMeasure > 500) {
        throw new Error("File memiliki terlalu banyak birama.");
    }

    const firstMeasure = normalizedMeasures[0];
    const width = firstMeasure.endX - firstMeasure.startX;
    const measureMap = new Map();

    normalizedMeasures.forEach(measure => {
        measureMap.set(measure.number, measure);
    });

    for (let number = 1; number <= maxMeasure; number++) {
        if (!measureMap.has(number)) {
            const startX = firstMeasure.startX + (number - 1) * width;

            measureMap.set(number, {
                number,
                startX,
                endX: startX + width
            });
        }
    }

    const finalMeasures = Array.from(measureMap.values())
        .sort((a, b) => a.number - b.number);

    // Verify that notes do not overlap or exceed measure capacity.
    for (const measure of finalMeasures) {
        const measureNotes = normalizedNotes
            .filter(note => note.measure === measure.number)
            .sort((a, b) => a.beatPosition - b.beatPosition);

        let previousEnd = 0;

        for (const note of measureNotes) {
            if (
                note.beatPosition + note.beats > signature.beats ||
                note.beatPosition < previousEnd
            ) {
                throw new Error(
                    `Susunan ketukan pada birama ${measure.number} tidak valid.`
                );
            }

            previousEnd = note.beatPosition + note.beats;
        }
    }

    return {
        name: typeof data.name === "string" && data.name.trim()
            ? data.name.trim()
            : "Imported composition",
        clef,
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
    // Validate everything before replacing the current composition.
    const project = normalizeProject(data);

    clearComposition();

    currentProjectName = project.name;
    currentClef = project.clef;

    timeSignature.beats = project.timeSignature.beats;
    timeSignature.beatUnit = project.timeSignature.beatUnit;

    measures = project.measures;

    project.notes.forEach(note => {
        notes.push(note);
        renderMusicElement(note);
    });

    renderMeasures();
    reflowNotes();
    refreshNotePitches();

    renderClef();
    renderTimeSignature();
    updateProjectStatus(`Opened: ${currentProjectName}`);

    console.log("Project loaded:", currentProjectName);
}

// ========================================
// OPEN PROJECT
// ========================================

function openProject() {
    const projects = getSavedProjects();
    const names = Object.keys(projects);

    if (!names.length) {
        alert("Belum ada komposisi tersimpan di browser ini.");
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

    if (!Number.isInteger(index) || index < 0 || index >= names.length) {
        alert("Nomor komposisi tidak valid.");
        return;
    }

    if (
        notes.length > 0 &&
        !confirm("Komposisi saat ini akan diganti. Lanjutkan?")
    ) {
        return;
    }

    try {
        loadProjectData(projects[names[index]]);
    } catch (error) {
        console.error("Open failed:", error);
        alert(`Komposisi gagal dibuka: ${error.message}`);
    }
}

// ========================================
// EXPORT PROJECT AS JSON
// ========================================

function exportProject() {
    try {
        const data = buildProjectData();
        const blob = new Blob(
            [JSON.stringify(data, null, 2)],
            { type: "application/json" }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        const safeName = currentProjectName
            .replace(/[^a-z0-9_-]+/gi, "-")
            .replace(/^-+|-+$/g, "") || "laras-composition";

        link.href = url;
        link.download = `${safeName}.json`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 1000);

        updateProjectStatus(`Exported: ${currentProjectName}`);
    } catch (error) {
        console.error("Export failed:", error);
        alert("Komposisi gagal diekspor.");
    }
}

// ========================================
// IMPORT PROJECT FROM JSON
// ========================================

function importProject() {
    importProjectFile?.click();
}

if (importProjectFile) {
    importProjectFile.addEventListener("change", async event => {
        const file = event.target.files?.[0];

        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (
                notes.length > 0 &&
                !confirm("Komposisi saat ini akan diganti. Lanjutkan impor?")
            ) {
                return;
            }

            loadProjectData(data);
        } catch (error) {
            console.error("Import failed:", error);
            alert(`Impor gagal: ${error.message}`);
        } finally {
            importProjectFile.value = "";
        }
    });
}

// ========================================
// CONNECT PROJECT BUTTONS
// ========================================

if (newProjectButton) {
    newProjectButton.addEventListener("click", createNewProject);
}

if (saveProjectButton) {
    saveProjectButton.addEventListener("click", saveProject);
}

if (openProjectButton) {
    openProjectButton.addEventListener("click", openProject);
}

if (exportProjectButton) {
    exportProjectButton.addEventListener("click", exportProject);
}

if (importProjectButton) {
    importProjectButton.addEventListener("click", importProject);
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
