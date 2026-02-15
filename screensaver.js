(function () {
  "use strict";

  const root = document.getElementById("root");
  const help = document.getElementById("help");
  if (!root) return;

  const IMAGE_SRC = "images/coolguy_nobg.webp";

  /** @typedef {{ el: HTMLDivElement, img: HTMLImageElement, x: number, y: number, vx: number, vy: number, size: number, r: number, dbId: number|null }} Poppy */
  /** @type {Poppy[]} */
  const poppies = [];

  let viewportWidth = window.innerWidth;
  let viewportHeight = window.innerHeight;
  let lastTime = performance.now();
  let rafId = null;
  let remotePollTimer = null;

  function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function createPoppyElement(size, label) {
    const wrapper = document.createElement("div");
    wrapper.className = "poppy";
    wrapper.style.width = size + "px";
    wrapper.style.height = "auto";
    wrapper.style.transform = "translate3d(0,0,0)";
    wrapper.style.pointerEvents = "none";

    const img = document.createElement("img");
    img.src = IMAGE_SRC;
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

  function formatTime(isoStr) {
    try {
      var d = new Date(isoStr);
      return d.toLocaleString();
    } catch (_) {
      return isoStr;
    }
  }

  function spawnPoppyAt(x, y, dbId, label) {
    const size = Math.round(randomBetween(110, 240));
    const speed = randomBetween(28, 80); // px per second
    const angle = randomBetween(0, Math.PI * 2);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const rotationDeg = Math.round(randomBetween(0, 360));

    const { wrapper, img } = createPoppyElement(size, label || null);
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

  // --- Remote control: fetch poppies from Supabase ---
  const SUPABASE_URL = "https://xhmagpbrqyrvptbawjqa.supabase.co";
  const ANON_KEY = "sb_publishable_rNS7quNUnYko_0SUdrHiUw_H9UNRfDx";
  const POLL_INTERVAL_MS = 10000;

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
    // Spawn poppies for new records
    for (var k = 0; k < records.length; k++) {
      var rec = records[k];
      if (!existingIds[rec.id]) {
        var label = rec.created_by + "\n" + formatTime(rec.created_at);
        var rx = Math.random() * viewportWidth;
        var ry = Math.random() * viewportHeight;
        spawnPoppyAt(rx, ry, rec.id, label);
      }
    }
    // Remove poppies whose IDs are no longer on the server
    for (var m = poppies.length - 1; m >= 0; m--) {
      var p = poppies[m];
      if (p.dbId != null && !serverIds[p.dbId]) {
        if (p.el && p.el.parentNode) p.el.parentNode.removeChild(p.el);
        poppies.splice(m, 1);
      }
    }
  }

  function startRemotePolling() {
    if (remotePollTimer) clearInterval(remotePollTimer);
    var tick = async function () {
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

  function animate(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000); // clamp large frames to avoid tunneling
    lastTime = now;

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
  };
})();
