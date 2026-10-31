(function () {
  "use strict";
  const H = window.Heartstone;
  const Catalog = window.HeartstoneCatalog;

  const tabs = document.querySelectorAll(".tab");
  const searchForm = document.querySelector("#searchForm");
  const priceLabel = document.querySelector("#priceLabel");
  const priceRange = document.querySelector("#priceRange");
  const FEATURED_LIMIT = 6;

  const priceOptions = {
    buy: [
      { text: "Any", value: "any" },
      { text: "Up to ₦500,000,000", value: "500000000" },
      { text: "₦500,000,000 – ₦800,000,000", value: "500000000-800000000" },
      { text: "₦800,000,000 – ₦1,000,000,000", value: "800000000-1000000000" },
      { text: "₦1,000,000,000+", value: "1000000000+" },
    ],
    rent: [
      { text: "Any", value: "any" },
      { text: "Up to ₦10,000,000 per year", value: "10000000" },
      {
        text: "₦10,000,000 – ₦15,000,000 per year",
        value: "10000000-15000000",
      },
      {
        text: "₦15,000,000 – ₦25,000,000 per year",
        value: "15000000-25000000",
      },
      { text: "₦25,000,000+ per year", value: "25000000+" },
    ],
  };

  function currentMode() {
    const active = document.querySelector(".tab.active");
    return active && active.dataset.mode === "rent" ? "rent" : "buy";
  }

  function updatePriceField(mode) {
    priceLabel.textContent = mode === "rent" ? "YEARLY RENT" : "PRICE RANGE";
    priceRange.replaceChildren();
    priceOptions[mode].forEach((option) => {
      const node = document.createElement("option");
      node.value = option.value;
      node.textContent = option.text;
      priceRange.appendChild(node);
    });
  }

  tabs.forEach((tab) => {
    tab.setAttribute("aria-pressed", String(tab.classList.contains("active")));
    tab.addEventListener("click", () => {
      if (tab.classList.contains("active")) return;
      tabs.forEach((item) => {
        item.classList.remove("active");
        item.setAttribute("aria-pressed", "false");
      });
      tab.classList.add("active");
      tab.setAttribute("aria-pressed", "true");
      searchForm.classList.add("is-changing");
      setTimeout(() => {
        updatePriceField(currentMode());
        searchForm.classList.remove("is-changing");
      }, 200);
    });
  });

  function priceBounds(value) {
    if (/^\d+$/.test(value)) return { max: value };
    if (/^\d+\+$/.test(value)) return { min: value.slice(0, -1) };
    const range = /^(\d+)-(\d+)$/.exec(value);
    return range ? { min: range[1], max: range[2] } : {};
  }

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const params = new URLSearchParams();
    params.set("mode", currentMode() === "rent" ? "rent" : "sale");
    const text = document.querySelector("#searchText").value.trim();
    if (text) params.set("q", text);
    const kind = document.querySelector("#searchKind").value;
    if (kind) params.set("kind", kind);
    const bounds = priceBounds(priceRange.value);
    if (bounds.min) params.set("min", bounds.min);
    if (bounds.max) params.set("max", bounds.max);
    const beds = document.querySelector("#searchBeds").value;
    if (beds) params.set("beds", beds);
    window.location.assign("properties.html?" + params.toString());
  });

  function fillFeatured(
    container,
    list,
    variant,
    emptyText,
    browseHref,
    browseText,
  ) {
    const userId = Catalog.currentUserId();
    const saved = new Set(userId ? H.getFavourites(userId) : []);
    if (!list.length) {
      container.innerHTML = `<p class="featured-empty">${H.esc(emptyText)} <a href="${H.esc(browseHref)}">${H.esc(browseText)} →</a></p>`;
      return;
    }
    container.innerHTML = list
      .slice(0, FEATURED_LIMIT)
      .map((property) =>
        Catalog.cardHTML(property, saved.has(property.id), variant),
      )
      .join("");
  }

  function renderFeatured() {
    const featured = H.getProperties().filter((property) => property.featured);
    fillFeatured(
      document.querySelector("#featuredSale"),
      featured.filter((property) => property.type === "sale"),
      "sale",
      "No homes for sale are featured right now.",
      "properties.html?mode=sale",
      "Browse all homes for sale",
    );
    fillFeatured(
      document.querySelector("#featuredRent"),
      featured.filter((property) => property.type === "rent"),
      "rent",
      "No rentals are featured right now.",
      "properties.html?mode=rent",
      "Browse all homes to rent",
    );
  }

  updatePriceField(currentMode());

  Catalog.bindSaveButtons(document.body);

  async function refreshFeatured() {
    try {
      await H.loadProperties();

if (H.sessionStatus().valid) {
  await H.loadFavourites();
}

renderFeatured();
await Catalog.finishPendingSave();
    } catch (error) {
      console.error("Homepage property loading failed:", error);

      document
        .querySelectorAll("#featuredSale, #featuredRent")
        .forEach((container) => {
          container.innerHTML =
            '<p class="featured-empty">Unable to load properties right now. Please refresh the page.</p>';
        });
    }
  }

  refreshFeatured();

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) refreshFeatured();
  });

  window.addEventListener("storage", (event) => {
    if (
      event.key === null ||
      event.key === H.KEYS.properties ||
      event.key === H.KEYS.favourites ||
      event.key === H.KEYS.session
    )
      renderFeatured();
  });
})();
