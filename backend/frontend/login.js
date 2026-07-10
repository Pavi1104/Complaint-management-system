async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  // 🔴 FRONTEND VALIDATION
  if (!email || !password) {
    alert("Please enter email and password");
    return;
  }

  try {
    const res = await fetch("http://localhost:5000/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message);
      return;
    }

    // ✅ Save token & role
    localStorage.setItem("token", data.token);
    localStorage.setItem("role", data.role);

    // ✅ Redirect based on role
    if (data.role === "admin") {
      window.location.href = "admin.html";
    } else {
      window.location.href = "user.html";
    }

  } catch (err) {
    alert("Server error");
  }
}
