const calendar = document.getElementById("calendar");
const overlay = document.getElementById("overlay");
const overlayImage = document.getElementById("overlayImage");
const yearButton = document.getElementById("yearButton");
const yearText = document.getElementById("yearText");
const audioPlayer = document.getElementById("audioPlayer");
const soundButton = document.getElementById("soundButton");
const closeButton = document.getElementById("closeButton");
const toast = document.getElementById("toast");
const countdown = document.getElementById("countdown");

let yearShown = false;

// --- TEST-MODUS über die Adresszeile (kein Code-Ändern nötig) ---
//   index.html?tag=5   -> so tun, als wäre heute der 5. Dezember
//   index.html?alle    -> alle Türchen freischalten
//   index.html?reset   -> geöffnete Türchen vergessen
// Parameter lassen sich kombinieren: index.html?tag=12&reset
const params = new URLSearchParams(window.location.search);

// Alternative zur Adresszeile: hier eine Zahl eintragen (z. B. 5), dann gilt
// immer "heute = 5. Dezember". Für den echten Betrieb auf null zurücksetzen!
const TEST_TAG = 24;

// Speicher, der nie einen Fehler wirft (z. B. bei file:// oder privatem Modus)
const store = {
	get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
	set(key, value) { try { localStorage.setItem(key, value); } catch (e) {} },
	remove(key) { try { localStorage.removeItem(key); } catch (e) {} }
};
const DEBUG_ALLOW_ALL = params.has("alle");
const RESET_STORAGE_ON_START = params.has("reset");
const CALENDAR_MONTH = 11; // 11 = Dezember (Januar = 0)

if (RESET_STORAGE_ON_START) {
	store.remove("openedAdventsDoors");
}

// Liefert das "heutige" Datum – im Testmodus das simulierte
function getToday() {
	const testDay = parseInt(params.get("tag") ?? TEST_TAG, 10);
	if (testDay >= 1 && testDay <= 31) {
		return new Date(new Date().getFullYear(), CALENDAR_MONTH, testDay);
	}
	return new Date();
}

const images = [
	"images/1-2009.jpg",
	"images/2-2020.jpg",
	"images/3-2006.jpg",
	"images/4-2016.jpg",
	"images/5-2014.jpg",
	"images/6-200x.jpg",
	"images/7-2008.jpg",
	"images/8-2006.jpg",
	"images/9-2013.jpg",
	"images/10-2011.jpg",
	"images/11-2015.jpg",
	"images/12-200x.jpg",
	"images/13-2007.jpg",
	"images/14-2007.jpg",
	"images/15-2022.jpg",
	"images/16-2024.jpg",
	"images/17-2017.jpg",
	"images/18-2009.jpg",
	"images/19-2021.jpg",
	"images/20-2025.jpg",
	"images/21-2019.jpg",
	"images/22-2021.jpg",
	"images/23-202x.jpg",
	"images/24-2016.jpg"
];

const openedDoors = RESET_STORAGE_ON_START
	? []
	: JSON.parse(store.get("openedAdventsDoors") || "[]");

function isDoorAllowed(day) {
	if (DEBUG_ALLOW_ALL) return true;
	const today = getToday();
	return today.getMonth() === CALENDAR_MONTH && today.getDate() >= day;
}

function isToday(day) {
	const today = getToday();
	return today.getMonth() === CALENDAR_MONTH && today.getDate() === day;
}

// Testmodus sichtbar machen
if (DEBUG_ALLOW_ALL || params.has("tag") || TEST_TAG) {
	document.title = "[TEST] " + document.title;
}

// --- Countdown im Header ---
(function () {
	const now = getToday();
	if (now.getMonth() !== CALENDAR_MONTH) return;
	const left = 24 - now.getDate();
	if (left > 1) countdown.textContent = `Noch ${left} Tage bis Heiligabend`;
	else if (left === 1) countdown.textContent = "Morgen ist Heiligabend";
	else if (left === 0) countdown.textContent = "Heute ist Heiligabend";
})();

