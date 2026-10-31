(function (global) {
  "use strict";
  const doc = global.document;

  const KEYS = Object.freeze({});
  const PROPERTY_KINDS = [
    "Apartment",
    "House",
    "Penthouse",
    "Duplex",
    "Terrace",
  ];
  const MAX_IMAGES = 8;

  const FALLBACK_IMAGE =
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400"><rect width="640" height="400" fill="#e5e1d8"/><path d="M0 310L190 170 330 260 470 120 640 245V400H0Z" fill="#c8c5bb"/><text x="320" y="365" font-family="Arial" font-size="17" text-anchor="middle" fill="#68675f">HEARTSTONE LAGOS</text></svg>',
    );

  const ESC_MAP = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  function esc(value) {
    return String(value == null ? "" : value).replace(
      /[&<>"']/g,
      (c) => ESC_MAP[c],
    );
  }
  function trim(value) {
    return String(value == null ? "" : value).trim();
  }
  function normaliseEmail(value) {
    return trim(value).toLowerCase();
  }
  function pad(n) {
    return String(n).padStart(2, "0");
  }
  function todayISO() {
    const d = new Date();
    return (
      d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate())
    );
  }
  function isValidISODate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
      return false;
    const d = new Date(value + "T12:00:00");
    return !Number.isNaN(+d) && todayISOFrom(d) === value;
  }
  function todayISOFrom(d) {
    return (
      d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate())
    );
  }
  function formatDate(value, withWeekday) {
    if (!isValidISODate(value)) return "Not agreed";
    const options = { day: "numeric", month: "long", year: "numeric" };
    if (withWeekday !== false) options.weekday = "long";
    return new Intl.DateTimeFormat("en-GB", options).format(
      new Date(value + "T12:00:00"),
    );
  }
  const numberFormat = new Intl.NumberFormat("en-NG", {
    maximumFractionDigits: 0,
  });
  function formatNaira(amount) {
    return "₦" + numberFormat.format(Number(amount) || 0);
  }
  function formatPrice(property) {
    if (!property) return "";
    const period =
      property.type === "rent"
        ? " per " + (property.pricePeriod || "year")
        : "";
    return formatNaira(property.price) + period;
  }
  function plural(n, one, many) {
    return n + " " + (n === 1 ? one : many);
  }
  function propertyFacts(p) {
    return [
      plural(p.beds, "bed", "beds"),
      plural(p.baths, "bathroom", "bathrooms"),
      p.area + " sqm",
    ].join(" · ");
  }

  function safeImageSrc(src) {
    const value = trim(src);
    if (!value) return FALLBACK_IMAGE;
    if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value))
      return value;
    if (/^[a-z][a-z0-9+.-]*:/i.test(value))
      return /^https?:\/\//i.test(value) ? value : FALLBACK_IMAGE;
    return value;
  }
  function firstImage(property) {
    return safeImageSrc(property && property.images && property.images[0]);
  }

  const storageAvailable = false;

  const validators = {
    fullName(value) {
      const text = trim(value);
      if (!text) return "Enter your full name.";
      if (text.length < 2)
        return "Enter your full name using at least 2 characters.";
      if (text.length > 80) return "Use 80 characters or fewer for your name.";
      if (!/^[\p{L}][\p{L}\p{M}'’.\- ]*$/u.test(text))
        return "Use letters, spaces, hyphens and apostrophes only.";
      return null;
    },
    email(value) {
      const text = trim(value);
      if (!text) return "Enter your email address.";
      if (text.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text))
        return "Enter a valid email address.";
      return null;
    },
    phone(value, required) {
      const text = trim(value);
      if (!text) return required === false ? null : "Enter your phone number.";
      const compact = text.replace(/[\s().-]/g, "");
      if (/^\+[1-9]\d{7,14}$/.test(compact) || /^0\d{10}$/.test(compact))
        return null;
      return "Enter a valid phone number, for example +234 801 234 5678.";
    },
    password(value) {
      const text = String(value == null ? "" : value);
      if (!text) return "Enter a password.";
      if (text.length > 128) return "Use 128 characters or fewer.";
      if (
        text.length < 8 ||
        !/[A-Z]/.test(text) ||
        !/[a-z]/.test(text) ||
        !/\d/.test(text) ||
        !/[^A-Za-z0-9\s]/.test(text)
      )
        return "Use 8+ characters including uppercase, lowercase, number and special character.";
      return null;
    },
    confirmPassword(password, confirm) {
      if (!confirm) return "Confirm your password.";
      if (password !== confirm) return "Your passwords do not match.";
      return null;
    },
    inspectionDate(value) {
      const text = trim(value);
      if (!text) return "Choose a preferred inspection date.";
      if (!isValidISODate(text)) return "Enter a valid date.";
      if (text <= todayISO())
        return "Choose a date after " + formatDate(todayISO(), false) + ".";
      return null;
    },
  };

  const backendUnavailable = () => ({
    ok: false,
    reason: "backend-unavailable",
  });
  const initialSession = global.__HEARTSTONE_SESSION__ || null;
  let activeSession =
    initialSession && initialSession.user
      ? { valid: true, user: initialSession.user }
      : { valid: false };
  async function refreshSession() {
    try {
      const response = await fetch("/api/auth/session", {
        credentials: "same-origin",
        cache: "no-store",
      });

      if (!response.ok) {
        activeSession = { valid: false };
        return activeSession;
      }

      const data = await response.json();

      activeSession =
        data.authenticated && data.user
          ? { valid: true, user: data.user }
          : { valid: false };

      return activeSession;
    } catch (error) {
      console.error("Session verification failed:", error);
      throw error;
    }
  }

  async function authRequest(path, payload) {
    const response = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.message || "Unable to complete your request.");
    return data;
  }
  async function registerUser(values) {
    return authRequest("/api/auth/register", values);
  }
  async function loginUser(values) {
    const data = await authRequest("/api/auth/login", values);
    activeSession = { valid: true, user: data.user };
    return data;
  }
  async function loginAdmin(values) {
    const data = await authRequest("/api/auth/admin-login", values);
    activeSession = { valid: true, user: data.user };
    return data;
  }
  const updateProfile = backendUnavailable;
  const startSession = backendUnavailable;
  const sessionStatus = () =>
    activeSession.valid && activeSession.user.role === "user"
      ? activeSession
      : { valid: false };
  const adminSessionStatus = () =>
    activeSession.valid && activeSession.user.role === "admin"
      ? activeSession
      : { valid: false };
  async function endSession() {
    await authRequest("/api/auth/logout");
    activeSession = { valid: false };
  }
  const endAdminSession = endSession;
  function safeNext(value) {
    if (typeof value !== "string") return "";
    const next = value.trim();
    if (
      !/^[A-Za-z0-9_-]+\.html(?:\?[A-Za-z0-9_=&%.-]*)?(?:#[A-Za-z0-9_-]*)?$/.test(
        next,
      )
    )
      return "";
    return /^admin/i.test(next) ? "" : next;
  }
  function currentTarget() {
    return global.location.pathname.split("/").pop() || "index.html";
  }
  function signInUrl(reason, next) {
    const target = safeNext(next);
    return (
      "signin.html?reason=" +
      encodeURIComponent(reason || "required") +
      (target ? "&next=" + encodeURIComponent(target) : "")
    );
  }

  const SEED_PROPERTIES = [
    {
      id: "HST-001",
      name: "Ikoyi Residence",
      type: "sale",
      price: 750000000,
      location: "Ikoyi, Lagos",
      kind: "Apartment",
      beds: 3,
      baths: 3,
      area: 280,
      images: ["images/banana-rseidence.png"],
      description:
        "A contemporary three-bedroom residence in the heart of Ikoyi.",
      availability: "available",
      featured: true,
      features: [
        "Secure gated compound",
        "Backup power",
        "Fitted kitchen",
        "Covered parking",
      ],
    },
    {
      id: "HST-002",
      name: "Victoria Island Residence",
      type: "sale",
      price: 1250000000,
      location: "Victoria Island, Lagos",
      kind: "Apartment",
      beds: 4,
      baths: 4,
      area: 340,
      images: ["images/property-photograph.png"],
      description:
        "A spacious modern residence close to the best of Victoria Island.",
      availability: "available",
      featured: true,
      features: [
        "Sea-facing balcony",
        "24-hour security",
        "Backup power",
        "Residents' gym",
      ],
    },
    {
      id: "HST-003",
      name: "Lekki Contemporary",
      type: "sale",
      price: 950000000,
      location: "Lekki Phase 1, Lagos",
      kind: "House",
      beds: 4,
      baths: 4,
      area: 310,
      images: ["images/lekki-residence.png"],
      description:
        "A contemporary family home in one of Lagos's most popular residential areas.",
      availability: "available",
      featured: true,
      features: [
        "Private garden",
        "Boys' quarters",
        "Backup power",
        "Ample parking",
      ],
    },
    {
      id: "HST-004",
      name: "Ikoyi Garden Apartment",
      type: "rent",
      price: 8000000,
      pricePeriod: "year",
      location: "Ikoyi, Lagos",
      kind: "Apartment",
      beds: 2,
      baths: 2,
      area: 180,
      images: ["images/banana-rseidence.png"],
      description:
        "A spacious two-bedroom residence offering contemporary comfort and relaxed city living in the heart of Ikoyi.",
      availability: "available",
      featured: true,
      features: [
        "Garden outlook",
        "Fitted kitchen",
        "24-hour security",
        "Covered parking",
      ],
    },
    {
      id: "HST-005",
      name: "Victoria Island Residence",
      type: "rent",
      price: 12000000,
      pricePeriod: "year",
      location: "Victoria Island, Lagos",
      kind: "Apartment",
      beds: 3,
      baths: 3,
      area: 220,
      images: ["images/property-photograph.png"],
      description: "Contemporary three-bedroom living in Victoria Island.",
      availability: "available",
      featured: true,
      features: [
        "Open-plan living",
        "Backup power",
        "24-hour security",
        "Lift access",
      ],
    },
    {
      id: "HST-006",
      name: "Lekki Contemporary",
      type: "rent",
      price: 15000000,
      pricePeriod: "year",
      location: "Lekki Phase 1, Lagos",
      kind: "Duplex",
      beds: 4,
      baths: 4,
      area: 260,
      images: ["images/lekki-residence.png"],
      description: "A generous four-bedroom residence in Lekki Phase 1.",
      availability: "available",
      featured: true,
      features: [
        "Duplex layout",
        "Managed by the Lagos office",
        "Backup power",
        "Gated estate",
      ],
    },
  ];

  const AVAILABILITY = ["available", "under-offer", "let-agreed"];

  function cleanFeatures(value) {
    const list = Array.isArray(value) ? value : [];
    const seen = new Set();
    return list
      .map((item) => trim(item).slice(0, 60))
      .filter(
        (item) =>
          item && !seen.has(item.toLowerCase()) && seen.add(item.toLowerCase()),
      )
      .slice(0, 12);
  }

  function normaliseProperty(raw) {
    if (
      !raw ||
      typeof raw !== "object" ||
      typeof raw.id !== "string" ||
      !raw.id
    )
      return null;
    const type = raw.type === "rent" ? "rent" : "sale";
    let images = Array.isArray(raw.images)
      ? raw.images
      : raw.image
        ? [raw.image]
        : [];
    images = images
      .filter((src) => typeof src === "string" && src.trim())
      .slice(0, MAX_IMAGES);
    return {
      id: raw.id,
      name: trim(raw.name) || "Untitled property",
      type,
      price: Math.max(0, Number(raw.price) || 0),
      pricePeriod: type === "rent" ? raw.pricePeriod || "year" : null,
      location: trim(raw.location),
      kind: PROPERTY_KINDS.includes(raw.kind)
        ? raw.kind
        : trim(raw.kind) || "Apartment",
      beds: Math.max(0, Math.floor(Number(raw.beds) || 0)),
      baths: Math.max(0, Math.floor(Number(raw.baths) || 0)),
      area: Math.max(0, Number(raw.area) || 0),
      images,
      description: trim(raw.description),
      features: cleanFeatures(raw.features),
      availability: AVAILABILITY.includes(raw.availability)
        ? raw.availability
        : "available",
      featured: raw.featured === true,
    };
  }

  let propertiesCache = [];

  async function loadProperties() {
    const response = await fetch("/api/properties", {
      credentials: "same-origin",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Unable to load properties.");
    }

    const data = await response.json();

    propertiesCache = data.properties
      .map((property) =>
        normaliseProperty({
          ...property,
          id: property._id,
        }),
      )
      .filter(Boolean);

    return propertiesCache;
  }

  function getProperties() {
    return propertiesCache;
  }

  function getProperty(id) {
    return propertiesCache.find((property) => property.id === id) || null;
  }

  async function saveProperty(property) {
    const editing = Boolean(property.id);

    const url = editing
      ? `/api/properties/${encodeURIComponent(property.id)}`
      : "/api/properties";

    const response = await fetch(url, {
      method: editing ? "PUT" : "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: property.name,
        type: property.type,
        price: property.price,
        pricePeriod: property.pricePeriod,
        location: property.location,
        kind: property.kind,
        beds: property.beds,
        baths: property.baths,
        area: property.area,
        description: property.description,
        features: property.features,
        availability: property.availability,
        featured: property.featured,
        images: [],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Unable to save property.");
    }

    await loadProperties();

    return {
      ok: true,
      created: !editing,
      property: normaliseProperty({
        ...data.property,
        id: data.property._id,
      }),
    };
  }

  async function uploadPropertyImages(propertyId, files) {
    if (!propertyId) {
      throw new Error("Property ID is missing.");
    }

    if (!files.length) {
      return { ok: true };
    }

    const formData = new FormData();

    files.forEach((file) => {
      formData.append("images", file);
    });

    const response = await fetch(
      `/api/properties/${encodeURIComponent(propertyId)}/images`,
      {
        method: "POST",
        credentials: "same-origin",
        body: formData,
      },
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Picture upload failed.");
    }

    await loadProperties();

    return {
      ok: true,
      property: normaliseProperty({
        ...data.property,
        id: data.property._id,
      }),
    };
  }

  async function removePropertyImage(propertyId, imageUrl) {
    const response = await fetch(
      `/api/properties/${encodeURIComponent(propertyId)}/images`,
      {
        method: "DELETE",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageUrl }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Unable to remove picture.");
    }

    await loadProperties();

    return {
      ok: true,
      property: normaliseProperty({
        ...data.property,
        id: data.property._id,
      }),
    };
  }

  async function setPropertyCover(propertyId, imageUrl) {
    const response = await fetch(
      `/api/properties/${encodeURIComponent(propertyId)}/cover`,
      {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageUrl }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Unable to update cover picture.");
    }

    await loadProperties();

    return {
      ok: true,
      property: normaliseProperty({
        ...data.property,
        id: data.property._id,
      }),
    };
  }

  async function setFeatured(id, featured) {
    const response = await fetch(
      `/api/properties/${encodeURIComponent(id)}/featured`,
      {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ featured }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Unable to update featured status.");
    }

    await loadProperties();

    return {
      ok: true,
      property: normaliseProperty({
        ...data.property,
        id: data.property._id,
      }),
    };
  }

  async function deleteProperty(id) {
    const response = await fetch(`/api/properties/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "same-origin",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Unable to delete property.");
    }

    await loadProperties();

    return {
      ok: true,
      property: data.property,
    };
  }

  const newPropertyId = () => "";
  const propertyImpact = () => ({ favourites: 0, requests: 0, pending: 0 });

  let favouritesCache = [];

  async function loadFavourites() {
    const response = await fetch("/api/favourites", {
      credentials: "same-origin",
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Unable to load favourites.");
    }

    if (!Array.isArray(data.favourites)) {
      throw new Error("Invalid favourites response.");
    }

    favouritesCache = data.favourites.map(String);
    return [...favouritesCache];
  }

  function getFavourites() {
    return [...favouritesCache];
  }

  function isFavourite(userId, propertyId) {
    return favouritesCache.includes(String(propertyId));
  }

  async function addFavourite(userId, propertyId) {
    const response = await fetch(
      "/api/favourites/" + encodeURIComponent(propertyId),
      {
        method: "POST",
        credentials: "same-origin",
      },
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Unable to save property.");
    }

    await loadFavourites();
    return { ok: true };
  }

  async function removeFavourite(userId, propertyId) {
    const response = await fetch(
      "/api/favourites/" + encodeURIComponent(propertyId),
      {
        method: "DELETE",
        credentials: "same-origin",
      },
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Unable to remove property.");
    }

    await loadFavourites();
    return { ok: true };
  }

  let requestsCache = [];

  async function loadRequests() {
    const response = await fetch("/api/admin/inspections", {
      credentials: "same-origin",
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Unable to load inspection requests.");
    }

    if (!Array.isArray(data.requests)) {
      throw new Error("Invalid inspection response from server.");
    }

    requestsCache = data.requests;
    return requestsCache;
  }

  let userRequestsCache = [];

  async function loadMyRequests() {
    const response = await fetch("/api/inspections/mine", {
      credentials: "same-origin",
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.message || "Unable to load your inspection requests.",
      );
    }

    if (!Array.isArray(data.requests)) {
      throw new Error("Invalid inspection response from server.");
    }

    userRequestsCache = data.requests;
    return [...userRequestsCache];
  }

  function getMyRequests() {
    return [...userRequestsCache];
  }

  function getMyRequest(id) {
    return userRequestsCache.find((request) => request.id === id) || null;
  }

  function getRequests() {
    return [...requestsCache];
  }

  function getRequest(id) {
    return requestsCache.find((request) => request.id === id) || null;
  }

  const createRequest = backendUnavailable;

  async function updateRequest(id, changes) {
    const response = await fetch(
      "/api/admin/inspections/" + encodeURIComponent(id),
      {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(changes),
      },
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Unable to update inspection request.");
    }

    await loadRequests();

    return {
      ok: true,
      request: data.request,
    };
  }

  async function cancelRequest(userId, id) {
    const response = await fetch(
      "/api/inspections/" + encodeURIComponent(id) + "/cancel",
      {
        method: "PATCH",
        credentials: "same-origin",
      },
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Unable to cancel inspection request.");
    }

    await loadMyRequests();

    return { ok: true, request: data.request };
  }
  function requestProperty(request) {
    return (
      getProperty(request && request.propertyId) || {
        name: (request && request.propertyName) || "Property unavailable",
        location: (request && request.propertyLocation) || "",
        images: [],
        missing: true,
      }
    );
  }

  function startIdleTracking() {
    const role = doc.documentElement.getAttribute("data-protected");

    if (!["user", "admin"].includes(role)) return;

    const limit = role === "admin" ? 5 * 60 * 1000 : 15 * 60 * 1000;
    const loginPage =
      role === "admin"
        ? "admin-login.html?reason=expired"
        : "signin.html?reason=expired";

    const throttle = 30 * 1000;
    let lastActivity = Date.now();
    let lastSent = lastActivity;
    let timer = null;
    let sending = false;
    let expired = false;

    function redirect() {
      if (expired) return;
      expired = true;
      clearTimeout(timer);
      activeSession = { valid: false };
      global.location.replace(loginPage);
    }

    function scheduleCheck() {
      clearTimeout(timer);
      if (expired) return;

      const remaining = limit - (Date.now() - lastActivity);

      if (remaining <= 0) {
        redirect();
        return;
      }

      timer = global.setTimeout(checkIdle, remaining);
    }

    function checkIdle() {
      if (Date.now() - lastActivity >= limit) {
        redirect();
        return;
      }

      scheduleCheck();
    }

    async function reportActivity() {
      if (sending || expired || doc.hidden) return;

      sending = true;

      try {
        const response = await fetch("/api/auth/activity", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
        });

        if (response.status === 401 || response.status === 403) {
          redirect();
          return;
        }

        if (response.ok) {
          lastSent = Date.now();
        }
      } catch (error) {
        console.error("Unable to update session activity:", error);
      } finally {
        sending = false;
      }
    }

    function recordActivity() {
      if (expired || doc.hidden) return;

      checkIdle();
      if (expired) return;

      lastActivity = Date.now();
      scheduleCheck();

      if (lastActivity - lastSent >= throttle) {
        reportActivity();
      }
    }

    ["pointerdown", "keydown", "touchstart", "scroll"].forEach((eventName) => {
      global.addEventListener(eventName, recordActivity, {
        passive: true,
      });
    });

    doc.addEventListener("visibilitychange", () => {
      if (!doc.hidden) checkIdle();
    });

    global.addEventListener("focus", checkIdle);
    global.addEventListener("pageshow", checkIdle);

    scheduleCheck();
  }

  function guardCheck() {
    const role = doc.documentElement.getAttribute("data-protected");
    if (!role) return true;
    if ((role === "admin" ? adminSessionStatus() : sessionStatus()).valid)
      return true;
    global.location.replace(
      role === "admin"
        ? "admin-login.html"
        : signInUrl("required", currentTarget()),
    );
    return false;
  }

  if (doc && doc.documentElement.hasAttribute("data-protected")) {
    if (guardCheck()) startIdleTracking();
  }

  global.Heartstone = {
    KEYS,
    MAX_IMAGES,
    PROPERTY_KINDS,
    FALLBACK_IMAGE,
    storageAvailable,
    esc,
    trim,
    normaliseEmail,
    todayISO,
    isValidISODate,
    formatDate,
    formatNaira,
    formatPrice,
    propertyFacts,
    plural,
    safeImageSrc,
    firstImage,
    validators,
    registerUser,
    loginUser,
    updateProfile,
    startSession,
    sessionStatus,
    refreshSession,
    endSession,
    loginAdmin,
    adminSessionStatus,
    endAdminSession,
    safeNext,
    currentTarget,
    signInUrl,
    guardCheck,
    loadProperties,
    getProperties,
    getProperty,
    saveProperty,
    setFeatured,
    uploadPropertyImages,
    setPropertyCover,
    removePropertyImage,
    deleteProperty,
    propertyImpact,
    newPropertyId,
    loadFavourites,
    getFavourites,
    isFavourite,
    addFavourite,
    removeFavourite,
    loadRequests,
    getRequests,
    getRequest,
    loadMyRequests,
    getMyRequests,
    getMyRequest,
    createRequest,
    updateRequest,
    cancelRequest,
    requestProperty,
  };
})(window);
