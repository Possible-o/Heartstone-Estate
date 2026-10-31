(function () {
  "use strict";
  const H = window.Heartstone;
  const UI = window.HeartstoneUI;
  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) =>
    Array.from((root || document).querySelectorAll(selector));

  const STATUS_LABEL = {
    pending: "Pending",
    confirmed: "Confirmed",
    cancelled: "Cancelled",
  };
  const PANELS = ["overview", "saved", "inspections", "enquiries", "profile"];
  let user = null;
  let openRequestId = "";
  let enquiries = [];

async function loadEnquiries() {
  const response = await fetch("/api/enquiries/mine", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store"
  });

  if (response.status === 401) {
    location.replace(H.signInUrl("expired", "user-dashboard.html#enquiries"));
    return;
  }

  if (!response.ok) {
    throw new Error("Unable to load your enquiries.");
  }

  const data = await response.json();
  enquiries = Array.isArray(data.enquiries) ? data.enquiries : [];
}

  function currentUser() {
    const status = H.sessionStatus();
    if (!status.valid) {
      H.guardCheck();
      return null;
    }
    user = status.user;
    return user;
  }

  function statusBadge(status) {
    const key = STATUS_LABEL[status] ? status : "pending";
    return (
      '<span class="status status--' +
      key +
      '">' +
      STATUS_LABEL[key] +
      "</span>"
    );
  }

  function dateInfo(request) {
    if (request.status === "confirmed") {
      const when =
        H.formatDate(request.agreedDate || request.preferredDate) +
        (request.agreedTime ? " · " + request.agreedTime : "");
      return { label: "Confirmed appointment", value: when };
    }
    if (request.status === "cancelled") {
      return {
        label: "Original preferred date",
        value: H.formatDate(request.preferredDate),
      };
    }
    return {
      label: "Preferred date · not confirmed",
      value: H.formatDate(request.preferredDate),
    };
  }

  function propertyCard(property) {
    const href = "property.html?property=" + encodeURIComponent(property.id);
    const kindLabel = property.type === "rent" ? "TO RENT" : "FOR SALE";
    return (
      '<article class="property-card">' +
      '<div class="property-image"><img src="' +
      H.esc(H.firstImage(property)) +
      '" alt="' +
      H.esc(property.name) +
      '" loading="lazy">' +
      '<button class="save-toggle" type="button" data-remove="' +
      H.esc(property.id) +
      '" aria-label="Remove ' +
      H.esc(property.name) +
      ' from saved homes" title="Remove saved home">♥</button></div>' +
      '<div class="property-content">' +
      '<p class="property-price">' +
      H.esc(H.formatPrice(property)) +
      " <small>" +
      kindLabel +
      "</small></p>" +
      "<h3>" +
      H.esc(property.name) +
      "</h3>" +
      '<p class="property-location">' +
      H.esc(property.location) +
      "</p>" +
      '<p class="property-meta">' +
      H.esc(H.propertyFacts(property)) +
      "</p>" +
      '<div class="property-actions"><a href="' +
      href +
      '">View property →</a>' +
      '<button type="button" data-remove="' +
      H.esc(property.id) +
      '">Remove</button></div>' +
      "</div></article>"
    );
  }

  function requestRow(request) {
    const property = H.requestProperty(request);
    const info = dateInfo(request);
    return (
      '<article class="request-row">' +
      '<div class="request-thumb"><img src="' +
      H.esc(H.firstImage(property)) +
      '" alt="" loading="lazy"></div>' +
      '<div class="request-property"><h3>' +
      H.esc(property.name) +
      "</h3>" +
      '<p class="request-id">' +
      H.esc(request.id) +
      "</p>" +
      '<p class="request-address">' +
      H.esc(property.location || "") +
      (property.missing ? " · No longer listed" : "") +
      "</p></div>" +
      '<div class="request-date-block"><p class="request-date-label">' +
      H.esc(info.label) +
      "</p>" +
      '<p class="request-date">' +
      H.esc(info.value) +
      "</p></div>" +
      '<div class="request-end">' +
      statusBadge(request.status) +
      '<button class="request-details" type="button" data-request="' +
      H.esc(request.id) +
      '">View details →</button></div>' +
      "</article>"
    );
  }

  function savedProperties() {
    return H.getFavourites(user.id)
      .map((id) => H.getProperty(id))
      .filter(Boolean);
  }

  function renderSaved() {
    const saved = savedProperties();
    $("#overviewSavedGrid").innerHTML = saved
      .slice(0, 3)
      .map(propertyCard)
      .join("");
    $("#savedPageGrid").innerHTML = saved.map(propertyCard).join("");
    $("#overviewSavedEmpty").hidden = saved.length !== 0;
    $("#savedPageEmpty").hidden = saved.length !== 0;
    ["savedStat", "savedTabCount", "savedHeadingCount"].forEach((id) => {
      $("#" + id).textContent = saved.length;
    });
  }

  function renderRequests() {
    const requests = H.getMyRequests();
    const count = (status) =>
      requests.filter((r) => r.status === status).length;
    $("#pendingStat").textContent = count("pending");
    $("#confirmedStat").textContent = count("confirmed");
    $("#cancelledStat").textContent = count("cancelled");
    $("#requestTabCount").textContent = requests.length;
    $("#requestHeadingCount").textContent = requests.length;

    const overview = $("#overviewRequestList");
    overview.innerHTML = requests.slice(0, 3).map(requestRow).join("");
    if (!requests.length) {
      overview.innerHTML =
        '<p class="empty-state">You have no inspection requests yet. Open a property and choose “Request an inspection”.</p>';
    }

    const filter = $("#requestFilter").value.toLowerCase();
    const visible = requests.filter(
      (r) => filter === "all" || r.status === filter,
    );
    $("#allRequestList").innerHTML = visible.map(requestRow).join("");
    const empty = $("#requestEmpty");
    empty.hidden = visible.length !== 0;
    empty.textContent = requests.length
      ? "No inspection requests match this filter."
      : "You have no inspection requests yet. Open a property and request an inspection from its page.";

    const pending = requests.find((r) => r.status === "pending");
    const notice = $("#pendingNotice");
    notice.hidden = !pending;
    if (pending) {
      const property = H.requestProperty(pending);
      $("#pendingNoticeTitle").textContent =
        property.name + " is awaiting agent confirmation.";
      $("#pendingNoticeText").textContent =
        "Your preferred date is " +
        H.formatDate(pending.preferredDate) +
        ". A pending request is not a confirmed appointment.";
    }
    if (openRequestId && !H.getRequest(openRequestId)) closeDialog();
  }

  function renderEnquiries() {
  const filter = $("#enquiryFilter").value.toLowerCase();

  const visible = enquiries.filter(enquiry =>
    filter === "all" || enquiry.status === filter
  );

  $("#enquiryTabCount").textContent = enquiries.length;

  const list = $("#enquiryList");
  const empty = $("#enquiryEmpty");

  list.innerHTML = visible.map(enquiry => {
    const status = ["pending", "reviewed", "resolved"].includes(enquiry.status)
      ? enquiry.status
      : "pending";

    const submitted = enquiry.createdAt
      ? new Date(enquiry.createdAt).toLocaleDateString("en-NG", {
          day: "numeric",
          month: "long",
          year: "numeric"
        })
      : "Date unavailable";

    return `
      <article class="request-row">
        <div class="request-property">
          <h3>${H.esc(enquiry.interest || "General enquiry")}</h3>
          <p class="request-address">${H.esc(enquiry.message || "")}</p>
        </div>

        <div class="request-date-block">
          <p class="request-date-label">Submitted</p>
          <p class="request-date">${H.esc(submitted)}</p>
        </div>

        <div class="request-end">
          <span class="status status--${status}">
            ${status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        </div>
      </article>
    `;
  }).join("");

  empty.hidden = visible.length !== 0;

  empty.textContent = enquiries.length
    ? "No enquiries match this filter."
    : "You haven't submitted any enquiries yet.";
}

  function renderProfile() {
    $("#fullName").value = user.fullName || "";
    $("#email").value = user.email || "";
    $("#phone").value = user.phone || "";
    const firstName = (user.fullName || "").split(/\s+/)[0];
    $("#welcomeName").textContent = firstName ? ", " + firstName + "." : ".";
    $("#summaryName").textContent = user.fullName || "Your profile";
    $("#summaryContact").textContent = [user.email, user.phone]
      .filter(Boolean)
      .join("  /  ");
  }

  function renderAll() {
    renderSaved();
    renderRequests();
    renderEnquiries();
    renderProfile();
  }

  function openPanel(name, options) {
    const target = PANELS.includes(name) ? name : "overview";
    $$(".account-panel").forEach((panel) => {
      const active = panel.id === target;
      panel.classList.toggle("is-visible", active);
      panel.hidden = !active;
    });
    $$(".account-tab").forEach((tab) => {
      const active = tab.dataset.panel === target;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    if (!options || options.updateHash !== false) {
      history.replaceState(
        null,
        "",
        target === "overview"
          ? location.pathname + location.search
          : "#" + target,
      );
    }
    if (!options || !options.keepScroll) {
      window.scrollTo({
        top: 0,
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    }
  }

  function showRequest(id) {
    const request = H.getMyRequest(id);
    if (!request) return;
    const property = H.requestProperty(request);
    const info = dateInfo(request);
    const appointmentMessage =
      request.status === "confirmed"
        ? "Your inspection appointment has been confirmed. Please arrive at the property on the agreed date and time."
        : request.status === "cancelled"
          ? "This inspection request has been cancelled. You may submit a new request if you are still interested in the property."
          : "Your inspection request is awaiting confirmation from our office.";
    openRequestId = id;
    $("#dialogTitle").textContent = property.name;
    $("#dialogContent").innerHTML =
      '<div class="dialog-facts">' +
      '<div class="dialog-fact"><span>Request reference</span><strong>' +
      H.esc(request.id) +
      "</strong></div>" +
      '<div class="dialog-fact"><span>Status</span><strong>' +
      statusBadge(request.status) +
      "</strong></div>" +
      '<div class="dialog-fact"><span>' +
      H.esc(info.label) +
      "</span><strong>" +
      H.esc(info.value) +
      "</strong></div>" +
      '<div class="dialog-fact"><span>Location</span><strong>' +
      H.esc(property.location || "Not available") +
      "</strong></div>" +
      '<div class="dialog-fact"><span>Contact</span><strong>' +
      H.esc(request.requester + " · " + request.phone) +
      "</strong></div>" +
      '<div class="dialog-fact"><span>Submitted</span><strong>' +
      H.esc(H.formatDate((request.createdAt || "").slice(0, 10), false)) +
      "</strong></div>" +
      "</div>" +
      (request.message
        ? '<p class="request-date"><strong>Your message:</strong> ' +
          H.esc(request.message) +
          "</p>"
        : "") +
      (request.note
        ? '<p class="request-date"><strong>Agent note:</strong> ' +
          H.esc(request.note) +
          "</p>"
        : "") +
      '<p class="request-date">' +
      H.esc(appointmentMessage) +
      "</p>";
    $("#cancelRequestButton").hidden = request.status !== "pending";
    const dialog = $("#requestDialog");
    if (!dialog.open) dialog.showModal();
  }

  function closeDialog() {
    openRequestId = "";
    const dialog = $("#requestDialog");
    if (dialog.open) dialog.close();
  }

  async function cancelOpenRequest() {
    const id = openRequestId;
    const request = H.getMyRequest(id);

    if (!request || request.status !== "pending") return;

    const property = H.requestProperty(request);

    const confirmed = await UI.confirmDialog({
      title: "Cancel this inspection request?",
      message:
        "Cancel your pending inspection for " +
        property.name +
        "? This action cannot be undone.",
      confirmLabel: "Yes, cancel request",
      cancelLabel: "Keep my request",
    });

    if (!confirmed) return;

    const button = $("#cancelRequestButton");
    UI.setBusy(button, true, "Cancelling…");

    try {
      await H.cancelRequest(user.id, id);

      renderRequests();
      showRequest(id);

      UI.toast("Inspection request cancelled successfully.", {
        kind: "success",
      });
    } catch (error) {
      UI.toast(error.message || "Unable to cancel request.", {
        kind: "error",
      });
    } finally {
      UI.setBusy(button, false);
    }
  }

  const PROFILE_FIELDS = {
    fullName: "fullName",
    email: "email",
    phone: "phone",
  };

  async function submitProfile(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const status = $("#profileStatus");
    const submit = $('button[type="submit"]', form);

    if (submit.disabled) return;

    UI.clearFormErrors(form);
    status.textContent = "";
    status.style.color = "";

    if (!currentUser()) return;

    UI.setBusy(submit, true, "Saving…");

    try {
      const response = await fetch("/api/users/me", {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: $("#fullName").value.trim(),
          email: $("#email").value.trim(),
          phone: $("#phone").value.trim(),
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const count = UI.showFieldErrors(
          form,
          result.errors || {},
          PROFILE_FIELDS,
        );

        status.style.color = "var(--red)";
        status.textContent = count
          ? "Check the highlighted fields and try again."
          : result.message || "Your changes could not be saved.";

        return;
      }

      user = result.user;

      renderProfile();
      UI.renderAuthNav();

      status.style.color = "green";
      status.textContent = "Your details have been saved.";
    } catch (error) {
      console.error("Profile update failed:", error);

      status.style.color = "var(--red)";
      status.textContent = "Unable to save your details. Please try again.";
    } finally {
      UI.setBusy(submit, false);
    }
  }

  async function init() {
    try {
      await H.refreshSession();
    } catch (error) {
      UI.toast("Unable to verify your session.", { kind: "error" });
      return;
    }

    if (!currentUser()) return;

    try {
      await Promise.all([
        H.loadProperties(),
        H.loadMyRequests(),
        H.loadFavourites(),
        loadEnquiries()
      ]);
    } catch (error) {
      console.error("Dashboard loading failed:", error);
      UI.toast(error.message || "Unable to load dashboard data.", {
        kind: "error",
      });
    }

    $$(".account-tab").forEach((tab) =>
      tab.addEventListener("click", () => openPanel(tab.dataset.panel)),
    );
    $(".account-nav").addEventListener("keydown", (event) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      const tabs = $$(".account-tab");
      const index = tabs.indexOf(document.activeElement);
      if (index === -1) return;
      const next =
        tabs[
          (index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) %
            tabs.length
        ];
      next.focus();
      openPanel(next.dataset.panel, { keepScroll: true });
    });
    $$("[data-go]").forEach((button) =>
      button.addEventListener("click", () => {
        if (button.dataset.status)
          $("#requestFilter").value = button.dataset.status;
        renderRequests();
        openPanel(button.dataset.go);
      }),
    );
    $("#requestFilter").addEventListener("change", renderRequests);
    $("#enquiryFilter").addEventListener("change", renderEnquiries);

    const signOut = $(".sign-out");
    signOut.setAttribute("href", "signin.html");
    signOut.addEventListener("click", (event) => {
      event.preventDefault();
      UI.signOut();
    });

    document.addEventListener("click", async (event) => {
      const removeButton = event.target.closest("[data-remove]");

      if (removeButton) {
        if (removeButton.disabled) return;

        const id = removeButton.dataset.remove;
        const property = H.getProperty(id);

        removeButton.disabled = true;

        try {
          await H.removeFavourite(user.id, id);
          renderSaved();

          UI.toast(
            (property ? property.name : "Property") +
              " removed from your saved homes.",
            {
              kind: "success",
              actionLabel: property ? "Undo" : "",
              onAction: async () => {
                try {
                  await H.addFavourite(user.id, id);
                  renderSaved();
                } catch (error) {
                  UI.toast(
                    error.message || "Unable to restore saved property.",
                    { kind: "error" },
                  );
                }
              },
            },
          );
        } catch (error) {
          removeButton.disabled = false;

          UI.toast(error.message || "Unable to remove saved property.", {
            kind: "error",
          });
        }

        return;
      }

      const detailsButton = event.target.closest("[data-request]");
      if (detailsButton) showRequest(detailsButton.dataset.request);
    });

    $("#closeDialog").addEventListener("click", closeDialog);
    $("#requestDialog").addEventListener("close", () => {
      openRequestId = "";
    });
    $("#cancelRequestButton").addEventListener("click", cancelOpenRequest);
    $("#profileForm").addEventListener("submit", submitProfile);

    window.addEventListener("storage", () => {
      if (currentUser()) {
        renderSaved();
        renderRequests();
      }
    });

    async function refreshDashboard() {
      try {
        if (!currentUser()) return;
        await Promise.all([
          H.loadProperties(),
          H.loadMyRequests(),
          H.loadFavourites(),
          loadEnquiries()
        ]);
        renderAll();
      } catch (error) {
        console.error("Dashboard refresh failed:", error);
        UI.toast("Unable to refresh your dashboard.", {
          kind: "error",
        });
      }
    }

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) refreshDashboard();
    });

    window.addEventListener("pageshow", (event) => {
      if (event.persisted) refreshDashboard();
    });

    window.addEventListener("hashchange", () => {
      const name = location.hash.slice(1);
      if (PANELS.includes(name)) openPanel(name, { updateHash: false });
    });

    renderAll();
    const start = location.hash.slice(1);
    openPanel(PANELS.includes(start) ? start : "overview", {
      updateHash: false,
      keepScroll: true,
    });
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
