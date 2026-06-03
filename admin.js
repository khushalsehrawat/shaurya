const appointmentsList = document.querySelector("#appointmentsList");
const dashboardStatus = document.querySelector("#dashboardStatus");
const dateFilter = document.querySelector("#dateFilter");
const statusFilter = document.querySelector("#statusFilter");
const searchFilter = document.querySelector("#searchFilter");
const simulateDemoBtn = document.querySelector("#simulateDemoBtn");
const exportCsvBtn = document.querySelector("#exportCsvBtn");
const printRosterBtn = document.querySelector("#printRosterBtn");
const resetDataBtn = document.querySelector("#resetDataBtn");
const clearFilters = document.querySelector("#clearFilters");
const dateGroupTemplate = document.querySelector("#dateGroupTemplate");
const appointmentCardTemplate = document.querySelector("#appointmentCardTemplate");
const doctorChartCanvas = document.querySelector("#doctorChart");
const departmentChartCanvas = document.querySelector("#departmentChart");
const localStorageKey = "aureliaAppointments";

let appointments = [];
let doctorChart;
let departmentChart;

function formatDate(dateValue) {
  if (!dateValue) {
    return "Unscheduled";
  }

  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${dateValue}T00:00:00`));
}

function formatDateTime(dateValue) {
  if (!dateValue) {
    return "";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(dateValue));
}

function normalizeStatus(status) {
  return status || "new";
}

function getDoctorName(appointment) {
  return appointment.doctor || "Any available consultant";
}

function getDepartmentName(appointment) {
  return appointment.department || "Boutique Wellness";
}

function getLocalAppointments() {
  try {
    return JSON.parse(localStorage.getItem(localStorageKey) || "[]");
  } catch {
    return [];
  }
}

async function fetchAppointments() {
  dashboardStatus.textContent = "Loading appointments...";

  try {
    const response = await fetch("/api/appointments");

    if (!response.ok) {
      throw new Error("Unable to load dashboard data.");
    }

    const data = await response.json();
    appointments = data.appointments || [];
    dashboardStatus.textContent = "";
  } catch {
    appointments = getLocalAppointments();
    dashboardStatus.textContent = "Showing appointments saved in this browser. Run the local server for shared admin storage.";
  }

  renderDashboard();
}

function getFilteredAppointments() {
  const selectedDate = dateFilter.value;
  const selectedStatus = statusFilter.value;
  const searchText = searchFilter.value.trim().toLowerCase();

  return appointments.filter((appointment) => {
    const matchesDate = !selectedDate || appointment.date === selectedDate;
    const matchesStatus = selectedStatus === "all" || normalizeStatus(appointment.status) === selectedStatus;
    const searchable = [
      appointment.name,
      appointment.phone,
      appointment.email,
      appointment.department,
      getDoctorName(appointment),
      appointment.slot
    ].join(" ").toLowerCase();
    const matchesSearch = !searchText || searchable.includes(searchText);

    return matchesDate && matchesStatus && matchesSearch;
  });
}

function updateStats() {
  const today = new Date().toISOString().split("T")[0];

  document.querySelector("#totalCount").textContent = appointments.length;
  document.querySelector("#newCount").textContent = appointments.filter((item) => normalizeStatus(item.status) === "new").length;
  document.querySelector("#confirmedCount").textContent = appointments.filter((item) => normalizeStatus(item.status) === "confirmed").length;
  document.querySelector("#cancelledCount").textContent = appointments.filter((item) => normalizeStatus(item.status) === "cancelled").length;
}

function groupAppointments(items) {
  return items.reduce((groups, appointment) => {
    const key = appointment.date || "unscheduled";

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(appointment);
    return groups;
  }, {});
}

function getCountMap(items, keyGetter) {
  return items.reduce((counts, item) => {
    const key = keyGetter(item);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function buildChartData(countMap) {
  const entries = Object.entries(countMap).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  if (!entries.length) {
    return {
      labels: ["No appointments"],
      values: [0]
    };
  }

  return {
    labels: entries.map(([label]) => label),
    values: entries.map(([, value]) => value)
  };
}

function renderCharts(filteredAppointments) {
  if (!window.Chart) {
    return;
  }

  const doctorData = buildChartData(getCountMap(filteredAppointments, getDoctorName));
  const departmentData = buildChartData(getCountMap(filteredAppointments, getDepartmentName));
  const chartColors = ["#1c3353", "#3c837b", "#b78850", "#8aa8bd", "#d8b28f", "#d14d4d"];

  if (doctorChart) {
    doctorChart.destroy();
  }

  if (departmentChart) {
    departmentChart.destroy();
  }

  doctorChart = new Chart(doctorChartCanvas, {
    type: "bar",
    data: {
      labels: doctorData.labels,
      datasets: [{
        label: "Appointments",
        data: doctorData.values,
        backgroundColor: chartColors,
        borderRadius: 0,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "bottom",
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            color: "#667286",
            font: {
              size: 10
            },
            generateLabels(chart) {
              return chart.data.labels.map((label, index) => ({
                text: label,
                fillStyle: chartColors[index % chartColors.length],
                strokeStyle: chartColors[index % chartColors.length],
                hidden: false,
                index
              }));
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            display: false
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: "#f0ebe4"
          },
          ticks: {
            color: "#667286",
            precision: 0
          }
        }
      }
    }
  });

  departmentChart = new Chart(departmentChartCanvas, {
    type: "bar",
    data: {
      labels: departmentData.labels,
      datasets: [{
        label: "Appointments",
        data: departmentData.values,
        backgroundColor: "rgba(60, 131, 123, 0.22)",
        borderColor: "#3c837b",
        borderWidth: 1,
        borderRadius: 0,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: "#667286",
            font: {
              size: 10
            }
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: "#f0ebe4"
          },
          ticks: {
            color: "#667286",
            precision: 0
          }
        }
      }
    }
  });
}

function renderDashboard() {
  updateStats();
  appointmentsList.innerHTML = "";

  const filteredAppointments = getFilteredAppointments();
  renderCharts(filteredAppointments);

  if (!filteredAppointments.length) {
    appointmentsList.innerHTML = `
      <div class="empty-state">
        <div>
          <i class="bi bi-calendar-x"></i>
          <h2>No Appointments Registered</h2>
          <p>There are no bookings matching the current filters. Select "Simulate Demo Data" at the top right to pre-populate clinical data.</p>
        </div>
      </div>
    `;
    return;
  }

  const groups = groupAppointments(filteredAppointments);
  const sortedDates = Object.keys(groups).sort();

  sortedDates.forEach((date) => {
    const groupNode = dateGroupTemplate.content.cloneNode(true);
    const heading = groupNode.querySelector("h2");
    const count = groupNode.querySelector(".date-heading strong");
    const grid = groupNode.querySelector(".appointment-grid");
    const dayAppointments = groups[date].sort((a, b) => (a.slot || "").localeCompare(b.slot || ""));

    heading.textContent = date === "unscheduled" ? "Unscheduled" : formatDate(date);
    count.textContent = `${dayAppointments.length} booking${dayAppointments.length === 1 ? "" : "s"}`;

    dayAppointments.forEach((appointment) => {
      const cardNode = appointmentCardTemplate.content.cloneNode(true);
      const card = cardNode.querySelector(".appointment-card");
      const status = normalizeStatus(appointment.status);
      const statusPill = cardNode.querySelector(".status-pill");
      const phone = cardNode.querySelector(".phone");
      const email = cardNode.querySelector(".email");

      card.dataset.id = appointment.id;
      cardNode.querySelector(".slot").textContent = appointment.slot || "No slot selected";
      statusPill.textContent = status;
      statusPill.classList.add(status);
      cardNode.querySelector("h3").textContent = appointment.name || "Unnamed patient";
      phone.href = `tel:${appointment.phone || ""}`;
      phone.textContent = appointment.phone || "No phone";
      email.href = `mailto:${appointment.email || ""}`;
      email.textContent = appointment.email || "No email";
      cardNode.querySelector(".doctor").textContent = getDoctorName(appointment);
      cardNode.querySelector(".department").textContent = appointment.department || "No department";
      cardNode.querySelector(".message").textContent = appointment.message || "No reason added.";

      grid.appendChild(cardNode);
    });

    appointmentsList.appendChild(groupNode);
  });
}

function csvCell(value) {
  const text = String(value ?? "");
  const protectedText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${protectedText.replace(/"/g, '""')}"`;
}

