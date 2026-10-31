document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("forgot-password-form");
  const message = document.getElementById("forgot-password-message");
  const submitButton = form.querySelector('button[type="submit"]');

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = form.elements.email.value.trim().toLowerCase();

    if (!email) {
      message.textContent = "Please enter your email address.";
      return;
    }

    submitButton.disabled = true;
    message.textContent = "Sending your reset link...";

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to process your request.");
      }

      message.textContent =
        "If an account exists with this email, a password reset link will be sent. Please check your inbox and spam folder.";

      form.reset();
    } catch (error) {
      message.textContent =
        error.message || "Something went wrong. Please try again.";
    } finally {
      submitButton.disabled = false;
    }
  });
});
