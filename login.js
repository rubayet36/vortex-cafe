// login.js — handles staff login only (kept separate from menu logic)

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");

  if (!form) return; // Prevents script from running if form doesn't exist

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!email || !password) {
      alert("Please enter both email and password.");
      return;
    }

    // Static login logic (you can replace this with Supabase Auth later if needed)
    if (email === "mahin@mail.com" && password === "mahin123") {
      window.location.href = "owner-dashboard.html";
    } else if (email === "admin@mail.com" && password === "admin123") {
      window.location.href = "dashboard.html";
    } else {
      alert("Invalid credentials. Please try again.");
    }
  });
});
