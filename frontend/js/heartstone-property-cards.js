(function (global) {
  "use strict";
  const H = global.Heartstone;
  const UI = global.HeartstoneUI;
  const esc = H.esc;

  function detailHref(property) {
    return "property.html?property=" + encodeURIComponent(property.id);
  }
  function availabilityLabel(property) {
    return { "under-offer": "Under offer", "let-agreed": "Let agreed" }[property.availability] || "";
  }
  function saveLabel(property, saved) {
    return (saved ? "Remove " : "Save ") + property.name + (saved ? " from your shortlist" : " to your shortlist");
  }
  function saveButton(property, saved, className) {
    return (
      `<button class="${className}${saved ? " is-saved" : ""}" type="button" data-save="${esc(property.id)}" ` +
      `aria-pressed="${saved}" aria-label="${esc(saveLabel(property, saved))}">${saved ? "♥" : "♡"}</button>`
    );
  }
  function badge(property) {
    const label = availabilityLabel(property);
    return label ? `<span class="hs-availability">${esc(label)}</span>` : "";
  }

  
  function cardHTML(property, saved, variant) {
    const href = esc(detailHref(property));
    const image = esc(H.firstImage(property));
    const alt = esc(property.name + ", " + property.location);
    const description = property.description ? esc(property.description) : "Contact the office for more information.";
    if (variant === "rent") {
      return (
        `<article class="rental-card" data-property="${esc(property.id)}">` +
        `<a href="${href}" class="rental-card__image-link" aria-label="View ${esc(property.name)}">` +
        `<div class="rental-card__image"><img src="${image}" alt="${alt}" loading="lazy"></div>${badge(property)}</a>` +
        saveButton(property, saved, "rental-card__icon") +
        `<div class="rental-card__content"><p class="rental-card__price">${esc(H.formatPrice(property))}</p>` +
        `<h3>${esc(property.name)}</h3><p class="rental_add">${esc(property.location)}</p>` +
        `<p class="rental-card__details">${esc(H.propertyFacts(property))}</p>` +
        `<p class="rental-card__description">${description}</p>` +
        `<a href="${href}" class="rental-card__link">View property <span aria-hidden="true">→</span></a></div></article>`
      );
    }
    const kicker =
      variant === "listing"
        ? `<p class="hs-listing-type">${property.type === "rent" ? "TO RENT" : "FOR SALE"} · ${esc(property.kind.toUpperCase())}</p>`
        : "";
    return (
      `<article class="property-card" data-property="${esc(property.id)}">` +
      `<div class="property-image"><a href="${href}" tabindex="-1" aria-hidden="true">` +
      `<img src="${image}" alt="${alt}" loading="lazy"></a>${badge(property)}${saveButton(property, saved, "property-save")}</div>` +
      `<div class="property-details">${kicker}<p class="property-price">${esc(H.formatPrice(property))}</p>` +
      `<h3>${esc(property.name)}</h3><p class="property-location">${esc(property.location)}</p>` +
      `<p class="property-meta">${esc(H.propertyFacts(property))}</p><p class="propertyd">${description}</p>` +
      `<a href="${href}" class="property-link">View property <span aria-hidden="true">→</span></a></div></article>`
    );
  }

  function currentUserId() {
    const status = H.sessionStatus();
    return status.valid ? status.user.id : null;
  }

  
  function refreshSaveButtons(root) {
    const userId = currentUserId();
    const saved = new Set(userId ? H.getFavourites(userId) : []);
    (root || document).querySelectorAll("[data-save]").forEach((button) => {
      const property = H.getProperty(button.dataset.save);
      if (!property) return;
      const isSaved = saved.has(property.id);
      button.classList.toggle("is-saved", isSaved);
      button.setAttribute("aria-pressed", String(isSaved));
      button.setAttribute("aria-label", saveLabel(property, isSaved));
      if (!button.dataset.keepLabel) button.textContent = isSaved ? "♥" : "♡";
    });
  }

  
const savingProperties = new Set();

async function toggleFavourite(propertyId, afterChange) {
  if (savingProperties.has(propertyId)) return;

  const property = H.getProperty(propertyId);
  if (!property) {
    UI.toast("This property is no longer listed.", { kind: "error" });
    return;
  }

  const status = H.sessionStatus();
  if (!status.valid) {
    const target = H.currentTarget({ save: propertyId });
    window.location.assign(H.signInUrl("required", target));
    return;
  }

  const userId = status.user.id;
  const wasSaved = H.isFavourite(userId, propertyId);

  savingProperties.add(propertyId);

  try {
    if (wasSaved) {
      await H.removeFavourite(userId, propertyId);
      UI.toast(property.name + " removed from your shortlist.", {
        kind: "success"
      });
    } else {
      await H.addFavourite(userId, propertyId);
      UI.toast(property.name + " saved to your shortlist.", {
        kind: "success"
      });
    }

    refreshSaveButtons();
    if (afterChange) afterChange();
  } catch (error) {
    UI.toast(error.message || "Unable to update your shortlist.", {
      kind: "error"
    });
  } finally {
    savingProperties.delete(propertyId);
  }
}

  function bindSaveButtons(root, afterChange) {
    root.addEventListener("click", (event) => {
      const button = event.target.closest("[data-save]");
      if (!button || !root.contains(button)) return;
      event.preventDefault();
      toggleFavourite(button.dataset.save, afterChange);
    });
  }

  
async function finishPendingSave() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("save");
  if (!id) return;

  const status = H.sessionStatus();
  const property = H.getProperty(id);
  if (!status.valid || !property) return;

  try {
    if (!H.isFavourite(status.user.id, id)) {
      await H.addFavourite(status.user.id, id);
      UI.toast(property.name + " saved to your shortlist.", {
        kind: "success"
      });
    }

    params.delete("save");
    const query = params.toString();

    history.replaceState(
      null,
      "",
      location.pathname + (query ? "?" + query : "") + location.hash
    );

    refreshSaveButtons();
  } catch (error) {
    UI.toast(error.message || "Unable to save property.", {
      kind: "error"
    });
  }
}

  global.HeartstoneCatalog = {
    detailHref, cardHTML, refreshSaveButtons, bindSaveButtons, finishPendingSave, currentUserId, availabilityLabel,
  };
})(window);
