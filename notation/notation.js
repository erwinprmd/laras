const staff = document.querySelector(".staff");

const notes = [];

staff.addEventListener("click", (event) => {

    const rect = staff.getBoundingClientRect();

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const note = document.createElement("span");

    note.className = "note";
    note.textContent = "●";

    note.style.left = `${x}px`;
    note.style.top = `${y}px`;

    staff.appendChild(note);

    notes.push({
        x,
        y
    });

    console.log("Note added:", {
        x,
        y
    });

});
