import { initializeApp }
    from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
  import {
      getFirestore,
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    increment
  } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


  // FIREBASE  
  const firebaseConfig = {
    apiKey: "AIzaSyAWGffQhe1R_lSjaXGvMsLwYlTZILgoJ7s",
    authDomain: "digitalull.firebaseapp.com",
    projectId: "digitalull",
    storageBucket: "digitalull.firebasestorage.app",
    messagingSenderId: "421274305167",
    appId: "1:421274305167:web:750093830e5718f9e426fa",
    measurementId: "G-5NTRRTN0T0"
  };

  const app = initializeApp(firebaseConfig);
  const db  = getFirestore(app);

  //  MAP: centred on Barcelona
  const map = L.map('map', { zoomControl: false }).setView([41.4036, 2.1744], 13);

  L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20
    }
  ).addTo(map);

  // LAYER OVERLAY
L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png',
  {
    opacity: 1.0,
    subdomains: 'abcd',
    maxZoom: 20
  }
).addTo(map);

  // PINS ABOVE STREET
  map.createPane('alwaysOnTopPane');
  map.getPane('alwaysOnTopPane').style.zIndex        = 650;
  map.getPane('alwaysOnTopPane').style.pointerEvents = 'auto';

  // PENDING PINS
  let pinId = 0;
  const pending = {};

  // PIN ICON
  function createPin(color = "var(--blanco)") {
    return L.divIcon({
      className: "",
      html: `
        <div style="
          width: 32px;
          height: 28px;
        ">
          <div style="
            width: 14px;
            height: 14px;
            background: ${color};
            transform: rotate(44.87deg);
            border-radius: 50%;
            box-shadow: 0 0 0 1px rgba(255,255,255,0.6);
          "></div>
        </div>
      `,
      iconSize:   [32, 32],
      iconAnchor: [16, 16]
    });
  }

  // NEW-PIN POPUP
  function newPinPopup(id) {
    return `
      <div style="max-width:220px;">
        <h3 style="margin:0 0 8px 0;">Comparte tu experiencia</h3>
        <p>1 Haz clic en un lugar en el mapa.</p>
        <p>2 Escribe tu experiencia, historia o sensación relacionada con ese lugar.</p>
        <p>3 Haz clic en «¡Hecho!».</p>
        <div style="margin-bottom:8px;">
          <label style="font-size:12px;">Nombre o identificador:</label>
          <input
            type="text"
            id="name-${id}"
            placeholder="Tu nombre no aparecerá en el mapa."
            style="
              width: 100%;
              margin-top: 4px;
              padding: 6px;
              border-radius: 6px;
              border: 1px solid #ccc;
              box-sizing: border-box;
            "
          >
        </div>
        <textarea
          id="msg-${id}"
          style="
            width: 100%;
            height: 60px;
            border-radius: 6px;
            box-sizing: border-box;
          "
          placeholder="Escribe aquí tu historia..."
        ></textarea>
        <div style="margin-top:8px;">
          <label style="font-size:12px;">Color del pin:</label>
          <input type="color" id="color-${id}" value="#DA64F0">
        </div>
        <button class="popup-btn done-btn" onclick="window.savePin(${id})">
          ¡Hecho!
        </button>
        <button class="popup-btn close-btn" onclick="window.cancelPin(${id})">
          Cerrar
          
        </button>
      </div>
    `;
  }

  //TOGGLE DARKNESS
  let highContrast = false;
const voyagerLayer = L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  { attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: 'abcd', maxZoom: 20 }
);
voyagerLayer.addTo(map);

const contrastLayer = L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png',
  { attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: 'abcd', maxZoom: 20 }
);

