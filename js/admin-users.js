/* Admin users page: lists every account (from the admin-only database function admin_list_users)
   and lets the admin delete customer accounts (admin_delete_user). The database checks the admin
   role itself; the redirect below only avoids showing an empty page to other people. */
(function () {
  const root = document.getElementById("users-root");
  const state = { users: [], pendingDelete: null, error: "" };

  function build() {
    root.innerHTML = `
      <div class="admin-wrap">
        <div class="admin-head">
          <div>
            <h1 class="font-display">Admin — Users</h1>
            <p class="checkout-sub" id="counts"></p>
          </div>
          <div class="admin-actions">
            <a class="link-btn" href="admin.html">&larr; Manage products</a>
          </div>
        </div>
        <p class="form-error" id="users-error" role="alert"></p>
        <div class="table-wrap"><table class="admin-table users-table" id="table"></table></div>
        <p class="form-hint">Deleting a customer removes their login and saved cart and frees up a sign-up spot. Admin accounts can't be deleted here. Emails are only visible to admins.</p>
      </div>`;
    document.getElementById("table").addEventListener("click", onTableClick);
  }

  function render() {
    const customers = state.users.filter((u) => u.role === "customer").length;
    const admins = state.users.length - customers;
    document.getElementById("counts").textContent =
      `${state.users.length} user${state.users.length === 1 ? "" : "s"} · ${customers} customer${customers === 1 ? "" : "s"}, ${admins} admin${admins === 1 ? "" : "s"}`;
    document.getElementById("users-error").textContent = state.error;

    const me = Auth.currentUser();
    const rows = state.users
      .map((u, i) => {
        const confirming = state.pendingDelete === u.user_id;
        const canDelete = u.role !== "admin" && (!me || u.user_id !== me.id);
        const joined = u.created_at ? new Date(u.created_at).toLocaleDateString() : "";
        return `<tr>
          <td class="num-col">${i + 1}</td>
          <td><strong>${esc(u.display_name)}</strong>${me && u.user_id === me.id ? ` <span class="badge">you</span>` : ""}</td>
          <td data-label="Email">${esc(u.email)}</td>
          <td data-label="Role">${esc(u.role)}</td>
          <td data-label="Joined">${esc(joined)}</td>
          <td class="row-actions">
            ${
              !canDelete
                ? ""
                : confirming
                ? `<span class="empty-confirm">Sure? <button type="button" class="empty-yes" data-del-yes="${esc(u.user_id)}">Delete</button><button type="button" class="empty-no" data-del-no>Cancel</button></span>`
                : `<button type="button" class="link-btn danger" data-del="${esc(u.user_id)}">Delete</button>`
            }
          </td>
        </tr>`;
      })
      .join("");
    document.getElementById("table").innerHTML =
      `<thead><tr><th>#</th><th>Display name</th><th>Email</th><th>Role</th><th>Joined</th><th></th></tr></thead><tbody>${rows}</tbody>`;
  }

  async function loadUsers() {
    const { data, error } = await db.rpc("admin_list_users");
    if (error) {
      console.error(error);
      state.error = /admin_list_users/.test(error.message || "")
        ? "The admin user functions are missing. Run supabase/002-admin-users.sql in the Supabase SQL Editor."
        : error.message || "Could not load users.";
      return;
    }
    state.users = data;
    state.error = "";
  }

  async function onTableClick(e) {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.hasAttribute("data-del")) {
      state.pendingDelete = t.getAttribute("data-del");
      return render();
    }
    if (t.hasAttribute("data-del-no")) {
      state.pendingDelete = null;
      return render();
    }
    if (t.hasAttribute("data-del-yes")) {
      const id = t.getAttribute("data-del-yes");
      const target = state.users.find((u) => u.user_id === id);
      state.pendingDelete = null;
      t.disabled = true;
      const { error } = await db.rpc("admin_delete_user", { target: id });
      if (error) {
        console.error(error);
        showToast(error.message || "Couldn't delete that user.");
      } else {
        showToast(`Deleted "${target ? target.display_name : "user"}"`);
      }
      await loadUsers();
      render();
    }
  }

  whenReady(async () => {
    if (!Auth.isAdmin()) {
      location.replace("login.html?next=admin-users.html");
      return;
    }
    build();
    await loadUsers();
    render();
  });
})();
