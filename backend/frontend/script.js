const API = "http://localhost:5000/api";

async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

  if (data.token) {
    localStorage.setItem("token", data.token);
    localStorage.setItem("role", data.role);

    if (data.role === "admin") {
      window.location.href = "admin.html";
    } else {
      window.location.href = "user.html";
    }
  } else {
    alert(data.message);
  }
}
