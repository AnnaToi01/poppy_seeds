(function () {
  "use strict";

  const root = document.getElementById("root");
  const help = document.getElementById("help");
  if (!root) return;

  const IMAGE_SRC = "images/poppy_screensaver.webp";

  /** @typedef {{ el: HTMLDivElement, img: HTMLImageElement, x: number, y: number, vx: number, vy: number, size: number, r: number, dbId: number|null, createdAt: string|null }} Poppy */
  /** @type {Poppy[]} */
  const poppies = [];

  let viewportWidth = window.innerWidth;
  let viewportHeight = window.innerHeight;
  let lastTime = performance.now();
  let rafId = null;
  let remotePollTimer = null;
  let isInitialFetch = true;

  function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  var FADE_START_DAYS = 7; // start fading after 7 days
  var FADE_END_DAYS = 28; // keep a very low shade from 28+ days
  var BASE_RED_GLOW =
    "drop-shadow(0 0 8px rgba(255,70,70,0.5)) drop-shadow(0 0 18px rgba(255,30,30,0.28))";

  // Age-based glow tiers + opacity
  function getGlowForAge(createdAt) {
    if (!createdAt) {
      // Default red glow for local poppies without a timestamp
      return {
        filter: BASE_RED_GLOW,
        opacity: 1,
        expired: false,
      };
    }
    var ageMs = Date.now() - new Date(createdAt).getTime();
    var ageHours = ageMs / 3600000;
    var ageDays = ageHours / 24;

    // Opacity: full until FADE_START_DAYS, then linear fade to 0 at FADE_END_DAYS
    var opacity = 1;
    if (ageDays >= FADE_END_DAYS) {
      return { filter: BASE_RED_GLOW, opacity: 0.3, expired: false };
    } else if (ageDays > FADE_START_DAYS) {
      opacity = 1 - (ageDays - FADE_START_DAYS) / (FADE_END_DAYS - FADE_START_DAYS) * 0.4;
    }
    var filter;
    if (ageHours < 1) {
      // Newborn: bright golden glow
      filter =
        BASE_RED_GLOW +
        " drop-shadow(0 0 10px rgba(255,220,50,0.45)) drop-shadow(0 0 18px rgba(255,180,30,0.22))";
    } else if (ageHours < 24) {
      // Young: warm orange glow
      filter =
        BASE_RED_GLOW +
        " drop-shadow(0 0 8px rgba(255,140,40,0.35)) drop-shadow(0 0 16px rgba(255,100,20,0.18))";
    } else if (ageDays < 7) {
      // 1-7 days: standard red glow
      filter = BASE_RED_GLOW;
    } else {
      // Ancient (7+ days): keep red visible with a subtle purple tint
      filter =
        BASE_RED_GLOW +
        " drop-shadow(0 0 6px rgba(180,80,255,0.22)) drop-shadow(0 0 12px rgba(140,40,220,0.12))";
    }

    return { filter: filter, opacity: opacity, expired: false };
  }

  function applyGlow(el, createdAt) {
    var glow = getGlowForAge(createdAt);
    el.style.filter = glow.filter;
    el.style.webkitFilter = glow.filter;
    el.style.opacity = glow.opacity;
    return glow.expired;
  }

  function createPoppyElement(size, label) {
    const wrapper = document.createElement("div");
    wrapper.className = "poppy";
    wrapper.style.width = size + "px";
    wrapper.style.height = "auto";
    wrapper.style.transform = "translate3d(0,0,0)";
    wrapper.style.pointerEvents = "none";

    const img = document.createElement("img");
    // Cache-busting query param to ensure the animation plays each time
    img.src = IMAGE_SRC + "?t=" + Date.now() + Math.random();
    img.alt = "";
    img.draggable = false;

    wrapper.appendChild(img);

    if (label) {
      const lbl = document.createElement("div");
      lbl.className = "poppy-label";
      lbl.textContent = label;
      wrapper.appendChild(lbl);
    }

    return { wrapper, img };
  }

  function formatLabelParts(isoStr) {
    try {
      var d = new Date(isoStr);
      var dateOptions = { month: "long", day: "numeric", year: "numeric" };
      var timeOptions = { hour: "2-digit", minute: "2-digit" };
      return {
        date: d.toLocaleDateString("en-US", dateOptions),
        time: d.toLocaleTimeString("en-US", timeOptions),
      };
    } catch (_) {
      return { date: isoStr, time: "" };
    }
  }

  function spawnPoppyAt(x, y, dbId, label, createdAt) {
    const size = Math.round(randomBetween(110, 240));
    const speed = randomBetween(28, 80); // px per second
    const angle = randomBetween(0, Math.PI * 2);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const rotationDeg = Math.round(randomBetween(0, 360));

    const { wrapper, img } = createPoppyElement(size, label || null);
    applyGlow(wrapper, createdAt || null);
    root.appendChild(wrapper);

    // Keep entirely on-screen initially
    const maxX = Math.max(0, viewportWidth - size);
    const maxY = Math.max(0, viewportHeight - size);
    const px = clamp(x - size / 2, 0, maxX);
    const py = clamp(y - size / 2, 0, maxY);
    wrapper.style.transform =
      "translate3d(" + px + "px," + py + "px,0) rotate(" + rotationDeg + "deg)";

    /** @type {Poppy} */
    const poppy = {
      el: wrapper,
      img: img,
      x: px,
      y: py,
      vx: vx,
      vy: vy,
      size: size,
      r: rotationDeg,
      dbId: dbId || null,
      createdAt: createdAt || null,
    };
    poppies.push(poppy);
  }

  function spawnRandom(count) {
    for (let i = 0; i < count; i++) {
      const rx = Math.random() * viewportWidth;
      const ry = Math.random() * viewportHeight;
      spawnPoppyAt(rx, ry);
    }
  }

  function clearAll() {
    for (let i = 0; i < poppies.length; i++) {
      const p = poppies[i];
      if (p && p.el && p.el.parentNode) {
        p.el.parentNode.removeChild(p.el);
      }
    }
    poppies.length = 0;
  }

  function removePoppyAt(index) {
    var p = poppies[index];
    if (!p) return;
    if (p.el && p.el.parentNode) {
      p.el.parentNode.removeChild(p.el);
    }
    poppies.splice(index, 1);
  }

  // --- Remote control: fetch poppies from Supabase ---
  const SUPABASE_URL = "https://xhmagpbrqyrvptbawjqa.supabase.co";
  const ANON_KEY = "sb_publishable_rNS7quNUnYko_0SUdrHiUw_H9UNRfDx";
  const POLL_INTERVAL_MS = 10000;
  const CREATOR_STORAGE_KEY = "poppy_creator_name";
  const AUTO_PURGE_INTERVAL_MS = 60 * 60 * 1000; // auto-purge DB once per hour
  let lastAutoPurgeAt = 0;

  function getStatusBox() {
    return document.getElementById("fetch-result");
  }

  async function fetchPoppies() {
    const box = getStatusBox();
    try {
      const res = await fetch(SUPABASE_URL + "/rest/v1/poppies", {
        cache: "no-store",
        headers: {
          apikey: ANON_KEY,
          Authorization: "Bearer " + ANON_KEY,
        },
      });
      if (!res.ok) {
        if (box) {
          box.classList.add("error");
          box.textContent = "Fetch error: " + res.status + " " + res.statusText;
        }
        return null;
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        if (box) {
          box.classList.remove("error");
          box.textContent = data.length + " poppies in db";
        }
        return data;
      }
      return null;
    } catch (err) {
      if (box) {
        box.classList.add("error");
        box.textContent = "Fetch failed: " + err;
      }
      return null;
    }
  }

  function getOrAskCreatorName() {
    var saved = (localStorage.getItem(CREATOR_STORAGE_KEY) || "").trim();
    if (saved) return saved;
    var entered = window.prompt("What is your name?");
    var name = (entered || "").trim();
    if (!name) return null;
    localStorage.setItem(CREATOR_STORAGE_KEY, name);
    return name;
  }

  async function addPoppyToDb() {
    var box = getStatusBox();
    var name = getOrAskCreatorName();
    if (!name) {
      if (box) {
        box.classList.add("error");
        box.textContent = "Add cancelled: name is required.";
      }
      return false;
    }
    try {
      var res = await fetch(SUPABASE_URL + "/rest/v1/poppies", {
        method: "POST",
        headers: {
          apikey: ANON_KEY,
          Authorization: "Bearer " + ANON_KEY,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ created_by: name }),
      });
      if (!res.ok) {
        var text = await res.text();
        throw new Error(res.status + " " + (text || res.statusText));
      }
      if (box) {
        box.classList.remove("error");
        box.textContent = "Poppy added!";
      }
      return true;
    } catch (err) {
      if (box) {
        box.classList.add("error");
        box.textContent = "Add failed: " + err;
      }
      return false;
    }
  }

  async function deletePoppyById(id) {
    if (!Number.isFinite(id)) return false;
    const box = getStatusBox();
    try {
      const res = await fetch(
        SUPABASE_URL + "/rest/v1/poppies?id=eq." + encodeURIComponent(String(id)),
        {
          method: "DELETE",
          headers: {
            apikey: ANON_KEY,
            Authorization: "Bearer " + ANON_KEY,
            Prefer: "return=representation",
          },
        }
      );
      if (!res.ok) {
        if (box) {
          box.classList.add("error");
          box.textContent = "Delete failed: " + res.status + " " + res.statusText;
        }
        return false;
      }
      const data = await res.json();
      if (box) {
        box.classList.remove("error");
        box.textContent = "Deleted " + data.length + " poppy from db";
      }
      return data.length > 0;
    } catch (err) {
      if (box) {
        box.classList.add("error");
        box.textContent = "Delete failed: " + err;
      }
      return false;
    }
  }

  async function deleteOldPoppiesFromDb(maxAgeDays, silent) {
    const box = getStatusBox();
    const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
    const cutoffIso = cutoff.toISOString();
    try {
      const res = await fetch(
        SUPABASE_URL +
          "/rest/v1/poppies?created_at=lt." +
          encodeURIComponent(cutoffIso),
        {
          method: "DELETE",
          headers: {
            apikey: ANON_KEY,
            Authorization: "Bearer " + ANON_KEY,
            Prefer: "return=representation",
          },
        }
      );
      if (!res.ok) {
        if (box && !silent) {
          box.classList.add("error");
          box.textContent =
            "Purge failed: " + res.status + " " + res.statusText;
        }
        return 0;
      }
      const data = await res.json();
      if (box && !silent) {
        box.classList.remove("error");
        box.textContent = "Purged " + data.length + " old poppies from db";
      }
      return data.length;
    } catch (err) {
      if (box && !silent) {
        box.classList.add("error");
        box.textContent = "Purge failed: " + err;
      }
      return 0;
    }
  }

  function reconcilePoppies(records) {
    if (!records) return;
    // Build a set of IDs we already have
    var existingIds = {};
    for (var i = 0; i < poppies.length; i++) {
      if (poppies[i].dbId != null) existingIds[poppies[i].dbId] = true;
    }
    // Build a set of IDs from the server
    var serverIds = {};
    for (var j = 0; j < records.length; j++) {
      serverIds[records[j].id] = true;
    }
    // Sort by creation time so oldest appear first
    records.sort(function (a, b) {
      return new Date(a.created_at) - new Date(b.created_at);
    });
    // Spawn poppies for new records
    var stagger = isInitialFetch;
    if (isInitialFetch) isInitialFetch = false;
    for (var k = 0; k < records.length; k++) {
      var rec = records[k];
      if (!existingIds[rec.id]) {
        (function (r) {
          var spawn = function () {
            var parts = formatLabelParts(r.created_at);
            var label = r.created_by + "\n" + parts.date + "\n" + parts.time;
            var rx = Math.random() * viewportWidth;
            var ry = Math.random() * viewportHeight;
            spawnPoppyAt(rx, ry, r.id, label, r.created_at);
          };
          if (stagger) {
            setTimeout(spawn, Math.max(0, k + (Math.random() - 0.5)) * 1000);
          } else {
            spawn();
          }
        })(rec);
      }
    }
    // Remove poppies whose IDs are no longer on the server
    for (var m = poppies.length - 1; m >= 0; m--) {
      var p = poppies[m];
      if (p.dbId != null && !serverIds[p.dbId]) {
        removePoppyAt(m);
      }
    }
  }

  function startRemotePolling() {
    if (remotePollTimer) clearInterval(remotePollTimer);
    var tick = async function () {
      if (Date.now() - lastAutoPurgeAt > AUTO_PURGE_INTERVAL_MS) {
        await deleteOldPoppiesFromDb(FADE_END_DAYS, true);
        lastAutoPurgeAt = Date.now();
      }
      var records = await fetchPoppies();
      reconcilePoppies(records);
    };
    tick();
    remotePollTimer = setInterval(tick, POLL_INTERVAL_MS);
  }

  function toggleHelp() {
    if (!help) return;
    help.classList.toggle("hidden");
  }

  let lastGlowUpdate = 0;
  var GLOW_UPDATE_INTERVAL = 60000; // refresh glow tiers every 60 seconds

  function animate(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000); // clamp large frames to avoid tunneling
    lastTime = now;

    // Periodically refresh glow colors as poppies age
    if (now - lastGlowUpdate > GLOW_UPDATE_INTERVAL) {
      lastGlowUpdate = now;
      for (let g = poppies.length - 1; g >= 0; g--) {
        applyGlow(poppies[g].el, poppies[g].createdAt);
      }
    }

    const maxX = viewportWidth;
    const maxY = viewportHeight;

    for (let i = 0; i < poppies.length; i++) {
      const p = poppies[i];
      const size = p.size;

      let nx = p.x + p.vx * dt;
      let ny = p.y + p.vy * dt;

      if (nx <= 0) {
        nx = 0;
        p.vx = Math.abs(p.vx);
      } else if (nx + size >= maxX) {
        nx = maxX - size;
        p.vx = -Math.abs(p.vx);
      }

      if (ny <= 0) {
        ny = 0;
        p.vy = Math.abs(p.vy);
      } else if (ny + size >= maxY) {
        ny = maxY - size;
        p.vy = -Math.abs(p.vy);
      }

      p.x = nx;
      p.y = ny;
      p.el.style.transform =
        "translate3d(" + nx + "px," + ny + "px,0) rotate(" + p.r + "deg)";
    }

    rafId = requestAnimationFrame(animate);
  }

  function start() {
    if (rafId == null) {
      lastTime = performance.now();
      rafId = requestAnimationFrame(animate);
    }
  }

  function stop() {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  // Event bindings
  window.addEventListener("resize", function () {
    viewportWidth = window.innerWidth;
    viewportHeight = window.innerHeight;
  });

  // Click / tap spawning disabled per request
  // root.addEventListener('pointerdown', function (e) {
  //   const event = e;
  //   const count = event.shiftKey ? 5 : 1;
  //   for (let i = 0; i < count; i++) {
  //     const jx = (Math.random() - 0.5) * 30;
  //     const jy = (Math.random() - 0.5) * 30;
  //     spawnPoppyAt(event.clientX + jx, event.clientY + jy);
  //   }
  // });

  // Keyboard controls
  window.addEventListener("keydown", function (e) {
    if (e.code === "Space") {
      e.preventDefault();
      spawnRandom(1);
      return;
    }
    const key = (e.key || "").toLowerCase();
    if (key === "c") {
      clearAll();
    } else if (key === "h") {
      toggleHelp();
    }
  });

  var addBtn = document.getElementById("add-poppy-btn");
  if (addBtn) {
    addBtn.addEventListener("click", async function () {
      addBtn.disabled = true;
      var ok = await addPoppyToDb();
      if (ok) {
        var records = await fetchPoppies();
        reconcilePoppies(records);
      }
      addBtn.disabled = false;
    });
  }

  // Pause animation while tab not visible (saves energy)
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      stop();
      if (remotePollTimer) {
        clearInterval(remotePollTimer);
        remotePollTimer = null;
      }
    } else {
      start();
      startRemotePolling();
    }
  });

  // Start the animation loop — poppies are populated from Supabase
  start();
  startRemotePolling();

  // Expose a tiny control surface for manual tweaking
  window.Poppy = {
    spawn: function (n) {
      spawnRandom(Math.max(1, n | 0));
    },
    clear: clearAll,
    count: function () {
      return poppies.length;
    },
    deleteFromDb: async function (id) {
      var deleted = await deletePoppyById(Number(id));
      var records = await fetchPoppies();
      reconcilePoppies(records);
      return deleted;
    },
    purgeOldFromDb: async function (days) {
      var maxAgeDays = Number(days);
      if (!Number.isFinite(maxAgeDays) || maxAgeDays <= 0) {
        maxAgeDays = FADE_END_DAYS;
      }
      var removed = await deleteOldPoppiesFromDb(maxAgeDays, false);
      var records = await fetchPoppies();
      reconcilePoppies(records);
      return removed;
    },
    setCreatorName: function (name) {
      var n = String(name || "").trim();
      if (!n) return false;
      localStorage.setItem(CREATOR_STORAGE_KEY, n);
      return true;
    },
  };
})();
