(function () {
  "use strict";
  const H = window.Heartstone;
  const UI = window.HeartstoneUI;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const MAX_FILE_BYTES = 8 * 1024 * 1024;
  const MAX_EDGE = 1280;
  const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const AVAILABILITY_BADGE = {
    "under-offer": "Under offer",
    "let-agreed": "Let agreed",
  };
  const STATUS_LABEL = {
    pending: "Pending",
    confirmed: "Confirmed",
    cancelled: "Cancelled",
  };

  let propertyFilter = "all";
  let requestFilter = "all";
  let draftImages = [];
  let saving = false;
  let processing = 0;

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }
  function openDialog(id) {
    const dialog = document.getElementById(id);
    if (dialog && !dialog.open) dialog.showModal();
  }
  function closeDialog(dialog) {
    if (dialog && dialog.open) dialog.close();
  }
  function adminStillValid() {
    return H.guardCheck();
  }
  function listingLabel(property) {
    return property.type === "rent" ? "TO RENT" : "FOR SALE";
  }
  function formatTime(date) {
    return date ? H.formatDate(date) : "Not agreed";
  }

  function setMenu(open) {
    const nav = $("#nav");
    const toggle = $("#mobileMenu");
    nav.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? "Close" : "Menu";
  }

  function switchView(name) {
    $$(".nav-tab").forEach((button) => {
      const active = button.dataset.view === name;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    $$(".view").forEach((view) => {
      const active = view.id === "view-" + name;
      view.classList.toggle("active", active);
      view.hidden = !active;
    });
    setMenu(false);
    window.scrollTo({
      top: 0,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
    render();
  }

  function matchesSearch(property, query) {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [property.name, property.location, property.kind, property.id].some(
      (value) =>
        String(value || "")
          .toLowerCase()
          .includes(q),
    );
  }

  function filteredProperties(query) {
    return H.getProperties().filter(
      (p) =>
        (propertyFilter === "all" || p.type === propertyFilter) &&
        matchesSearch(p, query),
    );
  }

  function propertyCard(property) {
    const badge = AVAILABILITY_BADGE[property.availability] || "";
    const pictures = property.images.length;
    const id = H.esc(property.id);
    return (
      '<article class="property-card" data-property="' +
      id +
      '">' +
      '<div class="property-image"><img src="' +
      H.esc(H.firstImage(property)) +
      '" alt="' +
      H.esc(property.name) +
      '" loading="lazy">' +
      (badge ? '<span class="availability">' + badge + "</span>" : "") +
      (property.featured ? '<span class="featured-flag">Featured</span>' : "") +
      "</div>" +
      '<div class="card-body"><p class="listing-type">' +
      listingLabel(property) +
      "</p>" +
      "<h3>" +
      H.esc(property.name) +
      "</h3>" +
      '<p class="price">' +
      H.esc(H.formatPrice(property)) +
      "</p>" +
      '<p class="location">' +
      H.esc(property.location) +
      "</p>" +
      '<p class="meta">' +
      H.esc(H.propertyFacts(property)) +
      " · " +
      H.esc(property.kind) +
      " · " +
      H.plural(pictures, "picture", "pictures") +
      "</p>" +
      '<p class="description">' +
      H.esc(
        property.description || "Contact the office for more information.",
      ) +
      "</p>" +
      '<div class="card-actions">' +
      '<button type="button" data-action="edit" data-id="' +
      id +
      '">Edit →</button>' +
      '<button type="button" data-action="preview" data-id="' +
      id +
      '">Preview</button>' +
      '<button type="button" data-action="feature" data-id="' +
      id +
      '" aria-pressed="' +
      property.featured +
      '">' +
      (property.featured ? "Unfeature" : "Feature") +
      "</button>" +
      '<button type="button" class="delete-link" data-action="delete" data-id="' +
      id +
      '" aria-label="Delete ' +
      H.esc(property.name) +
      '">Delete</button>' +
      "</div></div></article>"
    );
  }

  function renderProperties() {
    const all = H.getProperties();
    const sale = all.filter((p) => p.type === "sale").length;
    const rent = all.length - sale;
    const overviewQuery = $("#searchOverview").value;
    const overviewList = filteredProperties(overviewQuery);
    const emptyText = '<p class="empty">No matching properties.</p>';
    $("#overviewProperties").innerHTML =
      overviewList.slice(0, 4).map(propertyCard).join("") || emptyText;
    $("#allProperties").innerHTML =
      filteredProperties($("#searchAll").value).map(propertyCard).join("") ||
      emptyText;
    setText(
      "resultSummary",
      "Showing " +
        Math.min(4, overviewList.length) +
        " of " +
        overviewList.length +
        " matching properties.",
    );
    setText("total", all.length);
    setText("breakdown", sale + " for sale · " + rent + " to rent");
    setText("navProperties", all.length);
    ["countAll", "countAll2"].forEach((id) => setText(id, all.length));
    ["countSale", "countSale2"].forEach((id) => setText(id, sale));
    ["countRent", "countRent2"].forEach((id) => setText(id, rent));
    $$("[data-filter]").forEach((button) => {
      const active = button.dataset.filter === propertyFilter;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function syncPeriodField() {
    $("#periodField").hidden = $("#pType").value !== "rent";
  }

  function renderPreviews() {
    const list = $("#imagePreviews");
    list.replaceChildren();

    draftImages.forEach((image, index) => {
      const item = document.createElement("li");
      item.className = "image-preview";

      const isCover = index === 0;

      const img = document.createElement("img");
      img.src = H.safeImageSrc(image.src);
      img.alt = "Picture " + (index + 1) + (isCover ? " (cover)" : "");

      const tag = document.createElement("span");
      tag.className = "image-preview__tag";
      tag.textContent = isCover ? "Cover" : image.isNew ? "New" : "Saved";

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "image-preview__remove";
      remove.dataset.removeImage = String(index);
      remove.setAttribute("aria-label", "Remove picture " + (index + 1));
      remove.textContent = "×";

      const coverButton = document.createElement("button");
      coverButton.type = "button";
      coverButton.className = "cover-image-button";
      coverButton.dataset.coverImage = String(index);

      coverButton.textContent = isCover ? "Cover picture" : "Set as cover";

      coverButton.disabled = isCover;

      coverButton.title = isCover
        ? "This is the selected cover picture."
        : "Make this the property's cover picture.";

      item.append(img, tag, remove, coverButton);
      list.appendChild(item);
    });

    $("#pImages").disabled = draftImages.length >= H.MAX_IMAGES;
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("unreadable"));
      };
      img.src = url;
    });
  }
  async function fileToDataUrl(file) {
    const img = await loadImage(file);
    const scale = Math.min(
      1,
      MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  }

  async function addFiles(fileList) {
    const message = $("#propertyMessage");
    const files = Array.from(fileList);
    if (!files.length) return;
    const problems = [];
    const room = H.MAX_IMAGES - draftImages.length;
    const accepted = [];
    files.forEach((file) => {
      if (!IMAGE_TYPES.includes(file.type))
        problems.push(file.name + " is not a JPEG, PNG or WebP picture.");
      else if (file.size > MAX_FILE_BYTES)
        problems.push(file.name + " is larger than 8 MB.");
      else if (accepted.length >= room) {
        if (!problems.some((text) => text.startsWith("Only")))
          problems.push(
            "Only " + H.MAX_IMAGES + " pictures can be kept for one property.",
          );
      } else accepted.push(file);
    });
    processing += 1;
    $("#propertySave").disabled = true;
    message.textContent = "Preparing pictures…";
    for (const file of accepted) {
      try {
        draftImages.push({
          src: await fileToDataUrl(file),
          isNew: true,
          file: file,
        });
      } catch (error) {
        problems.push(file.name + " could not be read as a picture.");
      }
    }
    processing -= 1;
    if (!processing) $("#propertySave").disabled = false;
    renderPreviews();
    message.textContent = problems.join(" ");
    $("#pImages").value = "";
  }

  function openPropertyForm(id) {
    const property = id ? H.getProperty(id) : null;
    if (id && !property) {
      UI.toast("That property no longer exists.", { kind: "error" });
      render();
      return;
    }
    $("#propertyForm").reset();
    $("#editId").value = property ? property.id : "";
    $("#propertyDialogTitle").textContent = property
      ? "Edit property."
      : "Add a property.";
    $("#pName").value = property ? property.name : "";
    $("#pType").value = property ? property.type : "sale";
    $("#pAvailability").value = property ? property.availability : "available";
    $("#pPrice").value = property ? property.price : "";
    $("#pPeriod").value =
      property && property.pricePeriod ? property.pricePeriod : "year";
    $("#pLocation").value = property ? property.location : "";
    $("#pKind").value = property ? property.kind : "Apartment";
    $("#pBeds").value = property ? property.beds : 2;
    $("#pBaths").value = property ? property.baths : 2;
    $("#pArea").value = property ? property.area : "";
    $("#pDescription").value = property ? property.description : "";
    $("#pFeatures").value = property ? property.features.join("\n") : "";
    $("#pFeatured").checked = property ? property.featured : false;
    draftImages = property
      ? property.images.map((src) => ({ src, isNew: false }))
      : [];
    $("#propertyMessage").textContent = "";
    $("#propertySave").disabled = false;
    syncPeriodField();
    renderPreviews();
    openDialog("propertyDialog");
  }

  function readPropertyForm() {
    const type = $("#pType").value;
    return {
      id: $("#editId").value,
      name: $("#pName").value.trim().replace(/\s+/g, " "),
      type,
      pricePeriod: type === "rent" ? $("#pPeriod").value : null,
      availability: $("#pAvailability").value,
      price: Number($("#pPrice").value),
      location: $("#pLocation").value.trim().replace(/\s+/g, " "),
      kind: $("#pKind").value,
      beds: Number($("#pBeds").value),
      baths: Number($("#pBaths").value),
      area: Number($("#pArea").value),
      description: $("#pDescription").value.trim(),
      features: $("#pFeatures")
        .value.split("\n")
        .map((feature) => feature.trim())
        .filter(Boolean),
      featured: $("#pFeatured").checked,
      images: draftImages
        .filter((image) => !image.isNew)
        .map((image) => image.src),
    };
  }

  function validateProperty(item) {
    if (!item.name) return "Enter the property name.";
    if (!item.location) return "Enter the location.";
    if (!Number.isFinite(item.price) || item.price <= 0)
      return "Enter a price greater than zero.";
    if (!Number.isInteger(item.beds) || item.beds < 0)
      return "Enter the number of bedrooms (0 or more).";
    if (!Number.isInteger(item.baths) || item.baths < 0)
      return "Enter the number of bathrooms (0 or more).";
    if (!Number.isFinite(item.area) || item.area <= 0)
      return "Enter the area in square metres.";
    return "";
  }

  async function submitProperty(event) {
    event.preventDefault();

    if (saving || processing || !adminStillValid()) return;

    const message = $("#propertyMessage");
    const item = readPropertyForm();

    const problem = validateProperty(item);

    if (problem) {
      message.textContent = problem;
      return;
    }

    saving = true;
    const submit = $("#propertySave");
    UI.setBusy(submit, true, "Saving…");
    message.textContent = "";

    try {
      const result = await H.saveProperty(item);

      const newImages = draftImages
        .filter((image) => image.isNew && image.file)
        .map((image) => image.file);

      const selectedCover = draftImages[0];

      if (newImages.length) {
        const propertyId = result.property.id;

        try {
          const uploadResult = await H.uploadPropertyImages(
            propertyId,
            newImages,
          );

          if (selectedCover?.isNew) {
            const uploadedProperty = uploadResult.property;

            if (!uploadedProperty?.images?.length) {
              throw new Error("Unable to identify the uploaded cover picture.");
            }

            const uploadedImages = uploadedProperty.images;
            const newImageEntries = draftImages.filter(
              (image) => image.isNew && image.file,
            );

            const selectedCoverIndex = newImageEntries.indexOf(selectedCover);

            if (selectedCoverIndex === -1) {
              throw new Error("The selected cover picture was not found.");
            }

            const uploadedCover =
              uploadedImages[
                uploadedImages.length - newImages.length + selectedCoverIndex
              ];

            if (!uploadedCover) {
              throw new Error("Unable to identify the selected cover picture.");
            }

            await H.setPropertyCover(propertyId, uploadedCover);
          }
        } catch (uploadError) {
          render();

          message.textContent =
            "Property details were saved, but pictures could not be uploaded: " +
            uploadError.message +
            " Please reopen this property and upload the pictures again.";

          return;
        }
      }

      if (!result.ok) {
        throw new Error("The property could not be saved.");
      }

      closeDialog($("#propertyDialog"));
      render();

      UI.toast(
        result.property.name +
          (result.created ? " added successfully." : " updated successfully."),
        { kind: "success" },
      );
    } catch (error) {
      message.textContent =
        error.message || "Unable to save property. Please try again.";
    } finally {
      saving = false;
      UI.setBusy(submit, false);
    }
  }

  function previewProperty(id) {
    const property = H.getProperty(id);
    if (!property) return render();
    $("#previewTitle").textContent = property.name;
    const thumbs = property.images
      .map(
        (src, index) =>
          '<img class="preview-thumb" src="' +
          H.esc(H.safeImageSrc(src)) +
          '" alt="' +
          H.esc(property.name) +
          " picture " +
          (index + 1) +
          '" loading="lazy">',
      )
      .join("");
    $("#previewBody").innerHTML =
      '<div class="preview"><div><img src="' +
      H.esc(H.firstImage(property)) +
      '" alt="' +
      H.esc(property.name) +
      '">' +
      (property.images.length > 1
        ? '<div class="preview-thumbs">' + thumbs + "</div>"
        : "") +
      "</div>" +
      '<div><p class="listing-type">' +
      listingLabel(property) +
      "</p><h3>" +
      H.esc(property.name) +
      "</h3>" +
      '<p class="preview-price">' +
      H.esc(H.formatPrice(property)) +
      "</p>" +
      "<p>" +
      H.esc(property.location) +
      "</p><p>" +
      H.esc(H.propertyFacts(property)) +
      "</p>" +
      "<p>" +
      H.esc(property.description || "No description yet.") +
      "</p>" +
      (property.features.length
        ? "<p>" + property.features.map(H.esc).join(" · ") + "</p>"
        : "") +
      "<p>Reference: " +
      H.esc(property.id) +
      (property.featured ? " · Featured on the homepage" : "") +
      "</p></div></div>";
    openDialog("previewDialog");
  }

  async function toggleFeatured(id) {
    const property = H.getProperty(id);

    if (!property || !adminStillValid()) return;

    try {
      const result = await H.setFeatured(id, !property.featured);

      render();

      UI.toast(
        property.name +
          (result.property.featured
            ? " is now featured on the homepage."
            : " is no longer featured."),
        { kind: "success" },
      );
    } catch (error) {
      console.error("Feature update failed:", error);

      UI.toast(error.message || "The change could not be saved.", {
        kind: "error",
      });
    }
  }

  async function deleteProperty(id) {
    const property = H.getProperty(id);

    if (!property || !adminStillValid()) {
      UI.toast("Property not found or access denied.", {
        kind: "error",
      });
      return;
    }

    const confirmed = await UI.confirmDialog({
      title: "Delete this property?",
      message:
        `Are you sure you want to permanently delete "${property.name}"? ` +
        "This action cannot be undone.",
      confirmLabel: "Yes, delete property",
      cancelLabel: "Keep property",
    });

    if (!confirmed || !adminStillValid()) return;

    try {
      await H.deleteProperty(id);

      render();

      UI.toast(property.name + " deleted successfully.", {
        kind: "success",
      });
    } catch (error) {
      console.error("Property deletion failed:", error);

      UI.toast(error.message || "Unable to delete property.", {
        kind: "error",
      });
    }
  }

  function requestRow(request) {
    const property = H.requestProperty(request);
    const confirmed = request.status === "confirmed";
    const date = confirmed
      ? request.agreedDate || request.preferredDate
      : request.preferredDate;
    const detail = confirmed
      ? "Confirmed appointment"
      : request.status === "pending"
        ? "Preferred date · no time agreed"
        : "Original preferred date";
    const status = STATUS_LABEL[request.status] ? request.status : "pending";
    return (
      '<tr><td><div class="req-property"><img src="' +
      H.esc(H.firstImage(property)) +
      '" alt=""><div>' +
      '<div class="req-name">' +
      H.esc(property.name) +
      "</div><small>" +
      H.esc(request.id) +
      (property.missing ? " · No longer listed" : "") +
      "</small></div></div></td>" +
      "<td>" +
      H.esc(request.requester) +
      "<small>" +
      H.esc(request.phone || "No phone supplied") +
      "</small></td>" +
      "<td>" +
      H.esc(formatTime(date)) +
      (confirmed && request.agreedTime
        ? " · " + H.esc(request.agreedTime)
        : "") +
      "<small>" +
      detail +
      "</small></td>" +
      '<td><span class="status ' +
      status +
      '">' +
      STATUS_LABEL[status] +
      "</span></td>" +
      '<td><button type="button" class="row-action' +
      (status !== "pending" ? " text" : "") +
      '" data-action="review" data-id="' +
      H.esc(request.id) +
      '">' +
      (status === "pending" ? "Review request →" : "View details →") +
      "</button></td></tr>"
    );
  }

  function renderRequests() {
    const order = { pending: 0, confirmed: 1, cancelled: 2 };
    const requests = H.getRequests().sort(
      (a, b) => order[a.status] - order[b.status],
    );
    const count = (status) =>
      requests.filter((r) => r.status === status).length;
    $("#overviewRequests").innerHTML =
      requests.slice(0, 3).map(requestRow).join("") ||
      '<tr><td colspan="5">No inspection requests yet.</td></tr>';
    const q = $("#searchRequests").value.trim().toLowerCase();
    const list = requests.filter(
      (r) =>
        (requestFilter === "all" || r.status === requestFilter) &&
        (!q ||
          [r.id, r.requester, H.requestProperty(r).name, r.phone, r.email].some(
            (v) =>
              String(v || "")
                .toLowerCase()
                .includes(q),
          )),
    );
    $("#allRequests").innerHTML = list.map(requestRow).join("");
    $("#emptyRequests").hidden = list.length > 0;
    setText("pendingCount", count("pending"));
    setText("confirmedCount", count("confirmed"));
    setText("cancelledCount", count("cancelled"));
    setText("navRequests", requests.length);
    setText(
      "noticeTitle",
      count("pending") +
        (count("pending") === 1 ? " request needs" : " requests need") +
        " your attention",
    );
    setText(
      "noticeText",
      count("pending")
        ? "Check property availability and agree a date and time with the requester before confirming."
        : "No pending requests at the moment.",
    );
    $$("[data-status]").forEach((button) => {
      const active = button.dataset.status === requestFilter;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function reviewRequest(id) {
    const request = H.getRequest(id);
    if (!request) return render();
    const property = H.requestProperty(request);
    $("#requestId").value = id;
    $("#agreedDate").min = H.todayISO();
    $("#agreedDate").value = request.agreedDate || "";
    $("#agreedTime").value = request.agreedTime || "";
    $("#agentNote").value =
      request.status === "cancelled" ? request.note || "" : request.note || "";
    $("#requestMessage").textContent = "";
    const rows = [
      ["Property", property.name, property.location],
      ["Requester", request.requester, request.phone],
      ["Email", request.email, ""],
      [
        "Reference / status",
        request.id,
        STATUS_LABEL[request.status] || "Pending",
      ],
      [
        "Preferred date",
        H.formatDate(request.preferredDate),
        request.message ? "Message: " + request.message : "No message supplied",
      ],
      [
        "Current appointment",
        request.agreedDate
          ? H.formatDate(request.agreedDate) +
            (request.agreedTime ? " · " + request.agreedTime : "")
          : "Not agreed",
        "",
      ],
    ];
    $("#requestDetails").innerHTML = rows
      .map(
        (row) =>
          '<div class="detail"><small>' +
          H.esc(row[0]) +
          "</small><strong>" +
          H.esc(row[1] || "Not supplied") +
          "</strong>" +
          (row[2] ? "<em>" + H.esc(row[2]) + "</em>" : "") +
          "</div>",
      )
      .join("");
    const cancelled = request.status !== "pending";
    $("#confirmRequest").disabled = cancelled;
    $("#cancelRequest").disabled = cancelled;
    $("#agreedDate").disabled = cancelled;
    $("#agreedTime").disabled = cancelled;
    $("#agentNote").disabled = cancelled;
    $("#confirmRequest").textContent =
      request.status === "confirmed"
        ? "Save appointment →"
        : "Confirm appointment →";
    openDialog("requestDialog");
  }

  async function confirmRequest() {
    const request = H.getRequest($("#requestId").value);
    const message = $("#requestMessage");

    if (!request || request.status !== "pending" || !adminStillValid()) return;

    const date = $("#agreedDate").value;
    const time = $("#agreedTime").value;

    if (!date || !time) {
      message.textContent = "Enter the agreed appointment date and time.";
      return;
    }

    if (!H.isValidISODate(date) || date < H.todayISO()) {
      message.textContent = "The agreed date cannot be in the past.";
      return;
    }

    const ok = await UI.confirmDialog({
      title: "Confirm this appointment?",
      message:
        "Confirm the inspection for " +
        H.formatDate(date) +
        " at " +
        time +
        "?",
      confirmLabel: "Yes, confirm",
      cancelLabel: "Go back",
      danger: false,
    });

    if (!ok) return;

    const button = $("#confirmRequest");
    UI.setBusy(button, true, "Saving…");
    message.textContent = "";

    try {
      await H.updateRequest(request.id, {
        status: "confirmed",
        agreedDate: date,
        agreedTime: time,
        note: $("#agentNote").value.trim(),
      });

      closeDialog($("#requestDialog"));
      render();
      UI.toast("Appointment confirmed successfully.", {
        kind: "success",
      });
    } catch (error) {
      message.textContent = error.message || "Unable to confirm appointment.";
    } finally {
      UI.setBusy(button, false);
    }
  }

  async function cancelRequest() {
    const request = H.getRequest($("#requestId").value);

    if (!request || request.status !== "pending" || !adminStillValid()) return;

    const ok = await UI.confirmDialog({
      title: "Cancel this request?",
      message:
        "The request " + request.id + " will be cancelled and kept in history.",
      confirmLabel: "Yes, cancel request",
      cancelLabel: "Keep request",
    });

    if (!ok) return;

    const button = $("#cancelRequest");
    const message = $("#requestMessage");

    UI.setBusy(button, true, "Cancelling…");
    message.textContent = "";

    try {
      await H.updateRequest(request.id, {
        status: "cancelled",
        note: $("#agentNote").value.trim() || "Cancelled by the office.",
      });

      closeDialog($("#requestDialog"));
      render();
      UI.toast("Inspection request cancelled.", {
        kind: "success",
      });
    } catch (error) {
      message.textContent = error.message || "Unable to cancel request.";
    } finally {
      UI.setBusy(button, false);
    }
  }

  function render() {
    renderProperties();
    renderRequests();
  }

  function wire() {
    $$(".nav-tab").forEach((button) =>
      button.addEventListener("click", () => switchView(button.dataset.view)),
    );
    $$("[data-go]").forEach((button) =>
      button.addEventListener("click", () => switchView(button.dataset.go)),
    );
    $("#mobileMenu").addEventListener("click", () =>
      setMenu(!$("#nav").classList.contains("open")),
    );
    document.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        $("#nav").classList.contains("open") &&
        !document.querySelector("dialog[open]")
      ) {
        setMenu(false);
        $("#mobileMenu").focus();
      }
    });
    document.addEventListener("click", (event) => {
      if (
        $("#nav").classList.contains("open") &&
        !event.target.closest("#nav, #mobileMenu")
      )
        setMenu(false);
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const id = button.dataset.id;
      const action = button.dataset.action;
      if (action === "edit") openPropertyForm(id);
      else if (action === "preview") previewProperty(id);
      else if (action === "feature") toggleFeatured(id);
      else if (action === "delete") deleteProperty(id);
      else if (action === "review") reviewRequest(id);
    });
    window
      .matchMedia("(min-width: 601px)")
      .addEventListener("change", (event) => {
        if (event.matches) setMenu(false);
      });

    $("#addOne").addEventListener("click", () => openPropertyForm(""));
    $("#addAll").addEventListener("click", () => openPropertyForm(""));
    $$("[data-filter]").forEach((button) =>
      button.addEventListener("click", () => {
        propertyFilter = button.dataset.filter;
        renderProperties();
      }),
    );
    $("#searchOverview").addEventListener("input", renderProperties);
    $("#searchAll").addEventListener("input", renderProperties);
    $$("[data-status]").forEach((button) =>
      button.addEventListener("click", () => {
        requestFilter = button.dataset.status;
        renderRequests();
      }),
    );
    $("#searchRequests").addEventListener("input", renderRequests);

    $("#propertyForm").addEventListener("submit", submitProperty);
    $("#pType").addEventListener("change", syncPeriodField);
    $("#pImages").addEventListener("change", (event) =>
      addFiles(event.target.files),
    );

    $("#imagePreviews").addEventListener("click", async (event) => {
      const remove = event.target.closest("[data-remove-image]");

      if (!remove || saving || processing) return;

      const index = Number(remove.dataset.removeImage);
      const image = draftImages[index];

      if (!image) return;

      if (image.isNew) {
        draftImages.splice(index, 1);
        renderPreviews();
        $("#pImages").focus();
        return;
      }

      const propertyId = $("#editId").value;

      if (!propertyId || !adminStillValid()) return;

      const confirmed = await UI.confirmDialog({
        title: "Remove this picture?",
        message: "This picture will be permanently removed from the property.",
        confirmLabel: "Remove picture",
        cancelLabel: "Keep picture",
      });

      if (!confirmed || !adminStillValid()) return;

      processing += 1;
      $("#propertySave").disabled = true;

      try {
        await H.removePropertyImage(propertyId, image.src);

        draftImages = draftImages.filter((entry) => entry !== image);

        renderPreviews();
        render();

        UI.toast("Picture removed successfully.", {
          kind: "success",
        });
      } catch (error) {
        console.error("Picture removal failed:", error);

        UI.toast(error.message || "Unable to remove picture.", {
          kind: "error",
        });
      } finally {
        processing -= 1;

        if (!processing && !saving) {
          $("#propertySave").disabled = false;
        }
      }
    });

    $("#imagePreviews").addEventListener("click", async (event) => {
      const button = event.target.closest("[data-cover-image]");

      if (!button || saving || processing) return;

      const index = Number(button.dataset.coverImage);
      const image = draftImages[index];

      if (!image || index === 0 || !adminStillValid()) return;

      const propertyId = $("#editId").value;

      if (image.isNew || !propertyId) {
        draftImages.splice(index, 1);
        draftImages.unshift(image);
        renderPreviews();
        return;
      }

      processing += 1;
      $("#propertySave").disabled = true;

      try {
        const result = await H.setPropertyCover(propertyId, image.src);

        const savedImages = result.property.images.map((src) => ({
          src,
          isNew: false,
        }));

        const unsavedImages = draftImages.filter((entry) => entry.isNew);

        draftImages = [...savedImages, ...unsavedImages];

        renderPreviews();
        render();

        UI.toast("Cover picture updated successfully.", {
          kind: "success",
        });
      } catch (error) {
        console.error("Cover image update failed:", error);

        UI.toast(error.message || "Unable to change cover picture.", {
          kind: "error",
        });
      } finally {
        processing -= 1;

        if (!processing && !saving) {
          $("#propertySave").disabled = false;
        }
      }
    });

    $("#confirmRequest").addEventListener("click", confirmRequest);
    $("#cancelRequest").addEventListener("click", cancelRequest);

    $$("[data-close]").forEach((button) =>
      button.addEventListener("click", () =>
        closeDialog(button.closest("dialog")),
      ),
    );
    $$("dialog").forEach((dialog) =>
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) closeDialog(dialog);
      }),
    );
    $("#signout").addEventListener("click", () => openDialog("signoutDialog"));
    $("#signoutContinue").addEventListener("click", async () => {
      try {
        await H.endAdminSession();
      } catch (error) {
        alert("Sign out failed. Please try again.");
        return;
      }
      location.replace("admin-login.html?reason=signed-out");
    });

    window.addEventListener("storage", render);
    window.addEventListener("pageshow", async (event) => {
      if (!event.persisted || !H.guardCheck()) return;

      try {
        await Promise.all([H.loadProperties(), H.loadRequests()]);
        render();
      } catch (error) {
        console.error("Dashboard refresh failed:", error);
        UI.toast("Unable to refresh dashboard data.", {
          kind: "error",
        });
      }
    });
  }

  async function init() {
    if (!H.adminSessionStatus().valid) return;

    const admin = H.adminSessionStatus().admin;
    setText(
      "adminName",
      admin?.fullName ||
        admin?.name ||
        window.__HEARTSTONE_SESSION__?.user?.fullName ||
        "Administrator",
    );

    $("#today").textContent = new Intl.DateTimeFormat("en-NG", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date());

    $$(".view").forEach((view) => {
      view.hidden = !view.classList.contains("active");
    });

    wire();
    try {
      await H.loadProperties();
      render();
    } catch (error) {
      console.error("Property loading failed:", error);
      UI.toast("Unable to load properties from the server.", {
        kind: "error",
      });
    }

    try {
      await H.loadRequests();
      renderRequests();
    } catch (error) {
      console.error("Inspection loading failed:", error);
      UI.toast(error.message || "Unable to load inspection requests.", {
        kind: "error",
      });
    }
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();

(function () {
  "use strict";

  const H = window.Heartstone;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const table = $("#allEnquiries");
  if (!table) return;

  let enquiries = [];
  let page = 1;
  let pages = 0;
  let total = 0;
  let filter = "all";
  let selectedId = null;
  let loading = false;
  let saving = false;

  const message = $("#enquiriesMessage");
  const dialog = $("#enquiryDialog");

  function escapeHTML(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  }

  function formatDate(value) {
    if (!value) return "Not available";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? "Not available"
      : new Intl.DateTimeFormat("en-NG", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(date);
  }

  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      throw new Error("The enquiry service returned an invalid response.");
    }

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.message || "Unable to complete the enquiry request.",
      );
    }

    return result;
  }

  function render() {
    const query = $("#searchEnquiries").value.trim().toLowerCase();

    const visible = enquiries.filter((item) => {
      const matchesStatus = filter === "all" || item.status === filter;

      const matchesSearch = [
        item.id,
        item.fullName,
        item.email,
        item.phone,
        item.interest,
        item.message,
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query),
      );

      return matchesStatus && matchesSearch;
    });

    table.innerHTML =
      visible
        .map((item) => {
          const status = ["pending", "reviewed", "resolved"].includes(
            item.status,
          )
            ? item.status
            : "pending";

          return `
        <tr>
          <td>
            <strong>${escapeHTML(item.fullName)}</strong>
            <small>${escapeHTML(item.email)}</small>
          </td>
          <td>${escapeHTML(item.interest)}</td>
          <td>${escapeHTML(formatDate(item.createdAt))}</td>
          <td>
            <span class="status ${status}">
              ${escapeHTML(status.charAt(0).toUpperCase() + status.slice(1))}
            </span>
          </td>
          <td>
            <button
              type="button"
              class="row-action"
              data-action="open-enquiry"
              data-id="${escapeHTML(item.id)}"
            >
              View enquiry →
            </button>
          </td>
        </tr>
      `;
        })
        .join("") ||
      '<tr><td colspan="5">No matching enquiries on this page.</td></tr>';

    $("#enquiriesPageInfo").textContent = total
      ? `Page ${page} of ${pages} · ${total} enquiries total · Search and filters apply to this page`
      : "No enquiries received yet.";

    $("#enquiriesPrevious").disabled = loading || page <= 1;
    $("#enquiriesNext").disabled = loading || page >= pages;

    document.getElementById("navEnquiries").textContent = total;

    $$("[data-enquiry-status]").forEach((button) => {
      const active = button.dataset.enquiryStatus === filter;

      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  async function loadEnquiries(requestedPage = page) {
    if (loading) return;

    loading = true;
    message.textContent = "Loading enquiries…";
    $("#refreshEnquiries").disabled = true;

    try {
      const result = await api(
        `/api/admin/enquiries?page=${encodeURIComponent(requestedPage)}`,
      );

      enquiries = Array.isArray(result.enquiries) ? result.enquiries : [];

      page = Number(result.page) || requestedPage;
      pages = Number(result.pages) || 0;
      total = Number(result.total) || 0;

      message.textContent = "";
    } catch (error) {
      message.textContent = error.message || "Unable to load enquiries.";
    } finally {
      loading = false;
      $("#refreshEnquiries").disabled = false;
      render();
    }
  }

  function openEnquiry(id) {
    const item = enquiries.find((entry) => entry.id === id);

    if (!item) return;

    selectedId = id;

    const details = [
      ["Full name", item.fullName],
      ["Email address", item.email],
      ["Phone number", item.phone || "Not supplied"],
      ["Enquiry type", item.interest],
      ["Message", item.message],
      ["Status", item.status],
      ["Submitted", formatDate(item.createdAt)],
      ["Reference", item.id],
    ];

    $("#enquiryDetails").replaceChildren();

    details.forEach(([label, value]) => {
      const row = document.createElement("div");
      row.className = "detail";

      const heading = document.createElement("small");
      heading.textContent = label;

      const content = document.createElement("strong");
      content.textContent = value || "Not supplied";
      content.style.whiteSpace = "pre-wrap";
      content.style.overflowWrap = "anywhere";

      row.append(heading, content);
      $("#enquiryDetails").appendChild(row);
    });

    $("#enquiryActionMessage").textContent = "";

    $("#markEnquiryReviewed").disabled = item.status === "reviewed";
    $("#markEnquiryResolved").disabled = item.status === "resolved";

    if (!dialog.open) dialog.showModal();
  }

  async function updateStatus(status) {
    if (saving || !selectedId) return;

    const id = selectedId;
    const reviewed = $("#markEnquiryReviewed");
    const resolved = $("#markEnquiryResolved");
    const actionMessage = $("#enquiryActionMessage");

    saving = true;
    reviewed.disabled = true;
    resolved.disabled = true;
    actionMessage.textContent = "Saving…";

    try {
      await api(`/api/admin/enquiries/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      const item = enquiries.find((entry) => entry.id === id);
      if (item) item.status = status;

      dialog.close();
      selectedId = null;
      render();

      await loadEnquiries(page);
    } catch (error) {
      actionMessage.textContent = error.message || "Unable to update enquiry.";
    } finally {
      saving = false;

      if (dialog.open) {
        const item = enquiries.find((entry) => entry.id === id);

        reviewed.disabled = item?.status === "reviewed";
        resolved.disabled = item?.status === "resolved";
      }
    }
  }

  function init() {
    $$('[data-view="enquiries"]').forEach((button) => {
      button.addEventListener("click", () => {
        loadEnquiries(page);
      });
    });

    $("#searchEnquiries").addEventListener("input", render);

    $$("[data-enquiry-status]").forEach((button) => {
      button.addEventListener("click", () => {
        filter = button.dataset.enquiryStatus;
        render();
      });
    });

    $("#enquiriesPrevious").addEventListener("click", () => {
      if (!loading && page > 1) {
        loadEnquiries(page - 1);
      }
    });

    $("#enquiriesNext").addEventListener("click", () => {
      if (!loading && page < pages) {
        loadEnquiries(page + 1);
      }
    });

    $("#refreshEnquiries").addEventListener("click", () => {
      loadEnquiries(page);
    });

    table.addEventListener("click", (event) => {
      const button = event.target.closest('[data-action="open-enquiry"]');

      if (button) {
        openEnquiry(button.dataset.id);
      }
    });

    $("#markEnquiryReviewed").addEventListener("click", () => {
      updateStatus("reviewed");
    });

    $("#markEnquiryResolved").addEventListener("click", () => {
      updateStatus("resolved");
    });

    window.addEventListener("pageshow", (event) => {
      if (event.persisted) {
        loadEnquiries(1);
      }
    });

    render();
    loadEnquiries(1);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
