/* Admin page. Only the `admin` role can change products: the database (Row Level Security in
   supabase/schema.sql) enforces that. The redirect below only keeps other people from seeing an empty page. */
(function () {
  const root = document.getElementById("admin-root");
  const BUCKET = "product-images";
  const state = { pendingDelete: null, pendingImage: null, saving: false };

  const customCount = () => products.filter((p) => p.custom).length;

  function build() {
    root.innerHTML = `
      <div class="admin-wrap">
        <div class="admin-head">
          <div>
            <h1 class="font-display">Admin — Products</h1>
            <p class="checkout-sub" id="counts"></p>
          </div>
          <div class="admin-actions">
            <button class="btn btn-primary" id="add-product" type="button">+ Add product</button>
            <a class="link-btn" href="admin-users.html">Manage users &rarr;</a>
          </div>
        </div>
        <div id="editor"></div>
        <div class="table-wrap"><table class="admin-table" id="table"></table></div>
        <p class="form-hint">Changes are saved to the shared database and show up for every visitor. Photos are cropped square and shrunk to 800px.</p>
      </div>`;

    document.getElementById("add-product").addEventListener("click", () => openEditor(null));
    document.getElementById("table").addEventListener("click", onTableClick);
    refresh();
  }

  function renderCounts() {
    const used = customCount();
    document.getElementById("counts").textContent =
      `${products.length} products · new products added: ${used} of ${MAX_CUSTOM_PRODUCTS}`;
    const btn = document.getElementById("add-product");
    btn.disabled = used >= MAX_CUSTOM_PRODUCTS;
    btn.title = btn.disabled ? `Limit reached (${MAX_CUSTOM_PRODUCTS} new products). Delete one to add another.` : "";
  }

  function renderTable() {
    const rows = products
      .map((p, i) => {
        const confirming = state.pendingDelete === p.id;
        return `<tr>
          <td class="num-col">${i + 1}</td>
          <td class="thumb-col"><img class="admin-thumb" src="${esc(p.thumb)}" alt="" /></td>
          <td><strong>${esc(p.name)}</strong>${p.custom ? ` <span class="badge">new</span>` : ""}<br /><small>${esc(p.material)} · ${esc(p.printTimeHours)}h</small></td>
          <td data-label="Category">${esc(p.category)}</td>
          <td data-label="Price">$${Number(p.price).toFixed(2)}</td>
          <td class="row-actions">
            <button type="button" class="link-btn" data-edit="${esc(p.id)}">Edit</button>
            ${
              confirming
                ? `<span class="empty-confirm">Sure? <button type="button" class="empty-yes" data-del-yes="${esc(p.id)}">Delete</button><button type="button" class="empty-no" data-del-no>Cancel</button></span>`
                : `<button type="button" class="link-btn danger" data-del="${esc(p.id)}" ${products.length <= 1 ? "disabled" : ""}>Delete</button>`
            }
          </td>
        </tr>`;
      })
      .join("");
    document.getElementById("table").innerHTML =
      `<thead><tr><th>#</th><th></th><th>Product</th><th>Category</th><th>Price</th><th></th></tr></thead><tbody>${rows}</tbody>`;
  }

  function refresh() {
    renderCounts();
    renderTable();
  }

  async function reloadAndRefresh() {
    await loadProducts();
    refresh();
  }

  function slugify(name, list) {
    const base =
      name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "product";
    let slug = base;
    let n = 2;
    while (list.some((p) => p.slug === slug)) slug = `${base}-${n++}`;
    return slug;
  }

  /* ---------- Photos: crop square, make an 800px photo + 160px thumb as JPEG blobs ---------- */
  function processImage(file) {
    return new Promise((resolve, reject) => {
      if (!/^image\//.test(file.type)) return reject(new Error("Please choose an image file."));
      if (file.size > 10 * 1024 * 1024) return reject(new Error("That image is over 10 MB."));
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const make = (size, quality) =>
          new Promise((res) => {
            const s = Math.min(size, side);
            const c = document.createElement("canvas");
            c.width = c.height = s;
            c.getContext("2d").drawImage(img, sx, sy, side, side, 0, 0, s, s);
            c.toBlob((b) => res(b), "image/jpeg", quality);
          });
        Promise.all([make(800, 0.8), make(160, 0.7)]).then(([image, thumb]) => {
          URL.revokeObjectURL(url);
          if (!image || !thumb) return reject(new Error("Could not process that image."));
          resolve({ image, thumb, preview: URL.createObjectURL(image) });
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read that image."));
      };
      img.src = url;
    });
  }

  function storagePathFromUrl(url) {
    const m = String(url).match(/\/product-images\/(.+)$/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  async function removeStored(urls) {
    const paths = urls.map(storagePathFromUrl).filter(Boolean);
    if (paths.length) await db.storage.from(BUCKET).remove(paths);
  }

  async function uploadImages(slug, blobs) {
    const bucket = db.storage.from(BUCKET);
    const stamp = Date.now();
    const imgPath = `${slug}-${stamp}.jpg`;
    const thumbPath = `${slug}-${stamp}-thumb.jpg`;
    const opts = { contentType: "image/jpeg", cacheControl: "31536000" };
    let r = await bucket.upload(imgPath, blobs.image, opts);
    if (r.error) throw r.error;
    r = await bucket.upload(thumbPath, blobs.thumb, opts);
    if (r.error) {
      await bucket.remove([imgPath]);
      throw r.error;
    }
    return {
      image: bucket.getPublicUrl(imgPath).data.publicUrl,
      thumb: bucket.getPublicUrl(thumbPath).data.publicUrl,
    };
  }

  function closeEditor() {
    document.getElementById("editor").innerHTML = "";
    if (state.pendingImage) URL.revokeObjectURL(state.pendingImage.preview);
    state.pendingImage = null;
  }

  function openEditor(id) {
    const isNew = id === null;
    const p = isNew
      ? { name: "", price: "", category: CATEGORIES[0], color: "#4ecdc4", blurb: "", description: "", material: "PLA", printTimeHours: 2, image: "" }
      : products.find((x) => x.id === id);
    if (!p) return;
    if (state.pendingImage) URL.revokeObjectURL(state.pendingImage.preview);
    state.pendingImage = null;
    const color = /^#[0-9a-fA-F]{6}$/.test(p.color) ? p.color : "#4ecdc4";

    const editor = document.getElementById("editor");
    editor.innerHTML = `
      <form class="panel editor" id="editor-form" novalidate>
        <h2>${isNew ? "Add product" : "Edit product"}</h2>
        <div class="form-grid">
          <label class="field span-2">Name<input class="input" name="name" maxlength="60" value="${esc(p.name)}" required /></label>
          <label class="field">Price ($)<input class="input" name="price" type="number" min="0" max="10000" step="0.01" value="${esc(p.price)}" required /></label>
          <label class="field">Category<select class="input" name="category">${CATEGORIES.map((c) => `<option ${c === p.category ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
          <label class="field">Accent color<input class="input color-input" name="color" type="color" value="${color}" /></label>
          <label class="field">Material<input class="input" name="material" maxlength="40" value="${esc(p.material)}" /></label>
          <label class="field">Print time (hours)<input class="input" name="printTimeHours" type="number" min="0" max="500" step="0.5" value="${esc(p.printTimeHours)}" /></label>
          <label class="field span-2">Short blurb<input class="input" name="blurb" maxlength="100" value="${esc(p.blurb)}" /></label>
          <label class="field span-2">Description<textarea class="input" name="description" rows="4" maxlength="500">${esc(p.description)}</textarea></label>
          <div class="field span-2">
            Photo ${isNew ? "(required)" : "(leave empty to keep the current one)"}
            <input type="file" id="photo-input" accept="image/*" />
            <div class="photo-preview">${p.image ? `<img id="photo-preview" src="${esc(p.image)}" alt="Preview" />` : `<img id="photo-preview" alt="Preview" hidden />`}</div>
          </div>
        </div>
        <p class="form-error" id="editor-error" role="alert"></p>
        <div class="editor-actions">
          <button class="btn btn-primary" id="save-btn" type="submit">Save</button>
          <button class="btn btn-ghost" type="button" id="cancel-edit">Cancel</button>
        </div>
      </form>`;
    editor.scrollIntoView({ behavior: "smooth", block: "start" });

    const errEl = document.getElementById("editor-error");
    document.getElementById("cancel-edit").addEventListener("click", closeEditor);

    document.getElementById("photo-input").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      errEl.textContent = "";
      if (!file) return;
      try {
        const out = await processImage(file);
        if (state.pendingImage) URL.revokeObjectURL(state.pendingImage.preview);
        state.pendingImage = out;
        const prev = document.getElementById("photo-preview");
        prev.src = out.preview;
        prev.hidden = false;
      } catch (err) {
        state.pendingImage = null;
        errEl.textContent = err.message;
        e.target.value = "";
      }
    });

    document.getElementById("editor-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (state.saving) return;
      const f = e.target.elements;
      const name = f.name.value.trim();
      const price = parseFloat(f.price.value);
      const hours = parseFloat(f.printTimeHours.value);
      if (!name) return (errEl.textContent = "Please enter a name.");
      if (!(price >= 0 && price <= 10000)) return (errEl.textContent = "Price must be between 0 and 10000.");
      if (!(hours >= 0 && hours <= 500)) return (errEl.textContent = "Print time must be between 0 and 500 hours.");
      if (!/^#[0-9a-fA-F]{6}$/.test(f.color.value)) return (errEl.textContent = "Pick a valid color.");
      if (isNew && !state.pendingImage) return (errEl.textContent = "Please upload a photo.");
      if (isNew && customCount() >= MAX_CUSTOM_PRODUCTS)
        return (errEl.textContent = `You can only add ${MAX_CUSTOM_PRODUCTS} new products. Delete one first.`);

      const row = {
        name,
        price: Math.round(price * 100) / 100,
        category: CATEGORIES.includes(f.category.value) ? f.category.value : CATEGORIES[0],
        color: f.color.value,
        material: f.material.value.trim() || "PLA",
        print_time_hours: hours,
        blurb: f.blurb.value.trim(),
        description: f.description.value.trim(),
      };

      const saveBtn = document.getElementById("save-btn");
      state.saving = true;
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving…";
      errEl.textContent = "";
      let uploaded = null;
      try {
        const slug = isNew ? slugify(name, products) : p.slug;
        if (state.pendingImage) uploaded = await uploadImages(slug, state.pendingImage);
        if (isNew) {
          const { error } = await db.from("products").insert({ ...row, slug, custom: true, image: uploaded.image, thumb: uploaded.thumb });
          if (error) throw error;
        } else {
          const change = uploaded ? { ...row, image: uploaded.image, thumb: uploaded.thumb } : row;
          const { data, error } = await db.from("products").update(change).eq("id", Number(id)).select("id");
          if (error) throw error;
          if (!data || !data.length) throw new Error("Nothing was saved. Are you logged in as the admin?");
          if (uploaded) await removeStored([p.image, p.thumb]);
        }
      } catch (err) {
        if (uploaded) await removeStored([uploaded.image, uploaded.thumb]).catch(() => {});
        errEl.textContent = err.message || "Could not save. Please try again.";
        state.saving = false;
        saveBtn.disabled = false;
        saveBtn.textContent = "Save";
        return;
      }
      state.saving = false;
      closeEditor();
      await reloadAndRefresh();
      showToast(isNew ? `Added "${name}"` : `Saved "${name}"`);
    });
  }

  async function onTableClick(e) {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.hasAttribute("data-edit")) return openEditor(t.getAttribute("data-edit"));
    if (t.hasAttribute("data-del")) {
      state.pendingDelete = t.getAttribute("data-del");
      return renderTable();
    }
    if (t.hasAttribute("data-del-no")) {
      state.pendingDelete = null;
      return renderTable();
    }
    if (t.hasAttribute("data-del-yes")) {
      const id = t.getAttribute("data-del-yes");
      const removed = products.find((p) => p.id === id);
      state.pendingDelete = null;
      if (removed && products.length > 1) {
        t.disabled = true;
        const { data, error } = await db.from("products").delete().eq("id", Number(id)).select("id");
        if (error || !data || !data.length) {
          showToast("Couldn't delete that product.");
        } else {
          if (removed.custom) await removeStored([removed.image, removed.thumb]).catch(() => {});
          showToast(`Deleted "${removed.name}"`);
        }
        await loadProducts();
      }
      refresh();
    }
  }

  whenReady(async () => {
    if (!Auth.isAdmin()) {
      location.replace("login.html?next=admin.html");
      return;
    }
    await loadSettings();
    build();
    if (productsError) document.getElementById("table").insertAdjacentHTML("beforebegin", productsErrorHTML());
  });
})();
