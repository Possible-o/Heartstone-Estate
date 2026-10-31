document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("reset-password-form");
  const message = document.getElementById("reset-password-message");
  const submitButton = form.querySelector('button[type="submit"]');
  const passwordInput = document.getElementById("password");
  const confirmInput = document.getElementById("confirm-password");

  const token = new URLSearchParams(window.location.search).get("token");

  if (token) {
    window.history.replaceState(null, "", window.location.pathname);
  }

  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    message.textContent = "This password reset link is invalid. Please request a new one.";
    submitButton.disabled = true;
  }

  document.querySelectorAll(".password-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const input = button.parentElement.querySelector("input");
      const visible = input.type === "password";

      input.type = visible ? "text" : "password";
      button.textContent = visible ? "Hide" : "Show";
      button.setAttribute(
        "aria-label",
        visible ? "Hide password" : "Show password"
      );
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const password = passwordInput.value;
    const confirmPassword = confirmInput.value;

    if (
      password.length < 8 ||
      password.length > 128 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/\d/.test(password) ||
      !/[^A-Za-z0-9\s]/.test(password)
    ) {
      message.textContent =
        "Use 8–128 characters, including uppercase, lowercase, a number and a special character.";
      return;
    }

    if (password !== confirmPassword) {
      message.textContent = "Your passwords do not match.";
      return;
    }

    submitButton.disabled = true;
    message.textContent = "Resetting your password...";

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ token, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to reset your password.");
      }

      passwordInput.value = "";
      confirmInput.value = "";

      message.textContent =
        "Password reset successful. You can now sign in with your new password.";

      submitButton.disabled = true;

      setTimeout(() => {
        window.location.replace("/signin.html");
      }, 2000);
    } catch (error) {
      message.textContent =
        error.message || "Something went wrong. Please try again.";
      submitButton.disabled = false;
    }
  });
});
