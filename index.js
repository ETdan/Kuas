leaguesContainer = document.getElementById("leagues");
const leagues = [];

async function getLeagues() {
  return fetch("https://sports.core.api.espn.com/v2/sports/soccer/leagues")
    .then((response) => response.json())
    .then(async (leaguesRef) => {
      for (const element of leaguesRef.items) {
        const res = await getIndividualLeague(element.$ref);
        leagues.push(res);
      }
      return leagues;
    });
}
function getIndividualLeague(url) {
  return fetch(url)
    .then((response) => response.json())
    .then((league) => {
      return league;
    });
}

getLeagues().then((leagues) => {
  console.log(leagues);

  leagues.forEach((league) => {
    // Create parent div
    const leagueDiv = document.createElement("div");
    leagueDiv.classList.add("league-container", league.slug);

    // Create image element
    const img = document.createElement("img");
    img.classList.add("league-image");
    img.src =
      league.logos && league.logos.length > 0
        ? league.logos[0].href
        : "icons/missing_logo.jpg";
    img.alt = league.name;

    // Create name element
    const name = document.createElement("span");
    name.classList.add("league-name");
    name.innerText = league.name;

    // Append image and name to parent div
    leagueDiv.appendChild(img);
    leagueDiv.appendChild(name);
    leagueDiv.addEventListener("click", () => {
      localStorage.setItem("leagueSlug", league.slug);
      window.location.href = "league/league.html";
    });
    // Append parent div to container
    leaguesContainer.appendChild(leagueDiv);
  });
});

