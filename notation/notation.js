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

const measures = [
{
number: 1,
startX: 100,
endX: 1000
},
{
number: 2,
startX: 1000,
endX: 1900
}
];

// =========================
// MEASURE INFO
// =========================

const firstMeasure = measures[0];

const measureWidth =
firstMeasure.endX - firstMeasure.startX;

console.log("Measure 1:", {
startX: firstMeasure.startX,
endX: firstMeasure.endX,
width: measureWidth
});

// =========================
// BARLINE
// =========================

const barline =
document.querySelector(".barline");

barline.style.left =
`${firstMeasure.endX}px`;

// =========================
// MUSIC SETTINGS
// =========================

let selectedDuration = "quarter";

const timeSignature = {
beats: 4,
beatUnit: 4
};

const beatDuration =
1 / timeSignature.beatUnit;

const durationBeats = {
whole: 4,
half: 2,
quarter: 1,
eighth: 0.5
};

// =========================
// MEASURE BEATS
// =========================

function getMeasureBeats(measureNumber) {


return notes
    .filter(
        note => note.measure === measureNumber
    )
    .reduce(
        (total, note) =>
            total + note.beats,
        0
    );


}

// =========================
// MEASURE STATUS
// =========================

function getMeasureStatus(measureNumber) {


const beats =
    getMeasureBeats(measureNumber);

const maxBeats =
    timeSignature.beats;

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

// =========================
// CURRENT MEASURE
// =========================

function getCurrentMeasure() {

```
for (const measure of measures) {

    const status =
        getMeasureStatus(
            measure.number
        );

    if (
        status !== "FULL" &&
        status !== "OVERFULL"
    ) {
        return measure;
    }

}

return null;


}

console.log(
"Current Measure:",
getCurrentMeasure()
);

console.log(
"Time Signature:",
{
beats: timeSignature.beats,
beatUnit: timeSignature.beatUnit,
beatDuration
}
);

// =========================
// DRAG STATE
// =========================

let draggedNote = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

let suppressClickUntil = 0;
let hasDragged = false;

// =========================
// DURATION BUTTONS
// =========================

const durationButtons =
document.querySelectorAll(
"[data-duration]"
);

durationButtons.forEach(button => {


button.addEventListener(
    "click",
    () => {

        selectedDuration =
            button.dataset.duration;

        console.log(
            "Duration selected:",
            selectedDuration
        );

    }
);


});

// =========================
// CLICK STAFF
// =========================

staff.addEventListener(
"click",
(event) => {


    // Ignore click after drag
    if (
        Date.now() <
        suppressClickUntil
    ) {
        return;
    }


    // =========================
    // REMOVE NOTE
    // =========================

    if (
        event.target.closest(".note")
    ) {

        const noteElement =
            event.target.closest(".note");

        const index =
            notes.findIndex(
                note =>
                    note.element ===
                    noteElement
            );

        if (index !== -1) {
            notes.splice(index, 1);
        }

        noteElement.remove();

        console.log(
            "Note removed"
        );

        console.log(
            "Current Measure:",
            getCurrentMeasure()
        );

        return;
    }


    // =========================
    // GET CURRENT MEASURE
    // =========================

    const currentMeasure =
        getCurrentMeasure();

    if (!currentMeasure) {

        console.warn(
            "No available measure."
        );

        return;
    }


    // =========================
    // POSITION
    // =========================

    const rect =
        staff.getBoundingClientRect();

    const x =
        event.clientX -
        rect.left;

    const rawY =
        event.clientY -
        rect.top;


    // Snap to staff
    const y =
        Math.round(
            rawY / staffStep
        ) * staffStep;


    // =========================
    // PITCH
    // =========================

    const topLineY =
        lineSpacing;

    const step =
        Math.round(
            (y - topLineY) /
            staffStep
        );


    // Top line = F
    const pitch =
        pitchNames[
            ((3 - step) % 7 + 7) % 7
        ];


    // =========================
    // CREATE NOTE
    // =========================

    const note =
        document.createElement(
            "span"
        );

    note.className =
        `note ${selectedDuration}`;

    note.textContent = "";

    note.dataset.pitch =
        pitch;


    // =========================
    // STEM
    // =========================

    if (
        selectedDuration !== "whole"
    ) {

        const stem =
            document.createElement(
                "span"
            );

        stem.className =
            "stem";

        note.appendChild(stem);


        // Eighth note flag
        if (
            selectedDuration ===
            "eighth"
        ) {

            const flag =
                document.createElement(
                    "span"
                );

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
    // SAVE NOTE
    // =========================

    const noteData = {

        x,
        y,
        pitch,

        duration:
            selectedDuration,

        beats:
            durationBeats[
                selectedDuration
            ],

        measure:
            currentMeasure.number,

        element:
            note

    };

    notes.push(noteData);


    // =========================
    // DEBUG
    // =========================

    console.log(
        "Note added:",
        {
            x,
            y,
            pitch,
            duration:
                selectedDuration,
            beats:
                noteData.beats,
            measure:
                noteData.measure
        }
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

}


);

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
        event.clientX -
        rect.left;

    dragOffsetY =
        event.clientY -
        rect.top;


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
    // CALCULATE PITCH
    // =========================

    const topLineY =
        lineSpacing;

    const step =
        Math.round(
            (y - topLineY) /
            staffStep
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
    // DRAG COMPLETE
    // =========================

    if (hasDragged) {

        console.log(
            "Note moved:",
            {
                x,
                y,
                pitch
            }
        );


        suppressClickUntil =
            Date.now() + 300;

    }


    draggedNote = null;
    hasDragged = false;

}

);
