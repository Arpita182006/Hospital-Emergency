/* =====================================================
   MEDQUEUE - GITHUB PAGES VERSION
   Hospital Emergency Queue Management System
===================================================== */


/* =====================================================
   DATA STORAGE
===================================================== */

let emergencyQueue =
    JSON.parse(localStorage.getItem("emergencyQueue")) || [];

let waitingQueue =
    JSON.parse(localStorage.getItem("waitingQueue")) || [];

let treatmentHistory =
    JSON.parse(localStorage.getItem("treatmentHistory")) || [];


/* =====================================================
   SAVE DATA
===================================================== */

function saveData() {

    localStorage.setItem(
        "emergencyQueue",
        JSON.stringify(emergencyQueue)
    );

    localStorage.setItem(
        "waitingQueue",
        JSON.stringify(waitingQueue)
    );

    localStorage.setItem(
        "treatmentHistory",
        JSON.stringify(treatmentHistory)
    );
}


/* =====================================================
   PAGE NAVIGATION
===================================================== */

const navItems =
    document.querySelectorAll(".nav-item");

const pages =
    document.querySelectorAll(".page");

navItems.forEach(item => {

    item.addEventListener("click", function () {

        const pageName =
            this.getAttribute("data-page");

        navItems.forEach(nav => {
            nav.classList.remove("active");
        });

        this.classList.add("active");

        pages.forEach(page => {
            page.classList.remove("active");
        });

        const selectedPage =
            document.getElementById(pageName);

        if (selectedPage) {
            selectedPage.classList.add("active");
        }

        const sidebar =
            document.getElementById("sidebar");

        if (sidebar) {
            sidebar.classList.remove("open");
        }

    });

});


/* =====================================================
   MOBILE MENU
===================================================== */

const menuBtn =
    document.getElementById("menuBtn");

const sidebar =
    document.getElementById("sidebar");

if (menuBtn) {

    menuBtn.addEventListener("click", function () {

        sidebar.classList.toggle("open");

    });

}


/* =====================================================
   DATE
===================================================== */

function showDate() {

    const dateElement =
        document.getElementById("dateDisplay");

    if (!dateElement) return;

    const today = new Date();

    dateElement.textContent =
        today.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
}

showDate();


/* =====================================================
   TOAST MESSAGE
===================================================== */

function showToast(message) {

    const toast =
        document.getElementById("toast");

    if (!toast) return;

    toast.textContent = message;

    toast.classList.add("show");

    setTimeout(function () {

        toast.classList.remove("show");

    }, 2500);
}


/* =====================================================
   ESCAPE HTML
===================================================== */

