(function () {
  "use strict";
  const H = window.Heartstone;
  const Catalog = window.HeartstoneCatalog;

  const form = document.querySelector("#filterForm");
  const grid = document.querySelector("#resultsGrid");
  if (!form || !grid) return;

  const query = document.querySelector("#fQuery");
  const kind = document.querySelector("#fKind");
  const minPrice = document.querySelector("#fMin");
  const maxPrice = document.querySelector("#fMax");
  const beds = document.querySelector("#fBeds");
  const tabs = Array.from(form.querySelectorAll(".tab"));
  const count = document.querySelector("#resultCount");
  const error = document.querySelector("#filterError");
  const empty = document.querySelector("#emptyState");
  const emptySummary = document.querySelector("#emptySummary");
  let mode = "all";

  function fillKinds(selected) {
    const kinds = new Set(H.PROPERTY_KINDS);
    H.getProperties().forEach((p) => p.kind && kinds.add(p.kind));
    kind.replaceChildren();
    [""].concat(Array.from(kinds)).forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value || "Any";
      kind.appendChild(option);
    });
    kind.value = kinds.has(selected) ? selected : "";
  }

  function setMode(next) {
    mode = ["sale", "rent"].includes(next) ? next : "all";
    tabs.forEach((tab) => {
      const active = tab.dataset.mode === mode;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-pressed", String(active));
    });
  }

  function amount(input) {
    const text = input.value.trim();
    if (text === "") return null;
    const value = Number(text);
    return Number.isFinite(value) && value >= 0 ? value : NaN;
  }

  function currentFilters() {
    return {
      mode,
      text: query.value.trim().toLowerCase(),
      kind: kind.value,
      min: amount(minPrice),
      max: amount(maxPrice),
      beds: beds.value ? Number(beds.value) : 0,
    };
  }

  function describe(filters) {
    const parts = [];
    if (filters.mode === "sale") parts.push("For sale");
    if (filters.mode === "rent") parts.push("To rent");
    if (filters.kind) parts.push(filters.kind);
    if (query.value.trim()) parts.push("“" + query.value.trim() + "”");
    if (filters.beds) parts.push(filters.beds + "+ bedrooms");
    if (filters.min != null && !Number.isNaN(filters.min)) parts.push("from " + H.formatNaira(filters.min));
    if (filters.max != null && !Number.isNaN(filters.max)) parts.push("up to " + H.formatNaira(filters.max));
    return parts.length ? "0 properties · " + parts.join(" · ") : "0 properties";
  }

  function matches(property, f) {
    if (f.mode !== "all" && property.type !== f.mode) return false;
    if (f.kind && property.kind !== f.kind) return false;
    if (f.beds && property.beds < f.beds) return false;
    if (f.min != null && property.price < f.min) return false;
    if (f.max != null && property.price > f.max) return false;
    if (f.text && !(property.name + " " + property.location).toLowerCase().includes(f.text)) return false;
    return true;
  }

  function syncAddress() {
    const params = new URLSearchParams();
    if (mode !== "all") params.set("mode", mode);
    if (query.value.trim()) params.set("q", query.value.trim());
    if (kind.value) params.set("kind", kind.value);
    if (minPrice.value.trim()) params.set("min", minPrice.value.trim());
    if (maxPrice.value.trim()) params.set("max", maxPrice.value.trim());
    if (beds.value) params.set("beds", beds.value);
    const text = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (text ? "?" + text : ""));
  }

  function render() {
    const filters = currentFilters();
    const invalid = Number.isNaN(filters.min) || Number.isNaN(filters.max);
    const reversed = !invalid && filters.min != null && filters.max != null && filters.min > filters.max;
    minPrice.removeAttribute("aria-invalid");
    maxPrice.removeAttribute("aria-invalid");
    if (invalid || reversed) {
      error.textContent = invalid
        ? "Enter prices as positive numbers only."
        : "The minimum price cannot be higher than the maximum price.";
      error.hidden = false;
      (invalid && Number.isNaN(filters.min) ? minPrice : maxPrice).setAttribute("aria-invalid", "true");
      if (reversed) {
        minPrice.setAttribute("aria-invalid", "true");
        maxPrice.setAttribute("aria-invalid", "true");
      }
      grid.replaceChildren();
      empty.hidden = true;
      count.textContent = "Correct the price range to see results.";
      return;
    }
    error.hidden = true;
    const userId = Catalog.currentUserId();
    const saved = new Set(userId ? H.getFavourites(userId) : []);
    const results = H.getProperties().filter((p) => matches(p, filters));
    grid.innerHTML = results.map((p) => Catalog.cardHTML(p, saved.has(p.id), "listing")).join("");
    empty.hidden = results.length > 0;
    grid.hidden = results.length === 0;
    count.textContent = H.plural(results.length, "property", "properties") + " found";
    emptySummary.textContent = describe(filters);
    syncAddress();
  }

  function reset() {
    setMode("all");
    query.value = "";
    kind.value = "";
    minPrice.value = "";
    maxPrice.value = "";
    beds.value = "";
    render();
    query.focus();
  }

  function applyAddress() {
    const params = new URLSearchParams(window.location.search);
    fillKinds(params.get("kind") || "");
    setMode(params.get("mode"));
    query.value = (params.get("q") || "").slice(0, 80);
    const min = params.get("min");
    const max = params.get("max");
    minPrice.value = min && /^\d+$/.test(min) ? min : "";
    maxPrice.value = max && /^\d+$/.test(max) ? max : "";
    const bedValue = params.get("beds");
    beds.value = ["1", "2", "3", "4"].includes(bedValue) ? bedValue : "";
  }

  tabs.forEach((tab) =>
    tab.addEventListener("click", () => {
      setMode(tab.dataset.mode);
      render();
    }),
  );
  [query, minPrice, maxPrice].forEach((input) => input.addEventListener("input", render));
  [kind, beds].forEach((input) => input.addEventListener("change", render));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    render();
  });
  document.querySelector("#resetFilters").addEventListener("click", reset);
  document.querySelector("#emptyReset").addEventListener("click", reset);


Catalog.bindSaveButtons(document.body);
applyAddress();

let loading = false;

async function refreshProperties() {
  if (loading) return;

  loading = true;
  count.textContent = "Loading properties…";
  error.hidden = true;
  empty.hidden = true;
  grid.hidden = false;
  grid.replaceChildren();
  
try {
  await H.loadProperties();

  if (H.sessionStatus().valid) {
    await H.loadFavourites();
  }

  fillKinds(kind.value);
  render();
  await Catalog.finishPendingSave();
}

  catch (err) {
    console.error("Unable to load property listings:", err);
    grid.replaceChildren();
    grid.hidden = true;
    empty.hidden = true;
    count.textContent = "Unable to load properties. Please refresh the page.";
  } finally {
    loading = false;
  }
}

refreshProperties();

window.addEventListener("pageshow", (event) => {
  if (event.persisted) refreshProperties();
});

  window.addEventListener("storage", (event) => {
    if (event.key === null || event.key === H.KEYS.properties || event.key === H.KEYS.favourites || event.key === H.KEYS.session)
      render();
  });
})();
