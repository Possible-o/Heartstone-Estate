(function () {
  "use strict";
  const H = window.Heartstone;
  const UI = window.HeartstoneUI;
  const Catalog = window.HeartstoneCatalog;
  const esc = H.esc;

  const view = document.querySelector("#propertyView");
  const section = document.querySelector("#inspection");
  const gate = document.querySelector("#inspectionGate");
  const form = document.querySelector("#inspectionForm");
  const review = document.querySelector("#inspectionReview");
  const done = document.querySelector("#inspectionDone");
  const fields = {
    date: document.querySelector("#reqDate"),
    name: document.querySelector("#reqName"),
    email: document.querySelector("#reqEmail"),
    phone: document.querySelector("#reqPhone"),
    message: document.querySelector("#reqMessage"),
  };
  const FIELD_IDS = {
    date: "reqDate",
    fullName: "reqName",
    email: "reqEmail",
    phone: "reqPhone",
    message: "reqMessage",
  };

  const propertyId =
    new URLSearchParams(window.location.search).get("property") || "";
  let property = null;
  let draft = null;
  let busy = false;

  function renderMissing() {
    document.title = "Property not found | Heartstone Lagos";
    view.innerHTML =
      '<section class="empty-card"><p class="section-eyebrow">PROPERTY / NOT FOUND</p>' +
      '<h1 class="empty-title">This property is no longer listed.</h1>' +
      '<p class="empty-hint">It may have been removed or let. You can still browse the rest of the collection.</p>' +
      '<div class="empty-actions"><a class="hs-btn hs-btn--primary" href="properties.html">Browse all homes <span aria-hidden="true">→</span></a>' +
      '<a class="empty-link" href="about-contact.html#enquiry">Contact the office →</a></div></section>';
    section.hidden = true;
  }

  function selectPicture(index) {
    const images = property.images.length ? property.images : [""];
    const main = view.querySelector("#galleryMain");
    main.src = H.safeImageSrc(images[index]);
    main.alt =
      property.name + ", picture " + (index + 1) + " of " + images.length;
    view.querySelectorAll(".pd-thumb").forEach((thumb) => {
      const active = Number(thumb.dataset.index) === index;
      thumb.classList.toggle("is-active", active);
      thumb.setAttribute("aria-current", String(active));
    });
  }

  function renderProperty() {
    document.title = property.name + " | Heartstone Lagos";
    const images = property.images.length ? property.images : [""];
    const availability = Catalog.availabilityLabel(property);
    const thumbs =
      images.length > 1
        ? '<div class="pd-thumbs" role="group" aria-label="Property pictures">' +
          images
            .map(
              (src, i) =>
                `<button type="button" class="pd-thumb" data-index="${i}" aria-label="Show picture ${i + 1} of ${images.length}">` +
                `<img src="${esc(H.safeImageSrc(src))}" alt=""></button>`,
            )
            .join("") +
          "</div>"
        : "";
    const description =
      property.description ||
      "Contact the office for more information about this home.";
    view.innerHTML =
      '<article class="pd">' +
      `<div class="pd-gallery"><div class="pd-main"><img id="galleryMain" src="${esc(H.safeImageSrc(images[0]))}" alt="">` +
      (availability
        ? `<span class="hs-availability">${esc(availability)}</span>`
        : "") +
      `</div>${thumbs}</div>` +
      '<div class="pd-info">' +
      `<p class="hs-listing-type">${property.type === "rent" ? "TO RENT" : "FOR SALE"} · ${esc(property.kind.toUpperCase())}</p>` +
      `<h1>${esc(property.name)}</h1><p class="pd-price">${esc(H.formatPrice(property))}</p>` +
      `<p class="pd-location">${esc(property.location)}</p>` +
      '<ul class="pd-facts">' +
      `<li><strong>${property.beds}</strong> ${property.beds === 1 ? "bedroom" : "bedrooms"}</li>` +
      `<li><strong>${property.baths}</strong> ${property.baths === 1 ? "bathroom" : "bathrooms"}</li>` +
      `<li><strong>${property.area}</strong> sqm</li></ul>` +
      `<p class="pd-description">${esc(description)}</p>` +
      (property.features.length
        ? '<ul class="pd-features" aria-label="Features">' +
          property.features.map((item) => `<li>${esc(item)}</li>`).join("") +
          "</ul>"
        : "") +
      `<dl class="pd-meta"><div><dt>Reference</dt><dd>${esc(property.id)}</dd></div>` +
      `<div><dt>Availability</dt><dd>${esc(availability || "Available")}</dd></div></dl>` +
      '<div class="pd-actions"><a class="hs-btn hs-btn--primary" href="#inspection">Request an inspection <span aria-hidden="true">→</span></a>' +
      `<button type="button" class="hs-btn hs-btn--ghost pd-save" data-save="${esc(property.id)}" data-keep-label="1" aria-pressed="false"></button></div>` +
      "</div></article>";
    view
      .querySelectorAll(".pd-thumb")
      .forEach((thumb) =>
        thumb.addEventListener("click", () =>
          selectPicture(Number(thumb.dataset.index)),
        ),
      );
    if (images.length > 1) selectPicture(0);
    updateSaveLabel();
  }

  function updateSaveLabel() {
    const button = view.querySelector(".pd-save");
    if (!button || !property) return;
    Catalog.refreshSaveButtons(view);
    button.textContent = button.classList.contains("is-saved")
      ? "♥ Saved to your shortlist"
      : "♡ Save to shortlist";
  }

  function showStep(name) {
    gate.hidden = name !== "gate";
    form.hidden = name !== "form";
    review.hidden = name !== "review";
    done.hidden = name !== "done";
  }

  function propertyChip() {
    return (
      `<img src="${esc(H.firstImage(property))}" alt=""><div><p class="chip-name">${esc(property.name)}</p>` +
      `<p class="chip-meta">${esc(property.location)} · ${esc(H.formatPrice(property))}</p>` +
      `<p class="chip-meta">Reference ${esc(property.id)}</p></div>`
    );
  }

  function setupInspection() {
    if (!property) return;
    section.hidden = false;
    const status = H.sessionStatus();
    const target =
      "property.html?property=" +
      encodeURIComponent(property.id) +
      "#inspection";
    document.querySelector("#gateSignIn").href = H.signInUrl(
      "required",
      target,
    );
    document.querySelector("#gateCreate").href =
      "createaccount.html?next=" + encodeURIComponent(target);
    if (!status.valid) {
      showStep("gate");
      return;
    }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    fields.date.min =
      tomorrow.getFullYear() +
      "-" +
      String(tomorrow.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(tomorrow.getDate()).padStart(2, "0");
    document.querySelector("#formPropertyChip").innerHTML = propertyChip();
    if (!fields.name.value) fields.name.value = status.user.fullName;
    if (!fields.email.value) fields.email.value = status.user.email;
    if (!fields.phone.value) fields.phone.value = status.user.phone;
    if (form.hidden && review.hidden && done.hidden) showStep("form");
    else if (!gate.hidden) showStep("form");
  }

  function readForm() {
    return {
      date: fields.date.value.trim(),
      name: fields.name.value.replace(/\s+/g, " ").trim(),
      email: fields.email.value.trim(),
      phone: fields.phone.value.trim(),
      message: fields.message.value.trim(),
    };
  }

  function validateForm(values) {
    const errors = {};
    const date = H.validators.inspectionDate(values.date);
    const name = H.validators.fullName(values.name);
    const email = H.validators.email(values.email);
    const phone = H.validators.phone(values.phone, true);
    if (date) errors.date = date;
    if (name) errors.fullName = name;
    if (email) errors.email = email;
    if (phone) errors.phone = phone;
    if (values.message.length > 500)
      errors.message = "Use 500 characters or fewer.";
    return errors;
  }

  function summaryRow(label, value) {
    return `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
  }

  function renderReview() {
    document.querySelector("#reviewContent").innerHTML =
      `<div class="property-chip">${propertyChip()}</div>` +
      '<dl class="review-list">' +
      summaryRow("Preferred date", H.formatDate(draft.date)) +
      summaryRow("Full name", draft.name) +
      summaryRow("Email address", draft.email) +
      summaryRow("Phone number", draft.phone) +
      summaryRow("Message", draft.message || "No message") +
      "</dl>" +
      '<p class="review-note">Your preferred date is not a confirmed viewing. The agent will agree a date and time with you.</p>';
    showStep("review");
    const heading = review.querySelector("h3");
    heading.setAttribute("tabindex", "-1");
    heading.focus();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (busy) return;
    if (!H.sessionStatus().valid) {
      window.location.assign(
        H.signInUrl(
          "expired",
          "property.html?property=" +
            encodeURIComponent(property.id) +
            "#inspection",
        ),
      );
      return;
    }
    const values = readForm();
    const errors = validateForm(values);
    if (Object.keys(errors).length) {
      const count = UI.showFieldErrors(form, errors, FIELD_IDS);
      UI.banner(
        form,
        "error",
        `Please correct ${count} ${count === 1 ? "field" : "fields"} to continue. Your request has not been created.`,
      );
      return;
    }
    const old = form.querySelector(":scope > .hs-banner");
    if (old) old.remove();
    draft = values;
    renderReview();
  });
  Object.keys(fields).forEach((key) =>
    fields[key].addEventListener("input", () =>
      UI.clearFieldError(fields[key]),
    ),
  );

  document.querySelector("#reviewEdit").addEventListener("click", () => {
    showStep("form");
    fields.date.focus();
  });

  document
    .querySelector("#reviewConfirm")
    .addEventListener("click", async () => {
      if (busy || !draft || !property) return;

      const status = H.sessionStatus();

      if (!status.valid) {
        window.location.assign(
          H.signInUrl(
            "expired",
            "property.html?property=" +
              encodeURIComponent(property.id) +
              "#inspection",
          ),
        );
        return;
      }

      busy = true;

      const button = document.querySelector("#reviewConfirm");
      UI.setBusy(button, true, "Submitting request…");

      try {
        const response = await fetch("/api/inspections", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            propertyId: property.id,
            requester: draft.name,
            email: draft.email,
            phone: draft.phone,
            preferredDate: draft.date,
            message: draft.message,
          }),
        });

        const result = await response.json().catch(() => ({}));

        if (response.status === 401 || response.status === 403) {
          window.location.assign(
            H.signInUrl(
              "expired",
              "property.html?property=" +
                encodeURIComponent(property.id) +
                "#inspection",
            ),
          );
          return;
        }

        if (!response.ok) {
          UI.banner(
            review,
            "error",
            result.message ||
              "Your inspection request could not be submitted. Please try again.",
          );
          return;
        }

        const request = result.request;

        document.querySelector("#doneContent").innerHTML =
          `<div class="property-chip">${propertyChip()}</div>` +
          '<dl class="review-list">' +
          summaryRow("Request reference", request.id) +
          summaryRow("Status", "Pending") +
          summaryRow("Preferred date", H.formatDate(request.preferredDate)) +
          "</dl>" +
          '<p class="review-note">Your inspection request has been submitted. Our team will contact you to confirm the appointment.</p>';

        fields.date.value = "";
        fields.message.value = "";
        draft = null;

        showStep("done");

        const heading = done.querySelector("h3");
        heading.setAttribute("tabindex", "-1");
        heading.focus();
      } catch (error) {
        console.error("Inspection submission failed:", error);

        UI.banner(
          review,
          "error",
          "Unable to connect to the server. Please check your connection and try again.",
        );
      } finally {
        busy = false;
        UI.setBusy(button, false);
      }
    });

  Catalog.bindSaveButtons(document.body, updateSaveLabel);

  let propertyLoading = false;

  async function loadPropertyDetails() {
    if (propertyLoading) return;

    propertyLoading = true;
    view.textContent = "Loading property details…";
    section.hidden = true;

    try {
      if (!propertyId) {
        property = null;
        renderMissing();
        return;
      }

      await Promise.all([H.loadProperties(), H.refreshSession()]);

      if (H.sessionStatus().valid) {
        await H.loadFavourites();
      }

      property = H.getProperty(propertyId);

      if (!property) {
        renderMissing();
        return;
      }

      renderProperty();
      setupInspection();
      await Catalog.finishPendingSave();
      updateSaveLabel();
    } catch (error) {
      console.error("Property details loading failed:", error);
      view.replaceChildren();

      const message = document.createElement("p");
      message.className = "hs-banner hs-banner--error";
      message.textContent =
        "Unable to load this property right now. Please refresh the page.";

      view.appendChild(message);
      section.hidden = true;
    } finally {
      propertyLoading = false;
    }
  }

  loadPropertyDetails();
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      loadPropertyDetails();
    }
  });
  window.addEventListener("storage", (event) => {
    if (property && (event.key === null || event.key === H.KEYS.session)) {
      if (!H.sessionStatus().valid) showStep("gate");
      else if (!gate.hidden) setupInspection();
      updateSaveLabel();
    }
  });
})();
