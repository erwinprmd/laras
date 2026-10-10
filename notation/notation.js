
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

    // Treble clef: garis paling atas adalah F.
    // Bass clef: garis paling atas adalah A.
    const topLineIndex = currentClef === "bass" ? 5 : 3;

    return pitchNames[
        ((topLineIndex - step) % 7 + 7) % 7
    ];
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


 
// =========================
// LARAS PROJECT MANAGEMENT
// =========================

const PROJECT_STORAGE_KEY = "laras_saved_compositions_v1";

let currentProjectName = "Untitled composition";

const projectStatus = document.getElementById("projectStatus");
const newProjectButton = document.getElementById("newProject");
const saveProjectButton = document.getElementById("saveProject");
const openProjectButton = document.getElementById("openProject");
const exportProjectButton = document.getElementById("exportProject");
const importProjectButton = document.getElementById("importProject");
const importProjectFile = document.getElementById("importProjectFile");

function updateProjectStatus(message) {
    if (projectStatus) {
        projectStatus.textContent = message;
    }
}

function getSavedProjects() {
    try {
        const stored = localStorage.getItem(PROJECT_STORAGE_KEY);
        const projects = stored ? JSON.parse(stored) : {};

        if (!projects || typeof projects !== "object" || Array.isArray(projects)) {
            return {};
        }

        return projects;
    } catch (error) {
        console.error("Unable to read saved projects:", error);
        return {};
    }
}

function buildProjectData() {
    return {
        format: "LARAS",
        version: 1,
        name: currentProjectName,
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
            isRest: Boolean(note.isRest)
        })),
        updatedAt: new Date().toISOString()
    };
}

function saveProject() {
    const nameInput = currentProjectName === "Untitled composition"
        ? prompt("Nama komposisi:", currentProjectName)
        : prompt("Simpan komposisi sebagai:", currentProjectName);

    if (nameInput === null) return;

    const name = nameInput.trim();

    if (!name) {
        alert("Nama komposisi tidak boleh kosong.");
        return;
    }

    try {
        const projects = getSavedProjects();

        currentProjectName = name;

        const data = buildProjectData();
        data.name = name;

        projects[name] = data;

        localStorage.setItem(
            PROJECT_STORAGE_KEY,
            JSON.stringify(projects)
        );

        updateProjectStatus(`Saved: ${name}`);

        console.log("Project saved:", name);
    } catch (error) {
        console.error("Unable to save project:", error);
        alert("Komposisi gagal disimpan. Penyimpanan browser mungkin penuh atau tidak tersedia.");
    }
}

function clearComposition() {
    notes.forEach(note => {
        if (note.element) note.element.remove();
    });

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
            "Mulai komposisi baru? Pastikan komposisi saat ini sudah disimpan."
        );

        if (!confirmed) return;
    }

    clearComposition();

    currentProjectName = "Untitled composition";
    updateProjectStatus(currentProjectName);

    console.log("New composition created.");
}

function normalizeProject(data) {
    if (!data || typeof data !== "object" || data.format !== "LARAS") {
        throw new Error("File bukan komposisi LARAS yang valid.");
    }

    if (!Array.isArray(data.notes) || !Array.isArray(data.measures)) {
        throw new Error("Data notasi atau birama tidak valid.");
    }

    const validDurations = Object.keys(durationBeats);

    const normalizedNotes = data.notes.map(note => {
        if (
            !note ||
            !validDurations.includes(note.duration) ||
            !Number.isInteger(note.measure) ||
            note.measure < 1 ||
            !Number.isFinite(note.beatPosition) ||
            note.beatPosition < 0 ||
            !Number.isFinite(note.y)
        ) {
            throw new Error("Ditemukan data notasi yang tidak valid.");
        }

        const beats = durationBeats[note.duration];

        if (note.isRest) {
            return {
                x: Number(note.x) || 0,
                y: note.y,
                pitch: null,
                duration: note.duration,
                beats,
                beatPosition: note.beatPosition,
                measure: note.measure,
                isRest: true,
                element: null
            };
        }

        if (!pitchNames.includes(note.pitch)) {
            throw new Error("Ditemukan pitch yang tidak valid.");
        }

        return {
            x: Number(note.x) || 0,
            y: note.y,
            pitch: note.pitch,
            duration: note.duration,
            beats,
            beatPosition: note.beatPosition,
            measure: note.measure,
            isRest: false,
            element: null
        };
    });

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

    if (normalizedMeasures.length === 0) {
        throw new Error("File tidak memiliki data birama yang valid.");
    }

    const maxMeasureNumber = Math.max(
        2,
        ...normalizedNotes.map(note => note.measure),
        ...normalizedMeasures.map(measure => measure.number)
    );

    const firstMeasure = normalizedMeasures[0];
    const measureWidth = firstMeasure.endX - firstMeasure.startX;

    const measureMap = new Map(
        normalizedMeasures.map(measure => [measure.number, measure])
    );

    for (let number = 1; number <= maxMeasureNumber; number++) {
        if (!measureMap.has(number)) {
            const startX = firstMeasure.startX + (number - 1) * measureWidth;

            measureMap.set(number, {
                number,
                startX,
                endX: startX + measureWidth
            });
        }
    }

    return {
        name: typeof data.name === "string" && data.name.trim()
            ? data.name.trim()
            : "Imported composition",
        notes: normalizedNotes,
        measures: Array.from(measureMap.values())
            .sort((a, b) => a.number - b.number)
    };
}

