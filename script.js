const calendar = document.getElementById("calendar");
const overlay = document.getElementById("overlay");
const overlayContent = document.getElementById("overlayContent");
const overlayImage = document.getElementById("overlayImage");
const guessPanel = document.getElementById("guessPanel");
const guessSlider = document.getElementById("guessSlider");
const guessValue = document.getElementById("guessValue");
const resultPanel = document.getElementById("resultPanel");
const yearText = document.getElementById("yearText");
const resultDetail = document.getElementById("resultDetail");
const yearButton = document.getElementById("yearButton");
const skipButton = document.getElementById("skipButton");
const soundButton = document.getElementById("soundButton");
const closeButton = document.getElementById("closeButton");
const prevButton = document.getElementById("prevButton");
const nextButton = document.getElementById("nextButton");
const audioPlayer = document.getElementById("audioPlayer");
const toast = document.getElementById("toast");
const countdown = document.getElementById("countdown");
const scoreEl = document.getElementById("score");

// =====================================================================
// TEST-MODUS (bleibt in allen Versionen erhalten)
//   TEST_TAG = 5        -> immer so tun, als wäre heute der 5. Dezember
//   index.html?tag=5    -> dasselbe über die Adresszeile
//   index.html?alle     -> alle Türchen freischalten
//   index.html?reset    -> geöffnete Türchen UND Tipps/Punkte vergessen
// Parameter lassen sich kombinieren: index.html?tag=12&reset
// Für den echten Betrieb: TEST_TAG = null
// =====================================================================
const params = new URLSearchParams(window.location.search);
const TEST_TAG = 10;
const DEBUG_ALLOW_ALL = params.has("alle");
const RESET_STORAGE_ON_START = params.has("reset");
const CALENDAR_MONTH = 11; // 11 = Dezember (Januar = 0)

// Speicher, der nie einen Fehler wirft (z. B. bei file:// oder privatem Modus)
const store = {
	get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
	set(key, value) { try { localStorage.setItem(key, value); } catch (e) {} },
	remove(key) { try { localStorage.removeItem(key); } catch (e) {} }
};

function readJSON(key, fallback) {
	try {
		const value = JSON.parse(store.get(key));
		return value ?? fallback;
	} catch (e) {
		return fallback;
	}
}

const KEY_OPENED = "openedAdventsDoors";
const KEY_GUESSES = "adventGuesses";

if (RESET_STORAGE_ON_START) {
	store.remove(KEY_OPENED);
	store.remove(KEY_GUESSES);
}

// Liefert das "heutige" Datum – im Testmodus das simulierte
function getToday() {
	const testDay = parseInt(params.get("tag") ?? TEST_TAG, 10);
	if (testDay >= 1 && testDay <= 31) {
		return new Date(new Date().getFullYear(), CALENDAR_MONTH, testDay);
	}
	return new Date();
}

function isDoorAllowed(day) {
	if (DEBUG_ALLOW_ALL) return true;
	const today = getToday();
	return today.getMonth() === CALENDAR_MONTH && today.getDate() >= day;
}

function isToday(day) {
	const today = getToday();
	return today.getMonth() === CALENDAR_MONTH && today.getDate() === day;
}

if (DEBUG_ALLOW_ALL || params.has("tag") || TEST_TAG) {
	document.title = "[TEST] " + document.title;
}

// =====================================================================
// Daten
// =====================================================================
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

const GUESS_MIN = 2000;
const GUESS_MAX = Math.max(new Date().getFullYear(), 2025);

const openedDoors = readJSON(KEY_OPENED, []);
const guesses = readJSON(KEY_GUESSES, {}); // { "5": { g: 2012, p: 3 } }  g = null: übersprungen

// Jahr aus dem Dateinamen: "2014" oder "200x" (nur Jahrzehnt bekannt)
function parseYear(text) {
	if (/^\d{4}$/.test(text)) {
		const y = Number(text);
		return { lo: y, hi: y, label: String(y), exact: true };
	}
	const m = /^(\d{3})x$/i.exec(text || "");
	if (m) {
		const lo = Number(m[1]) * 10;
		return { lo, hi: lo + 9, label: `${lo}er-Jahre`, exact: false };
	}
	return { lo: null, hi: null, label: text || "?", exact: false };
}

