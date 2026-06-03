const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const port = process.env.PORT || 5500;
const rootDir = __dirname;
const dataDir = path.join(rootDir, "data");
const dataFile = path.join(dataDir, "appointments.json");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function ensureDataFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, "[]\n");
  }
}

function readAppointments() {
  ensureDataFile();

  try {
    return JSON.parse(fs.readFileSync(dataFile, "utf8"));
  } catch {
    return [];
  }
}

function writeAppointments(appointments) {
  ensureDataFile();
  fs.writeFileSync(dataFile, `${JSON.stringify(appointments, null, 2)}\n`);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 1_000_000) {
        reject(new Error("Request body too large."));
        request.destroy();
      }
    });

    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON."));
      }
    });
  });
}

function clean(value) {
  return String(value || "").trim();
}

function createAppointment(payload) {
  return {
    id: crypto.randomUUID(),
    name: clean(payload.name),
    phone: clean(payload.phone),
    email: clean(payload.email),
    department: clean(payload.department),
    doctor: clean(payload.doctor),
    date: clean(payload.date),
    slot: clean(payload.slot),
    message: clean(payload.message),
    status: "new",
    createdAt: new Date().toISOString()
  };
}

function validateAppointment(appointment) {
  const requiredFields = ["name", "phone", "email", "department", "doctor", "date", "slot"];
  return requiredFields.filter((field) => !appointment[field]);
}

function sortAppointments(appointments) {
  return appointments.sort((a, b) => (
    `${a.date} ${a.slot} ${a.createdAt}`.localeCompare(`${b.date} ${b.slot} ${b.createdAt}`)
  ));
}

async function handleApi(request, response, pathname) {
  if (request.method === "GET" && pathname === "/api/appointments") {
    sendJson(response, 200, { appointments: sortAppointments(readAppointments()) });
    return;
  }

  if (request.method === "POST" && pathname === "/api/appointments") {
    try {
      const payload = await readRequestBody(request);
      const appointment = createAppointment(payload);
      const missingFields = validateAppointment(appointment);

      if (missingFields.length) {
        sendJson(response, 400, {
          message: `Missing required fields: ${missingFields.join(", ")}`
        });
        return;
      }

      const appointments = readAppointments();
      appointments.push(appointment);
      writeAppointments(sortAppointments(appointments));

      sendJson(response, 201, { appointment });
      return;
    } catch (error) {
      sendJson(response, 400, { message: error.message });
      return;
    }
  }

  if (request.method === "DELETE" && pathname === "/api/appointments") {
    writeAppointments([]);
    sendJson(response, 200, { appointments: [] });
    return;
  }

  const statusMatch = pathname.match(/^\/api\/appointments\/([a-f0-9-]+)$/i);

  if (request.method === "PATCH" && statusMatch) {
    try {
      const payload = await readRequestBody(request);
      const allowedStatuses = ["new", "confirmed", "completed", "cancelled"];
      const nextStatus = clean(payload.status).toLowerCase();

      if (!allowedStatuses.includes(nextStatus)) {
        sendJson(response, 400, { message: "Invalid appointment status." });
        return;
      }

      const appointments = readAppointments();
      const index = appointments.findIndex((appointment) => appointment.id === statusMatch[1]);

      if (index === -1) {
        sendJson(response, 404, { message: "Appointment not found." });
        return;
      }

      appointments[index] = {
        ...appointments[index],
        status: nextStatus,
        updatedAt: new Date().toISOString()
      };

      writeAppointments(sortAppointments(appointments));
      sendJson(response, 200, { appointment: appointments[index] });
      return;
    } catch (error) {
      sendJson(response, 400, { message: error.message });
      return;
    }
  }

  sendJson(response, 404, { message: "API route not found." });
}

function serveFile(response, pathname) {
  const safePath = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const filePath = path.normalize(path.join(rootDir, safePath));

  if (!filePath.startsWith(rootDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream"
    });
    response.end(content);
  });
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);

  if (requestUrl.pathname.startsWith("/api/")) {
    await handleApi(request, response, requestUrl.pathname);
    return;
  }

  serveFile(response, requestUrl.pathname);
});

server.listen(port, () => {
  ensureDataFile();
  console.log(`Aurelia Clinic running at http://localhost:${port}`);
  console.log(`Admin dashboard: http://localhost:${port}/admin.html`);
});