function escapeHTML(value) {

    if (value === undefined || value === null) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =====================================================
   INITIALS
===================================================== */

function getInitials(name) {

    if (!name) {
        return "P";
    }

    const words =
        name.trim().split(/\s+/);

    if (words.length === 1) {

        return words[0]
            .substring(0, 2)
            .toUpperCase();

    }

    return (
        words[0][0] +
        words[words.length - 1][0]
    ).toUpperCase();
}


/* =====================================================
   PRIORITY TEXT
===================================================== */

function priorityText(priority) {

    priority = Number(priority);

    if (priority === 1) {
        return "Critical";
    }

    if (priority === 2) {
        return "Serious";
    }

    if (priority === 3) {
        return "Moderate";
    }

    return "Normal";
}


/* =====================================================
   SORT EMERGENCY QUEUE
   1 = Critical
   2 = Serious
   3 = Moderate
   4 = Normal
===================================================== */

function sortEmergencyQueue() {

    emergencyQueue.sort(function (a, b) {

        return Number(a.priority) -
               Number(b.priority);

    });
}


/* =====================================================
   REGISTER PATIENT
===================================================== */

const patientForm =
    document.getElementById("patientForm");

if (patientForm) {

    patientForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();


            const id =
                document
                    .getElementById("patientId")
                    .value
                    .trim();


            const name =
                document
                    .getElementById("patientName")
                    .value
                    .trim();


            const age =
                document
                    .getElementById("patientAge")
                    .value;


            const gender =
                document
                    .getElementById("patientGender")
                    .value;


            const problem =
                document
                    .getElementById("patientProblem")
                    .value
                    .trim();


            const type =
                document
                    .getElementById("patientType")
                    .value;


            const priority =
                document
                    .getElementById("patientPriority")
                    .value;


            /* Check ID */

            if (!id ||
                !name ||
                !age ||
                !gender ||
                !problem ||
                !type) {

                showToast(
                    "Please fill all fields"
                );

                return;
            }


            /* Check duplicate ID */

            const duplicateEmergency =
                emergencyQueue.some(
                    patient => patient.id === id
                );

            const duplicateWaiting =
                waitingQueue.some(
                    patient => patient.id === id
                );

            const duplicateHistory =
                treatmentHistory.some(
                    patient => patient.id === id
                );


            if (
                duplicateEmergency ||
                duplicateWaiting ||
                duplicateHistory
            ) {

                showToast(
                    "Patient ID already exists"
                );

                return;
            }


            /* Create patient */

            const patient = {

                id: id,

                name: name,

                age: age,

                gender: gender,

                problem: problem,

                type: type,

                priority: Number(priority),

                registeredAt:
                    new Date().toLocaleString("en-IN")

            };


            /* Emergency patient */

            if (type === "Emergency") {

                emergencyQueue.push(patient);

                sortEmergencyQueue();

            }

            /* Normal patient */

            else {

                waitingQueue.push(patient);

            }


            saveData();

            patientForm.reset();

            document.getElementById(
                "formMsg"
            ).innerHTML = `
                <span style="color:#15966f">
                    ✓ Patient registered successfully.
                </span>
            `;


            showToast(
                "Patient registered successfully"
            );


            renderAll();

        }
    );

}


/* =====================================================
   TREAT EMERGENCY PATIENT
===================================================== */

const treatEmergencyBtn =
    document.getElementById(
        "treatEmergencyBtn"
    );

if (treatEmergencyBtn) {

    treatEmergencyBtn.addEventListener(
        "click",
        function () {

            treatNextPatient();

        }
    );

}


/* =====================================================
   TREAT NEXT PATIENT
===================================================== */

function treatNextPatient() {

    let patient = null;


    /* Priority Queue first */

    if (emergencyQueue.length > 0) {

        sortEmergencyQueue();

        patient =
            emergencyQueue.shift();

    }

    /* Then normal FIFO queue */

    else if (waitingQueue.length > 0) {

        patient =
            waitingQueue.shift();

    }


    if (!patient) {

        showToast(
            "No patient waiting"
        );

        return;
    }


    /* Add to history */

    treatmentHistory.unshift(patient);


    saveData();

    renderAll();


    showToast(
        patient.name +
        " treated successfully"
    );

}


/* =====================================================
   TREAT SPECIFIC PATIENT
===================================================== */

function treatPatient(id) {

    let patient = null;


    /* Search emergency queue */

    const emergencyIndex =
        emergencyQueue.findIndex(
            p => p.id === id
        );


    if (emergencyIndex !== -1) {

        patient =
            emergencyQueue.splice(
                emergencyIndex,
                1
            )[0];

    }


    /* Search waiting queue */

    if (!patient) {

        const waitingIndex =
            waitingQueue.findIndex(
                p => p.id === id
            );


        if (waitingIndex !== -1) {

            patient =
                waitingQueue.splice(
                    waitingIndex,
                    1
                )[0];

        }

    }


    if (!patient) {

        showToast(
            "Patient not found"
        );

        return;
    }


    /* Add to history */

    treatmentHistory.unshift(patient);


    saveData();

    renderAll();


    showToast(
        patient.name +
        " treated successfully"
    );

}


/* =====================================================
   DASHBOARD
===================================================== */