function downloadCsv() {
  const filteredAppointments = getFilteredAppointments();

  if (!filteredAppointments.length) {
    dashboardStatus.textContent = "No appointments available to export for the selected filters.";
    return;
  }

  const sortedAppointments = [...filteredAppointments].sort((a, b) => (
    `${a.date || ""} ${a.slot || ""} ${a.name || ""}`.localeCompare(`${b.date || ""} ${b.slot || ""} ${b.name || ""}`)
  ));

  const rows = [
    ["Aurelia Clinic Appointment Export"],
    ["Generated On", formatDateTime(new Date().toISOString())],
    ["Filtered Date", dateFilter.value ? formatDate(dateFilter.value) : "All dates"],
    ["Filtered Status", statusFilter.value === "all" ? "All statuses" : statusFilter.value],
    ["Total Exported", sortedAppointments.length],
    [],
    [
      "No.",
      "Appointment Date",
      "Time Slot",
      "Patient Name",
      "Phone",
      "Email",
      "Department",
      "Preferred Doctor",
      "Status",
      "Reason For Visit",
      "Submitted At"
    ],
    ...sortedAppointments.map((appointment, index) => [
      index + 1,
      formatDate(appointment.date),
      appointment.slot || "",
      appointment.name || "",
      appointment.phone || "",
      appointment.email || "",
      appointment.department || "",
      getDoctorName(appointment),
      normalizeStatus(appointment.status),
      appointment.message || "",
      formatDateTime(appointment.createdAt)
    ])
  ];

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `aurelia-appointments-${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  dashboardStatus.textContent = `Exported ${sortedAppointments.length} appointment${sortedAppointments.length === 1 ? "" : "s"} to CSV.`;
}

function getDemoAppointments() {
  const today = new Date();
  const isoDate = (offset) => {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    return date.toISOString().split("T")[0];
  };

  return [
    {
      name: "Riya Sharma",
      phone: "+91 98111 24010",
      email: "riya.sharma@example.com",
      department: "Cardiology",
      doctor: "Dr. Aanya Mehra",
      date: isoDate(0),
      slot: "09:00 AM - 10:00 AM",
      message: "Annual cardiac review and ECG consultation."
    },
    {
      name: "Arjun Malhotra",
      phone: "+91 98222 61890",
      email: "arjun.m@example.com",
      department: "Orthopedics",
      doctor: "Dr. Rohan Kapoor",
      date: isoDate(0),
      slot: "10:30 AM - 11:30 AM",
      message: "Knee pain after sports injury."
    },
    {
      name: "Meera Iyer",
      phone: "+91 98333 72540",
      email: "meera.iyer@example.com",
      department: "Neurology",
      doctor: "Dr. Serena Rao",
      date: isoDate(1),
      slot: "12:00 PM - 01:00 PM",
      message: "Migraine consultation and medication review."
    },
    {
      name: "Kabir Singh",
      phone: "+91 98444 83521",
      email: "kabir.singh@example.com",
      department: "Pediatrics",
      doctor: "Dr. Ishaan Verma",
      date: isoDate(2),
      slot: "03:00 PM - 04:00 PM",
      message: "Vaccination schedule and wellness visit."
    },
    {
      name: "Naina Kapoor",
      phone: "+91 98555 97413",
      email: "naina.k@example.com",
      department: "General Medicine",
      doctor: "Any available consultant",
      date: isoDate(3),
      slot: "05:00 PM - 06:00 PM",
      message: "Fever, fatigue, and preventive bloodwork."
    }
  ];
}

async function simulateDemoData() {
  dashboardStatus.textContent = "Creating demo appointments...";

  try {
    for (const appointment of getDemoAppointments()) {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(appointment)
      });

      if (!response.ok) {
        throw new Error("Unable to create demo appointment.");
      }
    }

    await fetchAppointments();
    dashboardStatus.textContent = "Demo clinical data loaded.";
  } catch {
    const demoAppointments = getDemoAppointments().map((appointment) => ({
      ...appointment,
      id: crypto.randomUUID(),
      status: "new",
      createdAt: new Date().toISOString()
    }));

    appointments = [...appointments, ...demoAppointments];
    localStorage.setItem(localStorageKey, JSON.stringify(appointments));
    dashboardStatus.textContent = "Demo data saved in this browser.";
    renderDashboard();
  }
}

async function resetData() {
  const shouldReset = window.confirm("Reset all appointment records?");

  if (!shouldReset) {
    return;
  }

  dashboardStatus.textContent = "Resetting appointments...";

  try {
    const response = await fetch("/api/appointments", {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error("Unable to reset server appointments.");
    }
  } catch {
    localStorage.removeItem(localStorageKey);
  }

  appointments = [];
  localStorage.removeItem(localStorageKey);
  renderDashboard();
  dashboardStatus.textContent = "Appointment records reset.";
}

async function updateAppointmentStatus(id, status) {
  try {
    const response = await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status })
    });

    if (!response.ok) {
      throw new Error("Unable to update appointment.");
    }

    const data = await response.json();
    const index = appointments.findIndex((appointment) => appointment.id === id);

    if (index !== -1) {
      appointments[index] = data.appointment;
    }
  } catch {
    appointments = appointments.map((appointment) => (
      appointment.id === id ? { ...appointment, status } : appointment
    ));
    localStorage.setItem(localStorageKey, JSON.stringify(appointments));
  }

  renderDashboard();
}

appointmentsList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-status]");

  if (!button) {
    return;
  }

  const card = button.closest(".appointment-card");
  updateAppointmentStatus(card.dataset.id, button.dataset.status);
});

[dateFilter, statusFilter, searchFilter].forEach((input) => {
  input.addEventListener("input", renderDashboard);
});

simulateDemoBtn.addEventListener("click", simulateDemoData);
exportCsvBtn.addEventListener("click", downloadCsv);
printRosterBtn.addEventListener("click", () => window.print());
resetDataBtn.addEventListener("click", resetData);

clearFilters.addEventListener("click", () => {
  dateFilter.value = "";
  statusFilter.value = "all";
  searchFilter.value = "";
  renderDashboard();
});

fetchAppointments();
