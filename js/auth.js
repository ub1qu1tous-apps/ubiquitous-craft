/* Accounts use Supabase Auth (email + password). The display name and role live in the
   `profiles` table. Admin rights are enforced by the database (Row Level Security); the
   client-side checks below only decide what to show. */
const Auth = (function () {
  let user = null;

  async function loadProfile(authUser) {
    const { data } = await db
      .from("profiles")
      .select("display_name, role")
      .eq("id", authUser.id)
      .maybeSingle();
    user = {
      id: authUser.id,
      email: authUser.email,
      displayName: data ? data.display_name : String(authUser.email || "user").split("@")[0],
      role: data ? data.role : "customer",
    };
  }

  const ready = (async () => {
    try {
      const { data } = await db.auth.getSession();
      if (data.session) await loadProfile(data.session.user);
    } catch (e) {
      console.error("Could not restore session", e);
    }
  })();

  function currentUser() {
    return user;
  }

  function isAdmin() {
    return !!user && user.role === "admin";
  }

  function friendly(error) {
    const msg = String((error && error.message) || error || "");
    if (/invalid login credentials/i.test(msg)) return "Wrong email or password.";
    if (/already registered|already been registered/i.test(msg)) return "An account with that email already exists.";
    if (/database error saving new user/i.test(msg))
      return "Couldn't create the account. The display name may be taken, or sign-ups are full.";
    if (/rate limit/i.test(msg)) return "Too many attempts. Please wait a bit and try again.";
    if (/failed to fetch|network/i.test(msg)) return "Can't reach the server. Check your connection.";
    return msg || "Something went wrong. Please try again.";
  }

  async function login(email, password) {
    const mail = String(email || "").trim();
    const pw = String(password || "");
    if (!mail || !pw) return { ok: false, error: "Enter your email and password." };
    try {
      const { data, error } = await db.auth.signInWithPassword({ email: mail, password: pw });
      if (error) return { ok: false, error: friendly(error) };
      await loadProfile(data.user);
      return { ok: true, user };
    } catch (e) {
      return { ok: false, error: friendly(e) };
    }
  }

  async function spotsLeft() {
    try {
      const { data, error } = await db.rpc("spots_left");
      if (error) throw error;
      return Number(data);
    } catch (e) {
      return null;
    }
  }

  async function signup(displayName, email, password) {
    const name = String(displayName || "").trim();
    const mail = String(email || "").trim();
    const pw = String(password || "");
    if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) {
      return { ok: false, error: "Display name must be 3-20 letters, numbers or underscores." };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      return { ok: false, error: "Enter a valid email address." };
    }
    if (pw.length < 6 || pw.length > 64) {
      return { ok: false, error: "Password must be 6-64 characters." };
    }
    try {
      const free = await db.rpc("display_name_available", { name });
      if (free.error) throw free.error;
      if (!free.data) return { ok: false, error: "That display name is taken." };
      const spots = await spotsLeft();
      if (spots !== null && spots <= 0) return { ok: false, error: "Sign-up limit reached." };

      const { data, error } = await db.auth.signUp({
        email: mail,
        password: pw,
        options: { data: { display_name: name } },
      });
      if (error) return { ok: false, error: friendly(error) };
      if (!data.session) {
        return {
          ok: false,
          error: "Almost there: email confirmation is switched on for this project, so check your inbox to confirm.",
        };
      }
      await loadProfile(data.session.user);
      return { ok: true, user };
    } catch (e) {
      return { ok: false, error: friendly(e) };
    }
  }

  async function logout() {
    try {
      await db.auth.signOut();
    } catch (e) {
      console.error(e);
    }
    user = null;
  }

  /* ---------- Navbar account menu ---------- */
  function ensureAccountBox() {
    const cartBtn = document.getElementById("cart-btn");
    if (!cartBtn) return null;
    let acct = document.getElementById("account");
    if (acct) return acct;
    const right = document.createElement("div");
    right.className = "nav-right";
    cartBtn.parentNode.insertBefore(right, cartBtn);
    acct = document.createElement("div");
    acct.id = "account";
    acct.className = "account";
    right.appendChild(acct);
    right.appendChild(cartBtn);
    return acct;
  }

  function renderAccount() {
    const acct = ensureAccountBox();
    if (!acct) return;
    if (!user) {
      acct.innerHTML = `<a class="acct-pill" href="login.html">Log in</a><a class="acct-link" href="login.html?mode=signup">Sign up</a>`;
      return;
    }
    const safe = esc(user.displayName);
    acct.innerHTML = `
      <button class="acct-btn" type="button" aria-haspopup="true" aria-expanded="false">
        <span class="acct-avatar">${safe.charAt(0).toUpperCase()}</span><span class="acct-name">${safe}</span><span aria-hidden="true">▾</span>
      </button>
      <div class="acct-menu" hidden>
        ${user.role === "admin" ? `<a href="admin.html">Admin panel</a><a href="admin-users.html">Users</a>` : ""}
        <button type="button" id="logout-btn">Log out</button>
      </div>`;
    const btn = acct.querySelector(".acct-btn");
    const menu = acct.querySelector(".acct-menu");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
      btn.setAttribute("aria-expanded", String(!menu.hidden));
    });
    document.addEventListener("click", () => {
      menu.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    });
    document.getElementById("logout-btn").addEventListener("click", async () => {
      await logout();
      location.href = /admin\.html$/i.test(location.pathname) ? "index.html" : location.href;
    });
  }

  // Reserve the account spot in the navbar right away (no layout jump), fill it once the session is known.
  domReady.then(ensureAccountBox);
  Promise.all([ready, domReady]).then(renderAccount);

  return { ready, login, signup, logout, currentUser, isAdmin, spotsLeft };
})();