function updateDashboard() {

    const totalElement =
        document.getElementById(
            "totalPatients"
        );

    const criticalElement =
        document.getElementById(
            "criticalPatients"
        );

    const waitingElement =
        document.getElementById(
            "waitingPatients"
        );

    const treatedElement =
        document.getElementById(
            "treatedPatients"
        );


    const totalPatients =
        emergencyQueue.length +
        waitingQueue.length +
        treatmentHistory.length;


    const criticalPatients =
        emergencyQueue.filter(
            patient =>
                Number(patient.priority) === 1
        ).length;


    const waitingPatients =
        emergencyQueue.length +
        waitingQueue.length;


    const treatedPatients =
        treatmentHistory.length;


    if (totalElement) {

        totalElement.textContent =
            totalPatients;

    }


    if (criticalElement) {

        criticalElement.textContent =
            criticalPatients;

    }


    if (waitingElement) {

        waitingElement.textContent =
            waitingPatients;

    }


    if (treatedElement) {

        treatedElement.textContent =
            treatedPatients;

    }


    updateNextPatient();

}


/* =====================================================
   NEXT EMERGENCY PATIENT
===================================================== */

function updateNextPatient() {

    const container =
        document.getElementById(
            "nextPatient"
        );

    if (!container) return;


    sortEmergencyQueue();


    if (emergencyQueue.length === 0) {

        container.innerHTML = `

            <div class="empty">
                No emergency patients waiting.
            </div>

        `;

        return;
    }


    const patient =
        emergencyQueue[0];


    container.innerHTML = `

        <div class="next-patient">

            <div class="avatar">

                ${getInitials(patient.name)}

            </div>

            <div>

                <strong>
                    ${escapeHTML(patient.name)}
                </strong>

                <small>

                    ID: ${escapeHTML(patient.id)}

                    • ${escapeHTML(patient.problem)}

                </small>

                <span
                    class="priority p${patient.priority}">

                    ${priorityText(patient.priority)}

                </span>

            </div>

        </div>

    `;
}


/* =====================================================
   EMERGENCY QUEUE TABLE
===================================================== */

function renderEmergencyQueue() {

    const table =
        document.getElementById(
            "emergencyTable"
        );

    if (!table) return;


    sortEmergencyQueue();


    if (emergencyQueue.length === 0) {

        table.innerHTML = `

            <tr>

                <td colspan="5">

                    <div class="empty">
                        No emergency patients.
                    </div>

                </td>

            </tr>

        `;

        return;
    }


    table.innerHTML =
        emergencyQueue.map(function (patient) {

            return `

                <tr>

                    <td>

                        <div class="patient-cell">

                            <div class="avatar">
                                ${getInitials(patient.name)}
                            </div>

                            <div>

                                <b>
                                    ${escapeHTML(patient.name)}
                                </b>

                                <small>
                                    ${escapeHTML(patient.id)}
                                </small>

                            </div>

                        </div>

                    </td>


                    <td>
                        ${escapeHTML(patient.age)}
                    </td>


                    <td>
                        ${escapeHTML(patient.problem)}
                    </td>


                    <td>

                        <span
                            class="priority p${patient.priority}">

                            ${priorityText(patient.priority)}

                        </span>

                    </td>


                    <td>

                        <button
                            class="treat-btn"
                            onclick="treatPatient('${escapeHTML(patient.id)}')">

                            Treat

                        </button>

                    </td>

                </tr>

            `;

        }).join("");

}


/* =====================================================
   WAITING QUEUE TABLE
===================================================== */

function renderWaitingQueue() {

    const table =
        document.getElementById(
            "waitingTable"
        );

    if (!table) return;


    if (waitingQueue.length === 0) {

        table.innerHTML = `

            <tr>

                <td colspan="4">

                    <div class="empty">
                        No patients in waiting queue.
                    </div>

                </td>

            </tr>

        `;

        return;
    }


    table.innerHTML =
        waitingQueue.map(function (patient) {

            return `

                <tr>

                    <td>

                        <div class="patient-cell">

                            <div class="avatar">
                                ${getInitials(patient.name)}
                            </div>

                            <div>

                                <b>
                                    ${escapeHTML(patient.name)}
                                </b>

                                <small>
                                    ${escapeHTML(patient.id)}
                                </small>

                            </div>

                        </div>

                    </td>


                    <td>
                        ${escapeHTML(patient.age)}
                    </td>


                    <td>
                        ${escapeHTML(patient.problem)}
                    </td>


                    <td>

                        <button
                            class="treat-btn"
                            onclick="treatPatient('${escapeHTML(patient.id)}')">

                            Treat

                        </button>

                    </td>

                </tr>

            `;

        }).join("");

}