function loadProjectData(data) {
    const normalized = normalizeProject(data);

    // Validate the complete composition before replacing the current one.
    const measureMap = new Map(
        normalized.measures.map(measure => [measure.number, measure])
    );

    for (const note of normalized.notes) {
        const measure = measureMap.get(note.measure);

        if (!measure) {
            throw new Error("Birama untuk salah satu not tidak ditemukan.");
        }

        if (note.beatPosition + note.beats > timeSignature.beats) {
            throw new Error("Terdapat not yang melebihi kapasitas birama 4/4.");
        }
    }

    clearComposition();

    measures = normalized.measures;
    currentProjectName = normalized.name;

    normalized.notes.forEach(note => {
        notes.push(note);
        renderMusicElement(note);
    });

    renderMeasures();
    reflowNotes();

    updateProjectStatus(`Opened: ${currentProjectName}`);

    console.log("Project opened:", currentProjectName);
    console.log("Loaded notes:", notes.length);
}

function openProject() {
    const projects = getSavedProjects();
    const names = Object.keys(projects);

    if (names.length === 0) {
        alert("Belum ada komposisi tersimpan di browser ini.");
        return;
    }

    const menu = names
        .map((name, index) => `${index + 1}. ${name}`)
        .join("\n");

    const choice = prompt(
        `Pilih nomor komposisi yang ingin dibuka:\n\n${menu}`
    );

    if (choice === null) return;

    const index = Number(choice) - 1;

    if (!Number.isInteger(index) || index < 0 || index >= names.length) {
        alert("Pilihan tidak valid.");
        return;
    }

    const name = names[index];

    if (notes.length > 0) {
        const confirmed = confirm(
            "Membuka komposisi akan mengganti notasi saat ini. Lanjutkan?"
        );

        if (!confirmed) return;
    }

    try {
        loadProjectData(projects[name]);
    } catch (error) {
        console.error("Unable to open project:", error);
        alert(`Komposisi tidak dapat dibuka: ${error.message}`);
    }
}

function exportProject() {
    try {
        const data = buildProjectData();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], {
            type: "application/json"
        });

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

        URL.revokeObjectURL(url);

        updateProjectStatus(`Exported: ${currentProjectName}`);
    } catch (error) {
        console.error("Export failed:", error);
        alert("Komposisi gagal diekspor.");
    }
}

function importProject() {
    if (importProjectFile) {
        importProjectFile.click();
    }
}

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

if (importProjectFile) {
    importProjectFile.addEventListener("change", async event => {
        const file = event.target.files?.[0];

        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (notes.length > 0) {
                const confirmed = confirm(
                    "Mengimpor file akan mengganti notasi saat ini. Lanjutkan?"
                );

                if (!confirmed) return;
            }

            loadProjectData(data);
        } catch (error) {
            console.error("Import failed:", error);
            alert(`File gagal diimpor: ${error.message}`);
        } finally {
            event.target.value = "";
        }
    });
}

updateProjectStatus(currentProjectName);


// =========================
// CLEF & TIME SIGNATURE
// =========================

let currentClef = "treble";

const clefControl = document.getElementById("trebleClef");
const signatureControl = document.getElementById("timeSignature");

function renderClef() {
    const clefElement = document.querySelector(".clef");

    if (clefElement) {
        clefElement.textContent =
            currentClef === "bass" ? "𝄢" : "𝄞";
    }

    if (clefControl) {
        clefControl.textContent =
            currentClef === "bass" ? "Bass Clef" : "Treble Clef";
    }
}

function renderTimeSignature() {
    const signature = document.querySelector(".time-signature");

    if (signature) {
        signature.innerHTML = `
            <span>${timeSignature.beats}</span>
            <span>${timeSignature.beatUnit}</span>
        `;
    }

    if (signatureControl) {
        signatureControl.textContent =
            `${timeSignature.beats}/${timeSignature.beatUnit}`;
    }
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

if (clefControl) {
    clefControl.addEventListener("click", () => {
        currentClef =
            currentClef === "treble" ? "bass" : "treble";

        renderClef();
        refreshNotePitches();

        console.log("Clef changed:", currentClef);
    });
}

// Only allow time signatures supported by the current engine.
const supportedTimeSignatures = [
    { beats: 2, beatUnit: 4 },
    { beats: 3, beatUnit: 4 },
    { beats: 4, beatUnit: 4 }
];

if (signatureControl) {
    signatureControl.addEventListener("click", () => {
        const currentIndex = supportedTimeSignatures.findIndex(
            signature =>
                signature.beats === timeSignature.beats &&
                signature.beatUnit === timeSignature.beatUnit
        );

        const nextIndex =
            (currentIndex + 1) % supportedTimeSignatures.length;

        const nextSignature =
            supportedTimeSignatures[nextIndex];

        const hasOverflow = measures.some(measure =>
            getMeasureBeats(measure.number) > nextSignature.beats
        );

        if (hasOverflow) {
            alert(
                `Birama ${nextSignature.beats}/4 tidak dapat digunakan karena ada birama yang berisi lebih dari ${nextSignature.beats} ketukan.`
            );
            return;
        }

        timeSignature.beats = nextSignature.beats;
        timeSignature.beatUnit = nextSignature.beatUnit;

        renderTimeSignature();
        reflowNotes();

        console.log("Time signature changed:", {
            ...timeSignature
        });
    });
}

renderClef();
renderTimeSignature();