function pointsFor(diff) {
	if (diff === 0) return 5;
	if (diff === 1) return 3;
	if (diff === 2) return 2;
	if (diff <= 5) return 1;
	return 0;
}

function pointsText(p) {
	return p === 0 ? "keine Punkte" : `+${p} ${p === 1 ? "Punkt" : "Punkte"}`;
}

const doors = {}; // day -> { imagePath, audioPath, range, card }
let currentDay = null;
let lastGuess = 2015;

// =====================================================================
// Header: Countdown und Punkte
// =====================================================================
(function () {
	const now = getToday();
	if (now.getMonth() !== CALENDAR_MONTH) return;
	const left = 24 - now.getDate();
	if (left > 1) countdown.textContent = `Noch ${left} Tage bis Heiligabend`;
	else if (left === 1) countdown.textContent = "Morgen ist Heiligabend";
	else if (left === 0) countdown.textContent = "Heute ist Heiligabend";
})();

function renderScore() {
	const entries = Object.values(guesses).filter(e => e && e.g !== null);
	if (!entries.length) {
		scoreEl.textContent = "";
		return;
	}
	const total = entries.reduce((sum, e) => sum + e.p, 0);
	scoreEl.textContent = `${total} von ${entries.length * 5} Punkten`;
}

// =====================================================================
// Hinweis statt alert()
// =====================================================================
let toastTimer;
function showToast(message) {
	toast.textContent = message;
	toast.classList.add("show");
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

// =====================================================================
// Musik mit weichem Ein- und Ausblenden
// (Auf iPhones ist die Lautstärke nicht steuerbar – dort startet/stoppt
//  die Musik einfach ohne Überblendung.)
// =====================================================================
let fadeTimer;

function fadeTo(target, ms, done) {
	clearInterval(fadeTimer);
	const start = audioPlayer.volume;
	const steps = Math.max(1, Math.round(ms / 30));
	let i = 0;
	fadeTimer = setInterval(() => {
		i++;
		const v = start + (target - start) * (i / steps);
		try { audioPlayer.volume = Math.min(1, Math.max(0, v)); } catch (e) {}
		if (i >= steps) {
			clearInterval(fadeTimer);
			if (done) done();
		}
	}, 30);
}

function playTrack(path) {
	const start = () => {
		audioPlayer.src = path;
		audioPlayer.currentTime = 0;
		try { audioPlayer.volume = 0; } catch (e) {}
		audioPlayer.play().catch(err => console.log("Audio blockiert:", err));
		fadeTo(1, 1200);
	};
	if (!audioPlayer.paused && audioPlayer.getAttribute("src")) {
		fadeTo(0, 350, start); // laufendes Lied erst ausblenden
	} else {
		start();
	}
}

function stopTrack() {
	fadeTo(0, 500, () => {
		audioPlayer.pause();
		audioPlayer.currentTime = 0;
		try { audioPlayer.volume = 1; } catch (e) {}
	});
}

soundButton.addEventListener("click", () => {
	if (audioPlayer.paused) {
		try { audioPlayer.volume = 1; } catch (e) {}
		audioPlayer.play().catch(() => {});
	} else {
		clearInterval(fadeTimer);
		audioPlayer.pause();
	}
});
audioPlayer.addEventListener("play", () => soundButton.classList.add("playing"));
audioPlayer.addEventListener("pause", () => soundButton.classList.remove("playing"));

// =====================================================================
// Overlay: Anzeige, Tippen, Blättern
// =====================================================================
function openList() {
	return [...new Set(openedDoors)].sort((a, b) => a - b).filter(d => doors[d]);
}

function isAnswered(day) {
	return Boolean(guesses[day]) || doors[day].range.lo === null;
}

// Zeigt je nach Stand den Tipp-Regler oder das Ergebnis
function renderState() {
	const d = doors[currentDay];
	const answered = isAnswered(currentDay);

	guessPanel.hidden = answered;
	resultPanel.hidden = !answered;
	skipButton.hidden = answered;
	yearButton.textContent = answered ? "Schließen" : "Tipp abgeben";

	if (!answered) {
		guessSlider.value = lastGuess;
		guessValue.textContent = guessSlider.value;
		return;
	}

	yearText.textContent = d.range.label;

	const entry = guesses[currentDay];
	if (!entry || entry.g === null) {
		resultDetail.textContent = "";
	} else if (d.range.exact) {
		resultDetail.textContent = entry.g === d.range.lo
			? `Volltreffer! ${pointsText(entry.p)}`
			: `Dein Tipp: ${entry.g} · ${diffText(entry.g, d.range)} · ${pointsText(entry.p)}`;
	} else {
		resultDetail.textContent = entry.p === 5
			? `Dein Tipp: ${entry.g} – im richtigen Jahrzehnt! ${pointsText(entry.p)}`
			: `Dein Tipp: ${entry.g} · ${diffText(entry.g, d.range)} · ${pointsText(entry.p)}`;
	}
}

function yearDiff(g, range) {
	if (g < range.lo) return range.lo - g;
	if (g > range.hi) return g - range.hi;
	return 0;
}

function diffText(g, range) {
	const diff = yearDiff(g, range);
	return `${diff} ${diff === 1 ? "Jahr" : "Jahre"} daneben`;
}

function showDoor(day, animate) {
	const d = doors[day];
	currentDay = day;

	overlay.classList.toggle("single", openList().length < 2);
	overlay.classList.add("show");
	overlay.setAttribute("aria-hidden", "false");

	const apply = () => {
		if (currentDay !== day) return;
		overlayImage.src = d.imagePath;
		overlayImage.style.opacity = "";
		renderState();
	};

	if (animate) {
		overlayImage.style.opacity = "0";
		setTimeout(apply, 150);
	} else {
		apply();
	}
}

function closeOverlay() {
	overlay.classList.remove("show");
	overlay.setAttribute("aria-hidden", "true");
	currentDay = null;
	if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
	stopTrack();
}

function navigate(dir) {
	if (currentDay === null) return;
	const list = openList();
	if (list.length < 2) return;
	const i = list.indexOf(currentDay);
	const next = list[(i + dir + list.length) % list.length];
	playTrack(doors[next].audioPath);
	showDoor(next, true);
}

function saveGuesses() {
	store.set(KEY_GUESSES, JSON.stringify(guesses));
	renderScore();
}

function submitGuess() {
	const d = doors[currentDay];
	const g = Number(guessSlider.value);
	lastGuess = g;
	guesses[currentDay] = { g, p: pointsFor(yearDiff(g, d.range)) };
	saveGuesses();
	renderState();
}

function skipGuess() {
	guesses[currentDay] = { g: null, p: 0 };
	saveGuesses();
	renderState();
}

guessSlider.addEventListener("input", () => {
	guessValue.textContent = guessSlider.value;
});
// Nach dem Loslassen den Fokus abgeben, damit die Pfeiltasten wieder blättern
guessSlider.addEventListener("pointerup", () => guessSlider.blur());

yearButton.addEventListener("click", () => {
	if (currentDay === null) return;
	if (isAnswered(currentDay)) closeOverlay();
	else submitGuess();
});
skipButton.addEventListener("click", () => {
	if (currentDay !== null) skipGuess();
});

closeButton.addEventListener("click", closeOverlay);
prevButton.addEventListener("click", () => navigate(-1));
nextButton.addEventListener("click", () => navigate(1));

overlay.addEventListener("click", (event) => {
	if (event.target === overlay) closeOverlay();
});

document.addEventListener("keydown", (event) => {
	if (!overlay.classList.contains("show")) return;
	if (event.key === "Escape") closeOverlay();
	else if (event.target && event.target.tagName === "INPUT") return; // Regler hat Vorrang
	else if (event.key === "ArrowLeft") navigate(-1);
	else if (event.key === "ArrowRight") navigate(1);
});

// Wischen auf dem Handy
let touchStart = null;
overlay.addEventListener("touchstart", (event) => {
	if (event.target.closest && event.target.closest("input, button")) {
		touchStart = null;
		return;
	}
	const t = event.changedTouches[0];
	touchStart = { x: t.clientX, y: t.clientY };
}, { passive: true });

overlay.addEventListener("touchend", (event) => {
	if (!touchStart) return;
	const t = event.changedTouches[0];
	const dx = t.clientX - touchStart.x;
	const dy = t.clientY - touchStart.y;
	touchStart = null;
	if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
		navigate(dx < 0 ? 1 : -1); // nach links wischen = nächstes Foto
	}
}, { passive: true });

