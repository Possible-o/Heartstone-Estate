(function (global) {
  "use strict";
  const H = global.Heartstone;
  const doc = document;
  const root = doc.documentElement;
  root.classList.add("hs-js");

  const FLASH_KEY = "hsl.flash.v1";
  const MOBILE_QUERY = "(max-width: 760px)";

  function setFlash(kind, message) {
    try {
      sessionStorage.setItem(FLASH_KEY, JSON.stringify({ kind, message }));
    } catch (error) {
      
    }
  }
  function takeFlash() {
    try {
      const raw = sessionStorage.getItem(FLASH_KEY);
      sessionStorage.removeItem(FLASH_KEY);
      const value = raw ? JSON.parse(raw) : null;
      return value && typeof value.message === "string" ? value : null;
    } catch (error) {
      return null;
    }
  }

  

  function toast(message, options) {
    const opts = options || {};
    const host = doc.querySelector("dialog[open]") || doc.body;
    let stack = host.querySelector(":scope > .hs-toasts");
    if (!stack) {
      stack = doc.createElement("div");
      stack.className = "hs-toasts";
      stack.setAttribute("role", "status");
      stack.setAttribute("aria-live", "polite");
      host.appendChild(stack);
    }
    const item = doc.createElement("div");
    item.className = "hs-toast hs-toast--" + (opts.kind || "info");
    const text = doc.createElement("span");
    text.textContent = message;
    item.appendChild(text);
    let timer = null;
    const dismiss = () => {
      clearTimeout(timer);
      item.remove();
      if (!stack.children.length) stack.remove();
    };
    if (opts.actionLabel && typeof opts.onAction === "function") {
      const action = doc.createElement("button");
      action.type = "button";
      action.className = "hs-toast__action";
      action.textContent = opts.actionLabel;
      action.addEventListener("click", () => {
        dismiss();
        opts.onAction();
      });
      item.appendChild(action);
    }
    const close = doc.createElement("button");
    close.type = "button";
    close.className = "hs-toast__close";
    close.setAttribute("aria-label", "Dismiss message");
    close.textContent = "×";
    close.addEventListener("click", dismiss);
    item.appendChild(close);
    stack.appendChild(item);
    timer = setTimeout(dismiss, opts.duration || 6000);
    return dismiss;
  }

  

  
  function openDialog(options) {
    const opts = options || {};
    const dialog = doc.createElement("dialog");
    dialog.className =
      "hs-dialog" + (opts.className ? " " + opts.className : "");
    const titleId = "hs-dialog-" + Math.random().toString(36).slice(2, 8);
    dialog.setAttribute("aria-labelledby", titleId);
    const panel = doc.createElement("div");
    panel.className = "hs-dialog__panel";
    const heading = doc.createElement("h2");
    heading.id = titleId;
    heading.className = "hs-dialog__title";
    heading.textContent = opts.title || "";
    const close = doc.createElement("button");
    close.type = "button";
    close.className = "hs-dialog__close";
    close.setAttribute("aria-label", "Close");
    close.textContent = "×";
    close.addEventListener("click", () => dialog.close());
    const body = doc.createElement("div");
    body.className = "hs-dialog__body";
    panel.append(close, heading, body);
    dialog.appendChild(panel);
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog && opts.dismissOnBackdrop !== false)
        dialog.close();
    });
    dialog.addEventListener("close", () => {
      dialog.remove();
      if (opener && opener.isConnected) opener.focus();
      if (typeof opts.onClose === "function") opts.onClose(dialog.returnValue);
    });
    const opener = doc.activeElement;
    doc.body.appendChild(dialog);
    dialog.showModal();
    return { dialog, body, heading, close: () => dialog.close() };
  }

  function confirmDialog(options) {
    return new Promise((resolve) => {
      let answer = false;
      const view = openDialog({
        title: options.title,
        className: "hs-dialog--confirm",
        onClose: () => resolve(answer),
      });
      const message = doc.createElement("p");
      message.className = "hs-dialog__text";
      message.textContent = options.message || "";
      const actions = doc.createElement("div");
      actions.className = "hs-dialog__actions";
      const keep = doc.createElement("button");
      keep.type = "button";
      keep.className = "hs-btn hs-btn--ghost";
      keep.textContent = options.cancelLabel || "Cancel";
      keep.addEventListener("click", () => view.close());
      const yes = doc.createElement("button");
      yes.type = "button";
      yes.className =
        "hs-btn " +
        (options.danger === false ? "hs-btn--primary" : "hs-btn--danger");
      yes.textContent = options.confirmLabel || "Confirm";
      yes.addEventListener("click", () => {
        answer = true;
        view.close();
      });
      actions.append(keep, yes);
      view.body.append(message, actions);
      keep.focus();
    });
  }

  

  function setBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      if (!button.dataset.hsLabel) button.dataset.hsLabel = button.innerHTML;
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.classList.add("is-busy");
      button.innerHTML =
        '<span class="hs-spinner" aria-hidden="true"></span> ' +
        H.esc(label || "Please wait…");
    } else {
      if (button.dataset.hsLabel) button.innerHTML = button.dataset.hsLabel;
      delete button.dataset.hsLabel;
      button.disabled = false;
      button.removeAttribute("aria-busy");
      button.classList.remove("is-busy");
    }
  }

  function clearFieldError(input) {
    if (!input) return;
    input.removeAttribute("aria-invalid");
    const id = input.id + "-error";
    const old = doc.getElementById(id);
    if (old) old.remove();
    input.removeAttribute("aria-describedby");
    const wrap = input.closest(".hs-field");
    if (wrap) wrap.classList.remove("has-error");
  }
  function setFieldError(input, message) {
    if (!input) return;
    clearFieldError(input);
    input.setAttribute("aria-invalid", "true");
    const note = doc.createElement("p");
    note.className = "hs-field-error";
    note.id = input.id + "-error";
    note.textContent = message;
    const anchor = input.closest(".password-input") || input;
    anchor.insertAdjacentElement("afterend", note);
    input.setAttribute("aria-describedby", note.id);
    const wrap = input.closest(".hs-field");
    if (wrap) wrap.classList.add("has-error");
  }
  function clearFormErrors(form) {
    form.querySelectorAll("[aria-invalid]").forEach(clearFieldError);
    const summary = form.querySelector(".hs-summary");
    if (summary) summary.remove();
  }
  
  function showFieldErrors(form, errors, fieldIds) {
    clearFormErrors(form);
    let first = null;
    let count = 0;
    Object.keys(errors).forEach((key) => {
      const input = form.querySelector("#" + (fieldIds[key] || key));
      if (!input) return;
      setFieldError(input, errors[key]);
      count += 1;
      if (!first) first = input;
    });
    if (first) first.focus();
    return count;
  }
  function banner(container, kind, message, where) {
    const old = container.querySelector(":scope > .hs-banner");
    if (old) old.remove();
    const node = doc.createElement("div");
    node.className = "hs-banner hs-banner--" + kind;
    node.setAttribute("role", kind === "error" ? "alert" : "status");
    node.textContent = message;
    if (where === "append") container.appendChild(node);
    else container.insertBefore(node, container.firstChild);
    return node;
  }

  function wirePasswordToggles() {
    doc.querySelectorAll(".password-toggle").forEach((button) => {
      if (button.dataset.hsWired) return;
      button.dataset.hsWired = "1";
      const input = button.closest(".password-input").querySelector("input");
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => {
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        button.textContent = show ? "Hide" : "Show";
        button.setAttribute("aria-pressed", String(show));
        button.setAttribute(
          "aria-label",
          (show ? "Hide " : "Show ") + (input.dataset.label || "password"),
        );
      });
    });
  }

  

  doc.addEventListener(
    "error",
    (event) => {
      const img = event.target;
      if (img && img.tagName === "IMG" && img.dataset.hsFallback !== "done") {
        img.dataset.hsFallback = "done";
        img.src = H.FALLBACK_IMAGE;
      }
    },
    true,
  );

  

  const mq = global.matchMedia(MOBILE_QUERY);
  let navCounter = 0;
  const navs = [];

  function setNavOpen(nav, open) {
    const toggle = nav.querySelector(".hs-menu-toggle");
    nav.classList.toggle("is-open", open);
    if (toggle) {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }
  }
  function closeAllNavs(returnFocus) {
    navs.forEach((nav) => {
      const wasOpen = nav.classList.contains("is-open");
      setNavOpen(nav, false);
      if (wasOpen && returnFocus) nav.querySelector(".hs-menu-toggle").focus();
    });
  }
  function initNavs() {
    doc.querySelectorAll("nav.site-nav, div.nav").forEach((nav) => {
      const links = nav.querySelector(".nav-links, .navlinks");
      if (!links || nav.dataset.hsNav) return;
      nav.dataset.hsNav = "1";
      nav.classList.add("hs-nav");
      links.classList.add("hs-nav-links");
      navCounter += 1;
      links.id = links.id || "hs-nav-links-" + navCounter;
      const toggle = doc.createElement("button");
      toggle.type = "button";
      toggle.className = "hs-menu-toggle";
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-controls", links.id);
      toggle.setAttribute("aria-label", "Open menu");
      toggle.innerHTML =
        '<span class="hs-bars" aria-hidden="true"><i></i><i></i><i></i></span>';
      toggle.addEventListener("click", () =>
        setNavOpen(nav, !nav.classList.contains("is-open")),
      );
      nav.appendChild(toggle);
      
      links.addEventListener("click", (event) => {
        if (event.target.closest("a, button")) setNavOpen(nav, false);
      });
      navs.push(nav);
    });
  }
  
  doc.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAllNavs(true);
  });
  doc.addEventListener("click", (event) => {
    navs.forEach((nav) => {
      if (nav.classList.contains("is-open") && !nav.contains(event.target))
        setNavOpen(nav, false);
    });
  });
  (mq.addEventListener
    ? mq.addEventListener.bind(mq, "change")
    : mq.addListener.bind(mq))(() => {
    if (!mq.matches) closeAllNavs(false);
  });

  

  async function signOut() {
    try { await H.endSession(); } catch (error) { alert("Sign out failed. Please try again."); return; }
    setFlash("success", "You have been signed out.");
    location.replace("signin.html?reason=signed-out");
  }
  function renderAuthNav() {
    const status = H.sessionStatus();
    navs.forEach((nav) => {
      const links = nav.querySelector(".hs-nav-links");
      links.querySelectorAll("[data-hs-auth]").forEach((node) => node.remove());
      const signIn = links.querySelector('a[href^="signin.html"]');
      const accountLink = links.querySelector(".account-link, .hs-account-link");
      if (!status.valid) {
        if (signIn) signIn.hidden = false;
        return;
      }
      if (signIn) signIn.hidden = true;
      let nameLink = accountLink;
      if (nameLink) {
        nameLink.textContent = status.user.fullName;
      } else {
        nameLink = doc.createElement("a");
        nameLink.href = "user-dashboard.html";
        nameLink.className = "hs-account-link";
        nameLink.dataset.hsAuth = "1";
        nameLink.textContent = status.user.fullName;
        links.appendChild(nameLink);
      }
      const out = doc.createElement("button");
      out.type = "button";
      out.className = "hs-logout";
      out.dataset.hsAuth = "1";
      out.textContent = "Log out";
      out.addEventListener("click", signOut);
      links.appendChild(out);
    });
  }

  async function init() {
  initNavs();
  renderAuthNav();
  wirePasswordToggles();
  try {
    await H.refreshSession();
    renderAuthNav();
  } catch (error) {
    console.error("Unable to verify navigation session:", error);
  }
}

  if (doc.readyState === "loading")
    doc.addEventListener("DOMContentLoaded", init);
  else init();
  global.addEventListener("pageshow", async (event) => {
  if (!event.persisted) return;

  try {
    await H.refreshSession();
    renderAuthNav();
  } catch (error) {
    console.error("Unable to refresh navigation session:", error);
  }
});
  global.addEventListener("storage", (event) => {
    if (event.key === null || event.key === H.KEYS.session) renderAuthNav();
  });

  global.HeartstoneUI = {
    setFlash,
    takeFlash,
    toast,
    openDialog,
    confirmDialog,
    setBusy,
    setFieldError,
    clearFieldError,
    clearFormErrors,
    showFieldErrors,
    banner,
    wirePasswordToggles,
    signOut,
    renderAuthNav,
  };
})(window);
