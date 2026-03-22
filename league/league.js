function setActiveNav(page) {
  document.querySelectorAll(".nav-link").forEach((link) => {
    const linkPage = link.getAttribute("data-page");
    if (linkPage === page) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });
}

function loadPage(page) {
  const fullPagePath = "../" + page + "/" + page;
  setActiveNav(page);
  fetch(fullPagePath + ".html")
    .then((response) => response.text())
    .then((html) => {
      content.innerHTML = html;
      // Dynamically load JS
      const script = document.createElement("script");
      script.src = fullPagePath + ".js";
      content.appendChild(script);
      // Dynamically load CSS
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = fullPagePath + ".css";
      document.head.appendChild(link);
    })
    .catch(() => {
      content.innerHTML = "<p>Page not found.</p>";
    });
}

document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const page = link.getAttribute("data-page");
    loadPage(page);
  });
});

document.getElementById("home").addEventListener("click", (e) => {
  e.preventDefault();
  // console.log("//////////////");

  window.location.href = "/index.html";
});
// Load default page
loadPage("matches");