// =====================================================================
// Türchen erzeugen
// =====================================================================
images.forEach((imagePath, index) => {
	const day = index + 1;
	const filename = imagePath.split("/").pop();
	const baseName = filename.replace(/\.[^.]+$/, ""); // Endung entfernen
	const yearPart = baseName.split("-")[1];
	const audioPath = "audio/" + baseName + ".mp3";

	const card = document.createElement("button");
	card.type = "button";
	card.className = "card";
	card.setAttribute("aria-label", `Türchen ${day}`);

	const wasOpened = openedDoors.includes(day);
	if (wasOpened) card.classList.add("opened");
	if (!isDoorAllowed(day)) card.classList.add("locked");
	if (isToday(day)) card.classList.add("today");

	card.innerHTML = `
		<img class="photo" src="${imagePath}" alt="" decoding="async" loading="${wasOpened ? "eager" : "lazy"}">
		<div class="door">
			<span class="num">${day}</span>
			<span class="month">Dezember</span>
		</div>
	`;

	doors[day] = { imagePath, audioPath, range: parseYear(yearPart), card };

	// Seitenverhältnis des Fotos übernehmen (Hoch- und Querformat)
	const photo = card.querySelector(".photo");
	const applyRatio = () => {
		if (photo.naturalWidth && photo.naturalHeight) {
			card.style.setProperty("--r", (photo.naturalWidth / photo.naturalHeight).toFixed(4));
		}
	};
	const syncRatio = () => {
		if (photo.complete) applyRatio();
		else photo.addEventListener("load", applyRatio, { once: true });
	};
	if (wasOpened) syncRatio();

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
		syncRatio();

		if (!openedDoors.includes(day)) {
			openedDoors.push(day);
			store.set(KEY_OPENED, JSON.stringify(openedDoors));
		}

		// Musik sofort starten (zählt als Nutzer-Klick, wird also nicht blockiert)
		playTrack(audioPath);

		// Beim ersten Öffnen kurz warten, damit man die Tür aufschwingen sieht
		setTimeout(() => showDoor(day, false), alreadyOpen ? 0 : 700);
	});

	calendar.appendChild(card);
});

renderScore();

// Zum heutigen Türchen scrollen
const todayCard = calendar.querySelector(".card.today");
if (todayCard) {
	todayCard.scrollIntoView({ block: "center", behavior: "smooth" });
}

// =====================================================================
// Schnee
// =====================================================================
for (let i = 0; i < 70; i++) {
	const snow = document.createElement("div");
	const isStar = Math.random() < 0.35;
	snow.className = "snowflake " + (isStar ? "star" : "dot");

	if (isStar) {
		snow.textContent = "❄";
		snow.style.fontSize = 26 + Math.random() * 28 + "px";
	} else {
		const size = 9 + Math.random() * 14;
		snow.style.width = snow.style.height = size + "px";
	}

	snow.style.left = Math.random() * 100 + "vw";
	snow.style.animationDuration = 8 + Math.random() * 12 + "s";
	snow.style.animationDelay = -(Math.random() * 20) + "s";
	snow.style.opacity = 0.75 + Math.random() * 0.25;
	document.body.appendChild(snow);
}

// Regler-Grenzen setzen
guessSlider.min = GUESS_MIN;
guessSlider.max = GUESS_MAX;
guessSlider.value = lastGuess;
guessValue.textContent = lastGuess;
