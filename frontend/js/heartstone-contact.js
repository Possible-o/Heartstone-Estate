(function () {
  "use strict";

  const H = window.Heartstone;
  const UI = window.HeartstoneUI;

  const form = document.querySelector("#contactForm");
  if (!form) return;

  const status = document.querySelector("#formStatus");
  const interest = form.querySelector("#interest");
  const submit = form.querySelector('button[type="submit"]');

  let busy = false;

  function redirectToSignIn() {
    const next =
      window.location.pathname.split("/").pop() +
      window.location.search +
      "#contactForm";

    window.location.assign(H.signInUrl("required", next));
  }

  async function getSignedInUser() {
    const response = await fetch("/api/auth/session", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });

    if (response.status === 401) return null;

    if (!response.ok) {
      throw new Error("Unable to verify your session. Please try again.");
    }

    const result = await response.json();

    if (!result.authenticated || !result.user || result.user.role !== "user") {
      return null;
    }

    return result.user;
  }

  function chooseInterest(value) {
    const match = Array.from(interest.options).find(
      (option) => option.value === value && !option.disabled,
    );

    if (match) {
      interest.value = value;
      UI.clearFieldError(interest);
    }
  }

  chooseInterest(new URLSearchParams(window.location.search).get("interest"));

  document.querySelectorAll("[data-interest]").forEach((link) => {
    link.addEventListener("click", () => {
      chooseInterest(link.dataset.interest);
    });
  });

  Array.from(form.elements).forEach((field) => {
    if (!field.id) return;

    field.addEventListener("input", () => {
      UI.clearFieldError(field);
    });

    field.addEventListener("change", () => {
      UI.clearFieldError(field);
    });
  });

  form.setAttribute("novalidate", "");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (busy) return;

    busy = true;
    status.textContent = "";
    status.style.color = "";
    UI.setBusy(submit, true, "Checking session…");

    try {
      const user = await getSignedInUser();

      if (!user) {
        redirectToSignIn();
        return;
      }

      const values = {
        interest: interest.value,
        message: form.elements.namedItem("message").value.trim(),
      };

      const errors = {};

      const allowedInterests = [
        "Buying a property",
        "Selling a property",
        "Renting a property",
        "Letting a property",
        "Property valuation",
        "General enquiry",
      ];

      if (!values.interest) {
        errors.interest = "Choose what you would like help with.";
      } else if (!allowedInterests.includes(values.interest)) {
        errors.interest = "Choose a valid enquiry type.";
      }

      if (!values.message) {
        errors.message = "Tell us a little about your enquiry.";
      } else if (values.message.length > 1000) {
        errors.message = "Use 1,000 characters or fewer.";
      }

      if (Object.keys(errors).length) {
        const count = UI.showFieldErrors(form, errors, {});

        status.textContent =
          `Please correct ${count} ` +
          `${count === 1 ? "field" : "fields"} to continue. ` +
          "Your enquiry has not been sent.";

        return;
      }

      UI.clearFormErrors(form);
      UI.setBusy(submit, true, "Sending enquiry…");

      const response = await fetch("/api/enquiries", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      if (response.status === 401) {
        redirectToSignIn();
        return;
      }

      const contentType = response.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        throw new Error(
          "The enquiry service is unavailable. Please try again later.",
        );
      }

      const result = await response.json();

      if (!response.ok) {
        if (result.errors && typeof result.errors === "object") {
          UI.showFieldErrors(form, result.errors, {});
        }

        throw new Error(result.message || "Your enquiry could not be sent.");
      }

      const firstName = user.fullName.split(/\s+/)[0];

      form.reset();

      status.style.color = "#167347";
      status.textContent =
        `Thank you, ${firstName}. ` +
        "Your enquiry has been received successfully. " +
        "Our team will review your message.";
    } catch (error) {
      status.style.color = "#b42318";
      status.textContent =
        error instanceof Error && error.message
          ? error.message
          : "Unable to send your enquiry. Please try again.";
    } finally {
      busy = false;
      UI.setBusy(submit, false);
    }
  });
})();