/* =====================================================
   TREATMENT HISTORY
===================================================== */

function renderHistory() {

    const grid =
        document.getElementById(
            "historyGrid"
        );

    if (!grid) return;


    if (treatmentHistory.length === 0) {

        grid.innerHTML = `

            <div class="card">

                <div class="empty">
                    No treatment history available.
                </div>

            </div>

        `;

        return;
    }


    grid.innerHTML =
        treatmentHistory.map(function (patient) {

            return `

                <div class="history-card">

                    <strong>
                        ${escapeHTML(patient.name)}
                    </strong>

                    <small>
                        Patient ID:
                        ${escapeHTML(patient.id)}
                    </small>

                    <small>
                        Age:
                        ${escapeHTML(patient.age)}
                        •
                        ${escapeHTML(patient.gender)}
                    </small>

                    <p>
                        ${escapeHTML(patient.problem)}
                    </p>

                    <span
                        class="priority p${patient.priority}">

                        ${priorityText(patient.priority)}

                    </span>

                </div>

            `;

        }).join("");

}


/* =====================================================
   SEARCH PATIENT
===================================================== */

const searchBtn =
    document.getElementById(
        "searchBtn"
    );


if (searchBtn) {

    searchBtn.addEventListener(
        "click",
        searchPatient
    );

}


function searchPatient() {

    const id =
        document
            .getElementById("searchId")
            .value
            .trim();


    const result =
        document.getElementById(
            "searchResult"
        );


    if (!id) {

        result.innerHTML = `

            <div class="not-found">
                Please enter a Patient ID.
            </div>

        `;

        return;
    }


    let patient = null;


    /* Search emergency */

    patient =
        emergencyQueue.find(
            p => p.id === id
        );


    /* Search waiting */

    if (!patient) {

        patient =
            waitingQueue.find(
                p => p.id === id
            );

    }


    /* Search treatment history */

    if (!patient) {

        patient =
            treatmentHistory.find(
                p => p.id === id
            );

    }


    if (!patient) {

        result.innerHTML = `

            <div class="not-found">

                Patient with ID
                <b>${escapeHTML(id)}</b>
                was not found.

            </div>

        `;

        return;
    }


    result.innerHTML = `

        <div class="found">

            <h3>
                Patient Found ✓
            </h3>

            <p>
                <b>Patient ID:</b>
                ${escapeHTML(patient.id)}
            </p>

            <p>
                <b>Name:</b>
                ${escapeHTML(patient.name)}
            </p>

            <p>
                <b>Age:</b>
                ${escapeHTML(patient.age)}
            </p>

            <p>
                <b>Gender:</b>
                ${escapeHTML(patient.gender)}
            </p>

            <p>
                <b>Problem:</b>
                ${escapeHTML(patient.problem)}
            </p>

            <p>
                <b>Patient Type:</b>
                ${escapeHTML(patient.type)}
            </p>

            <p>

                <b>Priority:</b>

                <span
                    class="priority p${patient.priority}">

                    ${priorityText(patient.priority)}

                </span>

            </p>

        </div>

    `;

}


/* =====================================================
   ENTER KEY SEARCH
===================================================== */

const searchInput =
    document.getElementById(
        "searchId"
    );


if (searchInput) {

    searchInput.addEventListener(
        "keydown",
        function (event) {

            if (event.key === "Enter") {

                searchPatient();

            }

        }
    );

}


/* =====================================================
   RENDER EVERYTHING
===================================================== */

function renderAll() {

    sortEmergencyQueue();

    updateDashboard();

    renderEmergencyQueue();

    renderWaitingQueue();

    renderHistory();

}


/* =====================================================
   START APPLICATION
===================================================== */

renderAll();