// --- Hinweis statt alert() ---
let toastTimer;
function showToast(message) {
	toast.textContent = message;
	toast.classList.add("show");
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

// --- Overlay ---
function openOverlay(imagePath, year, audioPath) {
	overlayImage.src = imagePath;
	yearText.textContent = "Welches Jahr war das?";
	yearText.classList.remove("show");
	yearText.dataset.year = year;
	yearShown = false;
	yearButton.textContent = "Jahr anzeigen";

	audioPlayer.pause();
	audioPlayer.src = audioPath;
	audioPlayer.currentTime = 0;
	audioPlayer.play().catch(err => console.log("Audio-Autoplay blockiert:", err));

	overlay.classList.add("show");
	overlay.setAttribute("aria-hidden", "false");
}

function closeOverlay() {
	overlay.classList.remove("show");
	overlay.setAttribute("aria-hidden", "true");
	audioPlayer.pause();
	audioPlayer.currentTime = 0;
}

// --- Türchen erzeugen ---
images.forEach((imagePath, index) => {
	const day = index + 1;
	const filename = imagePath.split("/").pop();
	const baseName = filename.replace(/\.[^.]+$/, ""); // Endung entfernen
	const year = baseName.split("-")[1];
	const audioPath = "audio/" + baseName + ".mp3";

	const allowed = isDoorAllowed(day);

	const card = document.createElement("button");
	card.type = "button";
	card.className = "card";
	card.setAttribute("aria-label", `Türchen ${day}`);
	if (openedDoors.includes(day)) card.classList.add("opened");
	if (!allowed) card.classList.add("locked");
	if (isToday(day)) card.classList.add("today");

	card.innerHTML = `
		<img class="photo" src="${imagePath}" alt="" loading="lazy">
		<div class="door">
			<span class="num">${day}</span>
			<span class="month">Dezember</span>
		</div>
	`;

	card.addEventListener("click", () => {
		if (!isDoorAllowed(day)) {
			card.classList.remove("shake");
			void card.offsetWidth; // Animation neu starten
			card.classList.add("shake");
			showToast(`Dieses Türchen darfst du erst am ${day}. Dezember öffnen.`);
			return;
		}

		const alreadyOpen = card.classList.contains("opened");
		card.classList.add("opened");

		if (!openedDoors.includes(day)) {
			openedDoors.push(day);
			store.set("openedAdventsDoors", JSON.stringify(openedDoors));
		}

		// Beim ersten Öffnen kurz warten, damit man die Tür aufschwingen sieht
		setTimeout(() => openOverlay(imagePath, year, audioPath), alreadyOpen ? 0 : 700);
	});

	calendar.appendChild(card);
});

// Zum heutigen Türchen scrollen
const todayCard = calendar.querySelector(".card.today");
if (todayCard) {
	todayCard.scrollIntoView({ block: "center", behavior: "smooth" });
}

// --- Buttons im Overlay ---
yearButton.addEventListener("click", () => {
	if (!yearShown) {
		yearText.textContent = yearText.dataset.year;
		yearText.classList.add("show");
		yearButton.textContent = "Schließen";
		yearShown = true;
	} else {
		closeOverlay();
	}
});

closeButton.addEventListener("click", closeOverlay);

overlay.addEventListener("click", (event) => {
	if (event.target === overlay) closeOverlay();
});

document.addEventListener("keydown", (event) => {
	if (event.key === "Escape" && overlay.classList.contains("show")) closeOverlay();
});

// Musik an/aus
soundButton.addEventListener("click", () => {
	if (audioPlayer.paused) audioPlayer.play().catch(() => {});
	else audioPlayer.pause();
});
audioPlayer.addEventListener("play", () => soundButton.classList.add("playing"));
audioPlayer.addEventListener("pause", () => soundButton.classList.remove("playing"));

// --- Schnee: kleine, ruhige Punkte ---
for (let i = 0; i < 45; i++) {
	const snow = document.createElement("div");
	snow.className = "snowflake";
	const size = 3 + Math.random() * 6;
	snow.style.width = snow.style.height = size + "px";
	snow.style.left = Math.random() * 100 + "vw";
	snow.style.animationDuration = 9 + Math.random() * 12 + "s";
	snow.style.animationDelay = -(Math.random() * 20) + "s";
	snow.style.opacity = 0.5 + Math.random() * 0.5;
	document.body.appendChild(snow);
}
