(function () {
  "use strict";

  const root = document.getElementById("root");
  const help = document.getElementById("help");
  if (!root) return;

  const IMAGE_SRC = "images/coolguy_nobg.webp";

  /** @typedef {{ el: HTMLDivElement, img: HTMLImageElement, x: number, y: number, vx: number, vy: number, size: number, r: number }} Poppy */
  /** @type {Poppy[]} */
  const poppies = [];

  let viewportWidth = window.innerWidth;
  let viewportHeight = window.innerHeight;
  let lastTime = performance.now();
  let rafId = null;
  let remotePollTimer = null;
  let addTimer = null;
  const MIN_DELAY_MS = 60 * 1000; // 1 minute
  const MAX_DELAY_MS = 10 * 60 * 1000; // 10 minutes

  function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function createPoppyElement(size) {
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
    return { wrapper, img };
  }

  function spawnPoppyAt(x, y) {
    const size = Math.round(randomBetween(110, 240));
    const speed = randomBetween(28, 80); // px per second
    const angle = randomBetween(0, Math.PI * 2);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const rotationDeg = Math.round(randomBetween(0, 360));

    const { wrapper, img } = createPoppyElement(size);
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

  // --- Remote control support ---
  // Configure via localStorage:
  // localStorage.setItem('poppy.remote.url', 'https://example.com/poppy-count.json')
  // localStorage.setItem('poppy.remote.intervalMs', '3000')
  // Endpoint should return JSON like: { "count": 12 }
  function getRemoteConfig() {
    const url = localStorage.getItem("poppy.remote.url") || "";
    const intervalMs = parseInt(
      localStorage.getItem("poppy.remote.intervalMs") || "5000",
      10,
    );
    return {
      url,
      intervalMs: isFinite(intervalMs) ? Math.max(1000, intervalMs) : 5000,
    };
  }

  async function fetchTargetCount(url) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return null;
      const data = await res.json();
      if (data && typeof data.count === "number" && isFinite(data.count)) {
        return Math.max(0, Math.floor(data.count));
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  function reconcileCount(target) {
    if (target == null) return;
    const current = poppies.length;
    if (target > current) {
      spawnRandom(target - current);
    } else if (target < current) {
      const toRemove = current - target;
      for (let i = 0; i < toRemove; i++) {
        const p = poppies.pop();
        if (p && p.el && p.el.parentNode) {
          p.el.parentNode.removeChild(p.el);
        }
      }
    }
  }

  function startRemotePolling() {
    const { url, intervalMs } = getRemoteConfig();
    if (!url) return;
    if (remotePollTimer) clearInterval(remotePollTimer);
    const tick = async function () {
      const target = await fetchTargetCount(url);
      if (typeof target === "number") reconcileCount(target);
    };
    tick();
    remotePollTimer = setInterval(tick, intervalMs);
  }

  // Sequential addition: add one poppy every 1–10 minutes (randomized)
  function scheduleNextAddition() {
    if (addTimer) clearTimeout(addTimer);
    const delayMs = Math.floor(randomBetween(MIN_DELAY_MS, MAX_DELAY_MS));
    addTimer = setTimeout(function () {
      try {
        spawnRandom(1);
      } catch (_) {}
      scheduleNextAddition();
    }, delayMs);
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
      if (addTimer) {
        clearTimeout(addTimer);
        addTimer = null;
      }
    } else {
      start();
      startRemotePolling();
      if (!addTimer) scheduleNextAddition();
    }
  });

  // Start the animation loop (no poppies shown until user action)
  start();
  // Spawn exactly one poppy initially, then add one every 1–10 minutes
  try {
    spawnRandom(1);
  } catch (e) {}
  scheduleNextAddition();
  // Start remote polling if configured
  startRemotePolling();

  // --- Fetch test: hit example.org after 5s and show result ---
  setTimeout(async function () {
    const box = document.createElement("div");
    box.id = "fetch-result";
    box.textContent = "Fetching https://httpbin.org/get …";
    document.body.appendChild(box);
    try {
      const SUPABASE_URL = "https://xhmagpbrqyrvptbawjqa.supabase.co";
      const ANON_KEY = "sb_publishable_rNS7quNUnYko_0SUdrHiUw_H9UNRfDx";
      const headers = {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        "Content-Type": "application/json",
      };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/poppies`, {
        method: "GET",
        headers,
      });

      console.log("status", res.status);

      const body = await res.json().catch(() => null);

      box.textContent =
        "✓ " +
        res.status +
        " " +
        res.statusText +
        "\n\n" +
        JSON.stringify(body);

      box.textContent =
        "✓ " +
        res.status +
        " " +
        res.statusText +
        "\n\n" +
        JSON.stringify(body).slice(0, 500);
    } catch (err) {
      box.classList.add("error");
      box.textContent = "✗ Fetch failed:\n" + err;
    }
  }, 100);

  // Expose a tiny control surface for manual tweaking
  window.Poppy = {
    spawn: function (n) {
      spawnRandom(Math.max(1, n | 0));
    },
    clear: clearAll,
    count: function () {
      return poppies.length;
    },
    setRemoteUrl: function (url, intervalMs) {
      if (typeof url === "string")
        localStorage.setItem("poppy.remote.url", url);
      if (typeof intervalMs === "number")
        localStorage.setItem("poppy.remote.intervalMs", String(intervalMs));
      startRemotePolling();
    },
  };
})();
