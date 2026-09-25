(function () {
  const root = document.getElementById("login-root");
  const params = new URLSearchParams(location.search);
  let mode = params.get("mode") === "signup" ? "signup" : "login";
  const nextRaw = params.get("next") || "";
  const next = /^[a-z0-9_-]+\.html(\?\S*)?$/i.test(nextRaw) ? nextRaw : "index.html";

  async function render() {
    const user = Auth.currentUser();
    if (user) {
      root.innerHTML = `
        <div class="auth-wrap">
          <div class="panel auth-card">
            <h1>You're logged in</h1>
            <p class="checkout-sub">Signed in as <strong>${esc(user.displayName)}</strong>${user.role === "admin" ? " (admin)" : ""}.</p>
            <div class="auth-actions">
              <a class="btn btn-primary btn-lg" href="${user.role === "admin" ? "admin.html" : "shop.html"}">${user.role === "admin" ? "Open admin panel" : "Go shopping"}</a>
              <button class="btn btn-ghost btn-lg" id="logout">Log out</button>
            </div>
          </div>
        </div>`;
      document.getElementById("logout").addEventListener("click", async () => {
        await Auth.logout();
        location.href = "login.html";
      });
      return;
    }

    const signup = mode === "signup";
    const spots = signup ? await Auth.spotsLeft() : null;
    root.innerHTML = `
      <div class="auth-wrap">
        <div class="panel auth-card">
          <div class="auth-tabs">
            <button type="button" data-mode="login" class="${signup ? "" : "active"}">Log in</button>
            <button type="button" data-mode="signup" class="${signup ? "active" : ""}">Sign up</button>
          </div>
          <form id="auth-form" novalidate>
            ${signup ? `<label class="field">Display name
              <input class="input" name="displayName" autocomplete="nickname" maxlength="20" required />
            </label>` : ""}
            <label class="field">Email
              <input class="input" name="email" type="email" autocomplete="email" maxlength="120" required />
            </label>
            <label class="field">Password
              <input class="input" name="password" type="password" autocomplete="${signup ? "new-password" : "current-password"}" maxlength="64" required />
            </label>
            ${signup ? `<label class="field">Confirm password
              <input class="input" name="confirm" type="password" autocomplete="new-password" maxlength="64" required />
            </label>` : ""}
            <p class="form-error" id="form-error" role="alert"></p>
            <button class="btn btn-primary btn-lg auth-submit" type="submit">${signup ? "Create account" : "Log in"}</button>
          </form>
          <p class="form-hint">${
            signup && spots !== null ? `${spots} sign-up spot${spots === 1 ? "" : "s"} left. ` : ""
          }Practice store: no real orders or payments. Your email is only used to log in.</p>
        </div>
      </div>`;

    root.querySelectorAll("[data-mode]").forEach((b) =>
      b.addEventListener("click", () => {
        mode = b.getAttribute("data-mode");
        render();
      })
    );

    document.getElementById("auth-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      const err = document.getElementById("form-error");
      const submit = f.querySelector(".auth-submit");
      err.textContent = "";
      if (signup && f.password.value !== f.confirm.value) {
        err.textContent = "Passwords don't match.";
        return;
      }
      submit.disabled = true;
      const result = signup
        ? await Auth.signup(f.displayName.value, f.email.value, f.password.value)
        : await Auth.login(f.email.value, f.password.value);
      if (!result.ok) {
        err.textContent = result.error;
        submit.disabled = false;
        return;
      }
      location.href = result.user.role === "admin" && next === "index.html" ? "admin.html" : next;
    });
  }

  whenReady(render);
})();
