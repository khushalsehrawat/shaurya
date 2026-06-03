const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);

window.addEventListener("resize", () => {
  document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);
});

const today = new Date().toISOString().split("T")[0];
const dateInput = document.querySelector("#date");
if (dateInput) {
  dateInput.min = today;
}

const doctorsSwiper = new Swiper(".doctors-swiper", {
  slidesPerView: 1,
  spaceBetween: 22,
  loop: true,
  speed: 750,
  navigation: {
    nextEl: ".doctor-next",
    prevEl: ".doctor-prev"
  },
  autoplay: {
    delay: 4200,
    disableOnInteraction: false
  },
  breakpoints: {
    768: {
      slidesPerView: 2
    },
    1200: {
      slidesPerView: 3
    }
  }
});

if (!prefersReducedMotion) {
  gsap.utils.toArray(".float-card").forEach((card, index) => {
    gsap.to(card, {
      y: index % 2 === 0 ? -8 : 8,
      duration: 3.4,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut"
    });
  });
}

const revealElements = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window && !prefersReducedMotion) {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      rootMargin: "0px 0px -8% 0px",
      threshold: 0.12
    }
  );

  revealElements.forEach((element) => revealObserver.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add("is-visible"));
}

const progressBar = document.querySelector(".page-progress");
let progressTicking = false;

function updateProgress() {
  const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollableHeight > 0 ? (window.scrollY / scrollableHeight) * 100 : 0;

  if (progressBar) {
    progressBar.style.width = `${Math.min(progress, 100)}%`;
  }

  progressTicking = false;
}

window.addEventListener(
  "scroll",
  () => {
    if (!progressTicking) {
      window.requestAnimationFrame(updateProgress);
      progressTicking = true;
    }
  },
  { passive: true }
);

updateProgress();

document.querySelectorAll(".nav-link, .nav-cta, .hero-section .btn").forEach((link) => {
  link.addEventListener("click", () => {
    const nav = document.querySelector(".navbar-collapse.show");
    if (nav) {
      bootstrap.Collapse.getInstance(nav).hide();
    }
  });
});

const appointmentForm = document.querySelector("#appointmentForm");
const formStatus = document.querySelector("#formStatus");
const localStorageKey = "aureliaAppointments";
const doctorInput = document.querySelector("#doctor");
const departmentInput = document.querySelector("#department");
const departmentValueInput = document.querySelector("#departmentValue");
const slotInput = document.querySelector("#slot");
const feeField = document.querySelector(".consultation-fee-field");
const feeInput = document.querySelector("#fee");

const doctorSchedule = {
  "Dr. Vikash Kumar": {
    department: "General Physician",
    slots: ["10:30 AM - 1:00 PM", "7:30 PM - 10:00 PM"],
    fee: ""
  },
  "Dr. Chanchal Verma": {
    department: "General Surgery and Laproscope",
    slots: ["On-Call"],
    fee: "500/-"
  }
};

function setSlotOptions(slots = []) {
  if (!slotInput) {
    return;
  }

  slotInput.innerHTML = '<option value="">Select time</option>';

  slots.forEach((slot) => {
    const option = document.createElement("option");
    option.value = slot;
    option.textContent = slot;
    slotInput.appendChild(option);
  });
}

function updateDoctorDetails() {
  const selectedDoctor = doctorInput?.value || "";
  const doctorDetails = doctorSchedule[selectedDoctor];

  if (departmentInput) {
    departmentInput.value = doctorDetails?.department || "";
  }

  if (departmentValueInput) {
    departmentValueInput.value = doctorDetails?.department || "";
  }

  if (feeField && feeInput) {
    const hasFee = Boolean(doctorDetails?.fee);
    feeField.classList.toggle("d-none", !hasFee);
    feeInput.value = doctorDetails?.fee || "";
    feeInput.required = hasFee;
    feeInput.disabled = !hasFee;
  }

  setSlotOptions(doctorDetails?.slots || []);
}

if (doctorInput) {
  doctorInput.addEventListener("change", updateDoctorDetails);
  updateDoctorDetails();
}

function getLocalAppointments() {
  try {
    return JSON.parse(localStorage.getItem(localStorageKey) || "[]");
  } catch {
    return [];
  }
}

function saveAppointmentLocally(appointment) {
  const appointments = getLocalAppointments();
  appointments.push(appointment);
  localStorage.setItem(localStorageKey, JSON.stringify(appointments));
}

async function saveAppointmentToDashboard(appointment) {
  const response = await fetch("/api/appointments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(appointment)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Unable to save appointment.");
  }

  return data.appointment;
}

async function sendAppointmentNotification(formData) {
  const formSubmitUrl = appointmentForm.action.replace("formsubmit.co/", "formsubmit.co/ajax/");
  const payload = Object.fromEntries(formData.entries());

  const response = await fetch(formSubmitUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error("Unable to send email notification.");
  }
}

if (appointmentForm && formStatus) {
  appointmentForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = appointmentForm.querySelector('button[type="submit"]');
    const formData = new FormData(appointmentForm);
    const appointment = Object.fromEntries(formData.entries());

    formStatus.textContent = "Saving your request and sending notification...";
    submitButton.disabled = true;

    let savedToDashboard = false;

    try {
      await saveAppointmentToDashboard(appointment);
      savedToDashboard = true;
    } catch {
      saveAppointmentLocally({
        ...appointment,
        id: crypto.randomUUID(),
        status: "new",
        createdAt: new Date().toISOString()
      });
    }

    try {
      await sendAppointmentNotification(formData);
      formStatus.textContent = savedToDashboard
        ? "Appointment saved. Email notification sent."
        : "Saved in this browser. Email notification sent.";
      appointmentForm.reset();

      if (dateInput) {
        dateInput.min = today;
      }
    } catch (error) {
      console.error(error);
      formStatus.textContent = savedToDashboard
        ? "Appointment saved. Email notification could not be sent."
        : "Saved in this browser. Email notification could not be sent.";
      appointmentForm.reset();
    } finally {
      submitButton.disabled = false;
    }
  });
}