document.getElementById("contrastToggle").addEventListener("click", () => {
  if (highContrast) {
    map.removeLayer(contrastLayer);
    voyagerLayer.addTo(map);
  } else {
    map.removeLayer(voyagerLayer);
    contrastLayer.addTo(map);
  }
  highContrast = !highContrast;
});


  // SAVED-PIN POPUP: W/o Author
  function savedPinPopup(message, docId, likes = 0) {
  return `
    <div style="max-width:220px;">
      ${message ? `<p style="margin:0;">${message}</p>` : "<em>Sin mensaje.</em>"}
      <button
        onclick="window.addLike('${docId}', this)"
        style="
          margin-top: 10px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 18px;
          padding: 0;
        "
      >
        ❤️ <span>${likes}</span>
      </button>
    </div>
  `;
}


  // MAP CLICK: temporary pin
  map.on("click", function(e) {
    const id     = pinId++;
    const marker = L.marker(e.latlng, {
      icon: createPin(),
      pane: 'alwaysOnTopPane'
    }).addTo(map);

    pending[id] = { marker, saved: false };

    marker.bindPopup(newPinPopup(id)).openPopup();

    // Close temporary pin
    marker.on("popupclose", () => {
      if (!pending[id]?.saved) {
        map.removeLayer(marker);
      }
      delete pending[id];
    });
  });

  // SAVE PIN: Save to Firestone
  window.savePin = async function(id) {
    const entry = pending[id];
    if (!entry) return;

    const { marker } = entry;

    const colorInput = document.getElementById(`color-${id}`);
    const msgInput   = document.getElementById(`msg-${id}`);
    const nameInput  = document.getElementById(`name-${id}`);

    const color   = colorInput ? colorInput.value : "#ff4fd8";
    const message = msgInput   ? msgInput.value   : "";
    const author  = nameInput  ? nameInput.value  : "";

    // Mark as saved
    pending[id].saved = true;

    marker.setIcon(createPin(color));

    marker.unbindPopup();
    marker.bindPopup(savedPinPopup(message, "", 0));
    marker.closePopup();

    // Save to Firestore
    try {
      await addDoc(collection(db, "entries"), {
        lat:       marker.getLatLng().lat,
        lng:       marker.getLatLng().lng,
        author:    author,   
        message:   message,
        color:     color,
        likes:     0,
        createdAt: Date.now()
      });
       alert("¡Recibido! Gracias por compartir tu experiencia");
    } catch (err) {
      console.error("Hubo un problema al guardar tu experiencia. Inténtalo de nuevo.");
    }
  };

  // CANCEL PIN 
  window.cancelPin = function(id) {
    const entry = pending[id];
    if (!entry) return;
    map.removeLayer(entry.marker);
    delete pending[id];
  };

  // ADD LIKES
  window.addLike = async function(docId, btn) {
    console.log("docId recibido:", docId);
    btn.disabled = true;
    const count  = btn.querySelector("span");
    count.textContent = Number(count.textContent) + 1;

    try {
      const ref = doc(db, "entries", docId);
      console.log("ref creada:", ref);
      await updateDoc(ref, {
        likes: increment(1)
      });
      console.log("Like guardado OK");
    } catch (err) {
      console.error("Like error completo:", err);
      console.error("Código:", err.code);
      console.error("Mensaje:", err.message);
    }
  };

  
  // ZOOM CONTROLS 
  document.getElementById("zoomIn").onclick  = () => map.zoomIn();
  document.getElementById("zoomOut").onclick = () => map.zoomOut();

  document.getElementById("map").addEventListener("keydown", (e) => {
  const tag = e.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;

  switch (e.key) {
    case "+":
    case "=":
      map.zoomIn();
      break;
    case "-":
    case "_":
      map.zoomOut();
      break;
    case "ArrowUp":
    case "w":
    case "W":
      map.panBy([0, -50]);
      break;
    case "ArrowDown":
    case "s":
    case "S":
      map.panBy([0, 50]);
      break;
    case "ArrowLeft":
    case "a":
    case "A":
      map.panBy([-50, 0]);
      break;
    case "ArrowRight":
    case "d":
    case "D":
      map.panBy([50, 0]);
      break;
  }
});

  // HIDE LOGO ON SCROLL
  window.addEventListener("scroll", () => {
      const logo = document.querySelector(".logo");
      if (window.scrollY > 50) {
          logo.style.opacity = "0";
          logo.style.pointerEvents = "none";
      } else {
          logo.style.opacity = "1";
          logo.style.pointerEvents = "auto";
      }
  });
  // SEARCH AUTOCOMPLETE
  const searchInput   = document.getElementById("searchBox");
  const suggestionBox = document.getElementById("suggestions");
  let debounceTimer;

  // SELECT BY ENTER
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const first = suggestionBox.querySelector(".suggestion");
      if (first) first.click();
    }
  });

 searchInput.addEventListener("input", () => {
  clearTimeout(debounceTimer);

  const query = searchInput.value;
  if (query.length < 3) {
    suggestionBox.style.display = "none";
    return;
  }

  debounceTimer = setTimeout(async () => {
    try {
      // Barcelona city bounding box (tight)
      const bcnRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(query)}&viewbox=2.052,41.469,2.228,41.320&bounded=0&accept-language=ca,es&limit=5`
      );
      const bcnData = await bcnRes.json();

      // Catalonia-wide bounding box (broader bias)
      const catRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(query)}&viewbox=0.15,42.9,3.4,40.5&bounded=0&accept-language=ca,es&limit=5`
      );
      const catData = await catRes.json();

      // Global fallback
      const globalRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(query)}&limit=5`
      );
      const globalData = await globalRes.json();

      // Tier 1: results whose city/town is literally "Barcelona"
      const isBarcelonaCity = (p) =>
        p.address && (p.address.city === "Barcelona" || p.address.town === "Barcelona");

      const tier1 = bcnData.filter(isBarcelonaCity);
      const tier2 = catData.filter(p => !tier1.some(t => t.place_id === p.place_id));
      const tier3 = globalData.filter(p =>
        !tier1.some(t => t.place_id === p.place_id) &&
        !tier2.some(t => t.place_id === p.place_id)
      );

      const merged = [...tier1, ...tier2, ...tier3].slice(0, 5);

      suggestionBox.innerHTML     = "";
      suggestionBox.style.display = "block";

      merged.forEach(place => {
        const div     = document.createElement("div");
        div.className = "suggestion";
        div.innerText = place.display_name;

        div.onclick = () => {
          if (window._searchMarker) {
            map.removeLayer(window._searchMarker);
          }

          map.setView([place.lat, place.lon], 16);
          searchInput.value           = place.display_name;
          suggestionBox.style.display = "none";

          window._searchMarker = L.marker([place.lat, place.lon], {
            icon: L.divIcon({
              className: "",
              html: `
                <div style="
                  width: 18px;
                  height: 18px;
                  background: var(--magenta);
                  border: 3px solid var(--blanco);
                  border-radius: 50%;
                  box-shadow: 0 0 0 3px var(--magenta);
                "></div>
              `,
              iconSize:   [18, 18],
              iconAnchor: [9, 9]
            }),
            pane: 'alwaysOnTopPane'
          })
          .addTo(map)
          .bindPopup(`<div style="font-size:13px;">${place.display_name}</div>`)
          .openPopup();
        };

        suggestionBox.appendChild(div);
      });

    } catch (err) {
      console.error("Nominatim search error:", err);
    }
  }, 300);
});                                     

  // HIDE SUGGESTIONS
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#searchBox") && !e.target.closest("#suggestions")) {
      suggestionBox.style.display = "none";
    }
  });

  searchInput.addEventListener("focus", () => {
    if (suggestionBox.innerHTML.trim() !== "") {
      suggestionBox.style.display = "block";
    }
  });

  // LOAD PINS FIRESTONE
      async function loadPins() {
      try {
        const snapshot = await getDocs(collection(db, "entries"));
        const listContainer = document.getElementById("pinList");
        listContainer.innerHTML = `
  <button class="close-list-btn" aria-label="Cerrar lista de lugares" data-tooltip="Cerrar lista">✕</button>
  <h3>Lugares compartidos</h3>
  <p class="list-description">Haz click en estos comentarios para ver el lugar en el que se añadieron</p>
`;

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();

          if (!data.lat || !data.lng) return;

          const marker = L.marker(
            [data.lat, data.lng],
            { icon: createPin(data.color || "#ff4fd8"), pane: 'alwaysOnTopPane' }
          ).addTo(map);

          marker.bindPopup(savedPinPopup(data.message, docSnap.id, data.likes || 0));

          const item = document.createElement("div");
          item.style.cssText = "padding:8px 0; border-bottom:1px solid #eee; cursor:pointer;";
          item.textContent = data.message ? data.message.slice(0, 60) : "Sin mensaje";
          item.onclick = () => {
            map.setView([data.lat, data.lng], 16);
            marker.openPopup();
          };
          listContainer.appendChild(item);
        });

      } catch (err) {
        console.error("Firestore load error:", err);
      }
    }
    loadPins();

    document.getElementById("listToggle").addEventListener("click", () => {
      const list = document.getElementById("pinList");
      list.style.display = list.style.display === "none" ? "block" : "none";
    });

    document.addEventListener("click", (e) => {
  if (e.target && e.target.classList.contains("close-list-btn")) {
    document.getElementById("pinList").style.display = "none";
  }
});