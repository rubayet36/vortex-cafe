// Import from your specific setup file
const SUPABASE_URL = 'https://ovxxnsrqzdlyzdmubwaw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92eHhuc3JxemRseXpkbXVid2F3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NzY4MTgsImV4cCI6MjA3OTU1MjgxOH0.uwU9aQGbUO7OEv4HI8Rtq7awANWNubt3yJTSUMZRAJU';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!email || !password) {
      alert("Please enter both email and password.");
      return;
    }

    // 1. Search for the user in your custom table
    const { data: users, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .limit(1);

    if (error) {
      console.error("Database Error:", error);
      alert("Something went wrong connecting to the database.");
      return;
    }

    if (!users || users.length === 0) {
      alert("No user found with this email.");
      return;
    }

    const user = users[0];

    // 2. Check the plain text password directly
    // Note: 'user.password' comes from the database column we created in Step 1
    if (user.password !== password) {
      alert("Incorrect password.");
      return;
    }

    // 3. Login success - Handle Redirects
    alert("Login successful!");

    // Store a simple session marker (optional, for simple page protection)
    localStorage.setItem("vortex_user", JSON.stringify(user));

    if (user.email === "mahin@mail.com") {
      window.location.href = "owner-dashboard.html";
    } else if (user.email === "admin@mail.com") {
      window.location.href = "dashboard.html";
    } else {
      window.location.href = "user-home.html";
    }
  });
});