
(function () {
  "use strict";
  const H = window.Heartstone;
  const UI = window.HeartstoneUI;
  const params = new URLSearchParams(location.search);
  const NEXT = H.safeNext(params.get("next"));
  const PAGE_LABELS = {
    "user-dashboard.html": "your account",
    "index.html": "the Heartstone Lagos homepage",
    "about-contact.html": "About & contact",
    "properties.html": "the property search",
    "property.html": "the property you were viewing",
  };
  function destinationLabel(next) {
    const file = next.split(/[?#]/)[0];
    return PAGE_LABELS[file] || "the page you asked for";
  }

  function afterSignIn() {
    location.replace(NEXT || "user-dashboard.html");
  }

  

  function initSignIn(form) {
    form.setAttribute("novalidate", "");
    const panel = form.closest(".signin-panel");
    const heading = panel.querySelector("h2");
    const intro = panel.querySelector(".signin-intro");
    const email = form.querySelector("#email");
    const password = form.querySelector("#password");
    const submit = form.querySelector('button[type="submit"]');
    let busy = false;


    const reason = params.get("reason");
    const flash = UI.takeFlash();
    if (reason === "expired") {
      heading.textContent = "Please sign in again.";
      intro.textContent =
        "Your session ended. Sign in to carry on where you left off.";
    } else if (reason === "required") {
      heading.textContent = "Sign in to continue.";
      intro.textContent = "This part of Heartstone Lagos is only open to signed-in visitors.";
    }
    if (NEXT && (reason === "expired" || reason === "required")) {
      const note = document.createElement("p");
      note.className = "hs-return";
      note.textContent = "Return destination retained: you will go back to " + destinationLabel(NEXT) + " after signing in.";
      intro.insertAdjacentElement("afterend", note);
    }
    if (flash) UI.banner(panel, flash.kind === "error" ? "error" : "success", flash.message);
    else if (reason === "signed-out") UI.banner(panel, "success", "You have been signed out.");

    const forgot = panel.querySelector(".forgot-password a");
    

    [email, password].forEach((input) => input.addEventListener("input", () => UI.clearFieldError(input)));

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      UI.clearFormErrors(form);
      const old = panel.querySelector(":scope > .hs-banner");
      if (old) old.remove();
      const errors = {};
      if (!email.value.trim()) errors.email = "Enter your email address.";
      else if (H.validators.email(email.value)) errors.email = "Enter a valid email address.";
      if (!password.value) errors.password = "Enter your password.";
      if (Object.keys(errors).length) {
        UI.showFieldErrors(form, errors, {});
        return;
      }
      if (busy) return;
      busy = true; submit.disabled = true;
      try {
        await H.loginUser({ email: email.value.trim(), password: password.value });
        password.value = "";
        afterSignIn();
      } catch (error) { UI.banner(panel, "error", error.message); password.value = ""; }
      finally { busy = false; submit.disabled = false; }
    });
  }

  

  const SIGNUP_IDS = { fullName: "fullName", email: "email", phone: "phone", password: "password", confirmPassword: "confirmPassword", terms: "terms" };

  function initSignUp(form) {
    form.setAttribute("novalidate", "");
    const container = form.closest(".signup-form-container");
    const submit = form.querySelector('button[type="submit"]');
    const fields = Array.from(form.querySelectorAll("input"));
    fields.forEach((input) => {
      const clear = () => UI.clearFieldError(input);
      input.addEventListener("input", clear);
      input.addEventListener("change", clear);
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const old = container.querySelector(":scope > .hs-banner");
      if (old) old.remove();
      const get = (name) => form.elements.namedItem(name);
      const values = {
        fullName: get("fullName")?.value || "",
        email: get("email")?.value || "",
        phone: get("phone")?.value || "",
        password: get("password")?.value || "",
        confirmPassword: get("confirmPassword")?.value || "",
        terms: Boolean(get("terms")?.checked)
      };
      const errors = {};
      for (const name of ["fullName", "email", "phone", "password"]) {
        const error = H.validators[name](values[name]);
        if (error) errors[name] = error;
      }
      const confirmationError = H.validators.confirmPassword(values.password, values.confirmPassword);
      if (confirmationError) errors.confirmPassword = confirmationError;
      if (!values.terms) errors.terms = "Agree to the terms of use to continue.";
      const count = UI.showFieldErrors(form, errors, SIGNUP_IDS);
      if (count) {
        const note = UI.banner(container, "error", `Please correct ${count} ${count === 1 ? "field" : "fields"} to continue.`);
        form.insertAdjacentElement("beforebegin", note);
        return;
      }
      if (submit.disabled) return;
      submit.disabled = true;
      try {
        await H.registerUser(values);
        get("password").value = ""; get("confirmPassword").value = "";
        UI.setFlash("success", "Account created. Sign in to continue.");
        location.replace("signin.html");
      } catch (error) { UI.banner(container, "error", error.message); get("password").value = ""; get("confirmPassword").value = ""; }
      finally { submit.disabled = false; }
    });
  }

  

  function initAdminLogin(form) {
    form.setAttribute("novalidate", "");
    const message = form.querySelector("#message");
    const email = form.querySelector("#email");
    const password = form.querySelector("#password");
    const submit = form.querySelector("#loginButton");
    const reason = params.get("reason");
    if (reason === "expired") message.textContent = "Your session ended. Please sign in again.";
    else if (reason === "signed-out") message.textContent = "You have been signed out.";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      message.textContent = "";
      if (!email.value.trim() || !password.value) {
        message.textContent = "Enter the administrator email and password.";
        return;
      }
      if (submit.disabled) return;
      submit.disabled = true;
      try { await H.loginAdmin({ email: email.value.trim(), password: password.value }); password.value = ""; location.replace("admin.html"); }
      catch (error) { message.textContent = error.message; password.value = ""; }
      finally { submit.disabled = false; }
    });
  }

  const signin = document.querySelector(".signin-form");
  const signup = document.querySelector(".signup-form");
  const admin = document.querySelector("#loginForm");
  if (signin) initSignIn(signin);
  else if (signup) initSignUp(signup);
  else if (admin) initAdminLogin(admin);
})();
