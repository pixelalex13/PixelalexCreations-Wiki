(function () {
    const CATEGORY_LABELS = {
        mods: "Mods",
        resource_packs: "Resource Packs",
        data_packs: "Data Packs",
        shaders: "Shaders",
        modpacks: "Modpacks",
        plugins: "Plugins",
        worlds: "Worlds",
        servers: "Servers"
    };
    const MAIN_SITE = "https://www.pixelalexcreations.net";
    const CONTENT = "../../content/";
    const DB_NAME = "pixelalex-wiki-creator";
    const DB_STORE = "drafts";
    const DRAFT_KEY = "current";
    const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg)$/i;
    const FENCE = /^\s*(`{3,}|~{3,})/;
    const CONTAINER_OPEN = /^\s*:::\s*([a-zA-Z][\w-]*\+?)/;
    const CONTAINER_CLOSE = /^\s*:::\s*$/;
    const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;
    const TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;
    const IMAGE_SOURCE = "!\\[([^\\]]*)\\]\\(([^)\\s]+)(?:\\s+\"(.*?)\")?\\)(?:\\{([^}]*)\\})?";
    const ICON_SOURCE = ":icon\\[([^\\]]+)\\](?:\\{([^}]*)\\})?";
    const LOADER_SOURCE = ":loader\\[([^\\]]+)\\]";
    const LIST_LINE = /^(\s*)(?:(?:[-*+]|\d+[.)])\s+)?(?:\[[ xX]\]\s+)?(.*)$/;

    const $ = id => document.getElementById(id);
    const esc = WikiMarkdown.escape;

    const el = {
        id: $("projId"),
        name: $("projName"),
        category: $("projCategory"),
        description: $("projDescription"),
        mainSite: $("projMainSite"),
        updated: $("projUpdated"),
        updatedToday: $("projUpdatedToday"),
        iconPreview: $("projIconPreview"),
        iconUpload: $("projIconUpload"),
        iconRemove: $("projIconRemove"),
        iconInput: $("projIconInput"),
        links: $("linkList"),
        addLink: $("addLinkBtn"),
        pageList: $("pageList"),
        addPage: $("addPageBtn"),
        addSection: $("addSectionBtn"),
        pageSettings: $("pageSettings"),
        assets: $("assetList"),
        assetUpload: $("assetUploadBtn"),
        assetInput: $("assetInput"),
        toolbar: $("toolbar"),
        editor: $("editor"),
        previewPane: $("previewPane"),
        preview: $("preview"),
        handle: $("resizeHandle"),
        handleLabel: $("resizeLabel"),
        saveState: $("saveState"),
        toast: $("toast"),
        dialog: $("dialog"),
        newBtn: $("newBtn"),
        importZipBtn: $("importZipBtn"),
        importZipInput: $("importZipInput"),
        importFolderBtn: $("importFolderBtn"),
        importFolderInput: $("importFolderInput"),
        exportBtn: $("exportBtn"),
        visual: $("visual"),
        modeButtons: [...document.querySelectorAll(".creator-mode-btn")]
    };

    const state = {
        project: null,
        assets: new Map(),
        current: null,
        colors: {},
        loaders: {},
        mode: "markdown"
    };

    // Utilities

    function uid() {
        return Math.random().toString(36).slice(2, 10);
    }

    function debounce(fn, wait) {
        let timer = null;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), wait);
        };
    }

    function slugFile(text) {
        return String(text).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "page";
    }

    function escapeRegex(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    let toastTimer = null;
    function toast(message, isError) {
        el.toast.textContent = message;
        el.toast.classList.toggle("creator-toast-error", !!isError);
        el.toast.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { el.toast.hidden = true; }, isError ? 7000 : 5000);
    }

    function setSaveState(text) {
        el.saveState.textContent = text;
    }

    async function fetchJson(path) {
        try {
            const res = await fetch(path, { cache: "no-cache" });
            return res.ok ? await res.json() : {};
        } catch {
            return {};
        }
    }

    function download(blob, name) {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 2000);
    }

    // Project model

    function newPage(title) {
        return { uid: uid(), type: "page", title, file: uniqueFile(slugFile(title)), autoFile: true, content: "" };
    }

    function newSection(title) {
        return { uid: uid(), type: "section", title };
    }

    function emptyProject() {
        return {
            id: "",
            name: "",
            category: "mods",
            icon: "",
            description: "",
            updated: "",
            mainSite: "",
            links: [],
            pages: [{ uid: uid(), type: "page", title: "Overview", file: "overview", autoFile: true, content: "" }]
        };
    }

    function pageByUid(id) {
        return state.project.pages.find(page => page.uid === id) || null;
    }

    function currentPage() {
        return pageByUid(state.current);
    }

    function docPages() {
        return state.project ? state.project.pages.filter(page => page.type === "page") : [];
    }

    function uniqueFile(base, exceptUid) {
        const taken = new Set(docPages().filter(page => page.uid !== exceptUid).map(page => page.file));
        let file = base;
        let n = 2;
        while (taken.has(file)) {
            file = `${base}_${n}`;
            n++;
        }
        return file;
    }

    function defaultMainSite() {
        const p = state.project;
        return p.id ? `${MAIN_SITE}/${p.category}/#${p.id}` : "";
    }

    function hasContent() {
        const p = state.project;
        return !!(p.id || p.name || p.description || state.assets.size || p.pages.some(page => page.type === "page" && page.content.trim()));
    }

    // Assets

    function addAsset(path, blob) {
        const old = state.assets.get(path);
        if (old) URL.revokeObjectURL(old.url);
        state.assets.set(path, { blob, url: URL.createObjectURL(blob) });
    }

    function removeAsset(path) {
        const asset = state.assets.get(path);
        if (asset) URL.revokeObjectURL(asset.url);
        state.assets.delete(path);
    }

    function clearAssets() {
        state.assets.forEach(asset => URL.revokeObjectURL(asset.url));
        state.assets.clear();
    }

    function sanitizeName(name) {
        const match = String(name).toLowerCase().match(/^(.*?)(\.[a-z0-9]+)?$/);
        const base = match[1].replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "image";
        return base + (match[2] || ".png");
    }

    function uniqueAssetPath(folder, name) {
        let path = folder + name;
        let n = 2;
        while (state.assets.has(path)) {
            path = folder + name.replace(/(\.[^.]+)?$/, `_${n}$1`);
            n++;
        }
        return path;
    }

    function normalizeAsset(path) {
        return String(path || "").replace(/^\.\//, "");
    }

    function assetUrl(path) {
        const asset = state.assets.get(normalizeAsset(path));
        return asset ? asset.url : path;
    }

    function isAssetUsed(path) {
        return state.project.icon === path || docPages().some(page => page.content.includes(path));
    }

    function imageAssets() {
        return [...state.assets.keys()].filter(path => IMAGE_EXT.test(path)).sort();
    }

    async function shrinkImage(file, maxWidth) {
        if (!maxWidth || /gif|svg/.test(file.type)) return file;
        try {
            const bitmap = await createImageBitmap(file);
            if (bitmap.width <= maxWidth) return file;
            const canvas = document.createElement("canvas");
            canvas.width = maxWidth;
            canvas.height = Math.round(bitmap.height * maxWidth / bitmap.width);
            const ctx = canvas.getContext("2d");
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            const type = file.type === "image/jpeg" || file.type === "image/webp" ? file.type : "image/png";
            const blob = await new Promise(resolve => canvas.toBlob(resolve, type, 0.9));
            return blob || file;
        } catch {
            return file;
        }
    }

    async function uploadImage(file, maxWidth, name) {
        const blob = await shrinkImage(file, maxWidth);
        const path = uniqueAssetPath("images/", sanitizeName(name || file.name || "image.png"));
        addAsset(path, blob);
        renderAssets();
        changed();
        return path;
    }

    // Draft storage

    let dbPromise = null;

    function openDb() {
        if (!dbPromise) {
            dbPromise = new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, 1);
                request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }
        return dbPromise;
    }

    async function dbRun(mode, action) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(DB_STORE, mode);
            const request = action(tx.objectStore(DB_STORE));
            tx.oncomplete = () => resolve(request ? request.result : undefined);
            tx.onerror = () => reject(tx.error);
        });
    }

    async function saveDraft() {
        try {
            const assets = [...state.assets].map(([path, asset]) => ({ path, blob: asset.blob }));
            await dbRun("readwrite", store => store.put({ project: state.project, current: state.current, assets }, DRAFT_KEY));
            setSaveState("Draft saved");
        } catch (error) {
            console.error(error);
            setSaveState("Draft not saved");
        }
    }

    async function loadDraft() {
        try {
            return await dbRun("readonly", store => store.get(DRAFT_KEY));
        } catch {
            return null;
        }
    }

    const scheduleSave = debounce(saveDraft, 600);

    function changed() {
        setSaveState("Saving…");
        scheduleSave();
    }

    // Project panel

    function renderProjectFields() {
        const p = state.project;
        el.id.value = p.id;
        el.name.value = p.name;
        el.category.value = p.category;
        el.description.value = p.description;
        el.mainSite.value = p.mainSite;
        el.updated.value = p.updated || "";
        updateMainSitePlaceholder();
        renderIcon();
        renderLinks();
    }

    function updateMainSitePlaceholder() {
        el.mainSite.placeholder = defaultMainSite() || `${MAIN_SITE}/mods/#your_id`;
    }

    function renderIcon() {
        const p = state.project;
        if (p.icon && state.assets.has(p.icon)) {
            el.iconPreview.innerHTML = `<img src="${state.assets.get(p.icon).url}" alt="">`;
        } else {
            el.iconPreview.textContent = (p.name || "?").charAt(0).toUpperCase();
        }
        el.iconRemove.disabled = !p.icon;
    }

    function renderLinks() {
        el.links.innerHTML = state.project.links.map((link, i) => `
            <div class="creator-link-row">
                <input class="creator-input" data-link="${i}" data-key="label" placeholder="Label" value="${esc(link.label)}">
                <input class="creator-input" data-link="${i}" data-key="url" placeholder="https://…" value="${esc(link.url)}">
                <button type="button" class="creator-small-btn creator-danger" data-remove-link="${i}" aria-label="Remove link">×</button>
            </div>`).join("");
    }

    function bindProjectFields() {
        el.category.innerHTML = Object.entries(CATEGORY_LABELS).map(([value, label]) => `<option value="${value}">${label}</option>`).join("");

        el.id.addEventListener("input", () => {
            const clean = el.id.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
            if (clean !== el.id.value) el.id.value = clean;
            state.project.id = clean;
            updateMainSitePlaceholder();
            changed();
        });

        el.name.addEventListener("input", () => {
            state.project.name = el.name.value;
            renderIcon();
            changed();
        });

        el.category.addEventListener("change", () => {
            state.project.category = el.category.value;
            updateMainSitePlaceholder();
            changed();
        });

        el.description.addEventListener("input", () => {
            state.project.description = el.description.value;
            changed();
        });

        el.updated.addEventListener("input", () => {
            state.project.updated = el.updated.value;
            changed();
        });

        el.updatedToday.addEventListener("click", () => {
            state.project.updated = today();
            el.updated.value = state.project.updated;
            changed();
        });

        el.mainSite.addEventListener("input", () => {
            state.project.mainSite = el.mainSite.value.trim();
            changed();
        });

        el.iconUpload.addEventListener("click", () => el.iconInput.click());

        el.iconInput.addEventListener("change", async () => {
            const file = el.iconInput.files[0];
            el.iconInput.value = "";
            if (!file) return;
            const old = state.project.icon;
            if (old) removeAsset(old);
            const ext = (sanitizeName(file.name).match(/\.[a-z0-9]+$/) || [".png"])[0];
            state.project.icon = "icon" + ext;
            addAsset(state.project.icon, file);
            renderIcon();
            renderAssets();
            changed();
        });

        el.iconRemove.addEventListener("click", () => {
            const old = state.project.icon;
            state.project.icon = "";
            if (old && !docPages().some(page => page.content.includes(old))) removeAsset(old);
            renderIcon();
            renderAssets();
            changed();
        });

        el.addLink.addEventListener("click", () => {
            state.project.links.push({ label: "", url: "" });
            renderLinks();
            el.links.querySelector(`[data-link="${state.project.links.length - 1}"]`).focus();
            changed();
        });

        el.links.addEventListener("input", event => {
            const input = event.target.closest("[data-link]");
            if (!input) return;
            state.project.links[input.dataset.link][input.dataset.key] = input.value.trim();
            changed();
        });

        el.links.addEventListener("click", event => {
            const button = event.target.closest("[data-remove-link]");
            if (!button) return;
            state.project.links.splice(Number(button.dataset.removeLink), 1);
            renderLinks();
            changed();
        });
    }

    // Pages

    function renderPages() {
        el.pageList.innerHTML = state.project.pages.map(page => `
            <li class="creator-page${page.type === "section" ? " creator-page-section" : ""}${page.uid === state.current ? " creator-selected" : ""}" draggable="true" data-uid="${page.uid}">
                <span class="creator-drag" aria-hidden="true">≡</span>
                <span class="creator-page-title">${esc(page.title || "Untitled")}</span>
                ${page.type === "page" ? `<span class="creator-page-file">${esc(page.file)}.md</span>` : ""}
            </li>`).join("");
        renderPageSettings();
    }

    function updatePageListItem(page) {
        const item = el.pageList.querySelector(`[data-uid="${page.uid}"]`);
        if (!item) return;
        item.querySelector(".creator-page-title").textContent = page.title || "Untitled";
        const file = item.querySelector(".creator-page-file");
        if (file) file.textContent = `${page.file}.md`;
    }

    function renderPageSettings() {
        const page = currentPage();
        if (!page) {
            el.pageSettings.innerHTML = "";
            return;
        }
        const index = state.project.pages.indexOf(page);
        el.pageSettings.innerHTML = `
            <div class="creator-field">
                <label for="pageTitle">${page.type === "section" ? "Section title" : "Page title"}</label>
                <input id="pageTitle" class="creator-input" value="${esc(page.title)}" autocomplete="off">
            </div>
            ${page.type === "page" ? `
            <div class="creator-field">
                <label for="pageFile">File name</label>
                <input id="pageFile" class="creator-input" value="${esc(page.file)}" autocomplete="off">
                <span class="creator-hint" id="pageFileHint">Link to it with [Text](${esc(page.file)})</span>
            </div>` : ""}
            <div class="creator-row">
                <button type="button" class="creator-small-btn" id="pageUp"${index === 0 ? " disabled" : ""}>Move up</button>
                <button type="button" class="creator-small-btn" id="pageDown"${index === state.project.pages.length - 1 ? " disabled" : ""}>Move down</button>
                <button type="button" class="creator-small-btn creator-danger" id="pageDelete">Delete</button>
            </div>`;

        const title = $("pageTitle");
        const file = $("pageFile");

        title.addEventListener("input", () => {
            page.title = title.value;
            if (page.type === "page" && page.autoFile) {
                renameFile(page, uniqueFile(slugFile(page.title), page.uid));
                file.value = page.file;
                $("pageFileHint").textContent = `Link to it with [Text](${page.file})`;
            }
            updatePageListItem(page);
            changed();
            if (isVisual()) updateVisualTitle();
            else schedulePreview();
        });

        if (file) {
            file.addEventListener("input", () => {
                const clean = file.value.toLowerCase().replace(/[^a-z0-9_-]/g, "");
                if (clean !== file.value) file.value = clean;
            });
            file.addEventListener("change", () => {
                page.autoFile = false;
                renameFile(page, uniqueFile(file.value || slugFile(page.title), page.uid));
                file.value = page.file;
                $("pageFileHint").textContent = `Link to it with [Text](${page.file})`;
                updatePageListItem(page);
                changed();
            });
        }

        $("pageUp").addEventListener("click", () => movePage(page, -1));
        $("pageDown").addEventListener("click", () => movePage(page, 1));
        $("pageDelete").addEventListener("click", () => deletePage(page));
    }

    function renameFile(page, newFile) {
        const oldFile = page.file;
        if (oldFile === newFile) return;
        page.file = newFile;
        const pattern = new RegExp(`\\]\\(${escapeRegex(oldFile)}(#[^)]*)?\\)`, "g");
        docPages().forEach(other => {
            const updated = other.content.replace(pattern, (match, anchor) => `](${newFile}${anchor || ""})`);
            if (updated !== other.content) {
                other.content = updated;
                if (other === currentPage()) {
                    el.editor.value = updated;
                    if (isVisual()) renderVisual();
                }
            }
        });
    }

    function selectPage(id) {
        if (!pageByUid(id)) return;
        state.current = id;
        renderPages();
        loadEditor();
        refreshView();
        el.previewPane.scrollTop = 0;
        scheduleSave();
    }

    function insertPage(page) {
        const index = state.project.pages.indexOf(currentPage());
        state.project.pages.splice(index === -1 ? state.project.pages.length : index + 1, 0, page);
        selectPage(page.uid);
        changed();
        const title = $("pageTitle");
        title.focus();
        title.select();
    }

    function movePage(page, delta) {
        const pages = state.project.pages;
        const index = pages.indexOf(page);
        const target = index + delta;
        if (target < 0 || target >= pages.length) return;
        pages.splice(index, 1);
        pages.splice(target, 0, page);
        renderPages();
        changed();
    }

    function deletePage(page) {
        const pages = state.project.pages;
        if (page.type === "page" && docPages().length === 1) {
            toast("A project needs at least one page.", true);
            return;
        }
        const label = page.type === "section" ? `the section "${page.title}"` : `the page "${page.title}" and its content`;
        if (!confirm(`Delete ${label}?`)) return;
        const index = pages.indexOf(page);
        pages.splice(index, 1);
        const next = pages[Math.min(index, pages.length - 1)];
        selectPage(next ? next.uid : null);
        renderAssets();
        changed();
    }

    function bindPages() {
        let dragUid = null;

        const clearDrop = () => el.pageList.querySelectorAll(".creator-drop-before, .creator-drop-after")
            .forEach(item => item.classList.remove("creator-drop-before", "creator-drop-after"));

        el.pageList.addEventListener("click", event => {
            const item = event.target.closest(".creator-page");
            if (item && item.dataset.uid !== state.current) selectPage(item.dataset.uid);
        });

        el.pageList.addEventListener("dragstart", event => {
            const item = event.target.closest(".creator-page");
            if (!item) return;
            dragUid = item.dataset.uid;
            item.classList.add("creator-dragging");
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", dragUid);
        });

        el.pageList.addEventListener("dragover", event => {
            const item = event.target.closest(".creator-page");
            if (!item || !dragUid) return;
            event.preventDefault();
            clearDrop();
            if (item.dataset.uid === dragUid) return;
            const rect = item.getBoundingClientRect();
            item.classList.add(event.clientY < rect.top + rect.height / 2 ? "creator-drop-before" : "creator-drop-after");
        });

        el.pageList.addEventListener("drop", event => {
            const item = event.target.closest(".creator-page");
            if (!item || !dragUid) return;
            event.preventDefault();
            const before = item.classList.contains("creator-drop-before");
            const pages = state.project.pages;
            const moving = pageByUid(dragUid);
            if (moving && item.dataset.uid !== dragUid) {
                pages.splice(pages.indexOf(moving), 1);
                let target = pages.indexOf(pageByUid(item.dataset.uid));
                if (!before) target++;
                pages.splice(target, 0, moving);
                renderPages();
                changed();
            }
            clearDrop();
        });

        el.pageList.addEventListener("dragend", () => {
            dragUid = null;
            clearDrop();
            el.pageList.querySelectorAll(".creator-dragging").forEach(item => item.classList.remove("creator-dragging"));
        });

        el.addPage.addEventListener("click", () => insertPage(newPage("New page")));
        el.addSection.addEventListener("click", () => insertPage(newSection("New section")));
    }

    // Asset panel

    function renderAssets() {
        const paths = [...state.assets.keys()].sort();
        if (!paths.length) {
            el.assets.innerHTML = `<p class="creator-hint">No images yet.</p>`;
            return;
        }
        el.assets.innerHTML = paths.map(path => {
            const asset = state.assets.get(path);
            const preview = IMAGE_EXT.test(path) ? `<img src="${asset.url}" alt="">` : `<span class="creator-asset-file">FILE</span>`;
            const label = path === state.project.icon ? "project icon" : isAssetUsed(path) ? "" : "unused";
            return `
                <div class="creator-asset" data-path="${esc(path)}" title="${esc(path)}">
                    ${preview}
                    <span class="creator-asset-name">${esc(path.split("/").pop())}</span>
                    ${label ? `<span class="creator-asset-unused">${label}</span>` : ""}
                    <button type="button" class="creator-asset-delete" data-delete="${esc(path)}" aria-label="Delete ${esc(path)}">×</button>
                </div>`;
        }).join("");
    }

    function bindAssets() {
        el.assetUpload.addEventListener("click", () => el.assetInput.click());

        el.assetInput.addEventListener("change", async () => {
            const files = [...el.assetInput.files];
            el.assetInput.value = "";
            for (const file of files) await uploadImage(file, 0);
            toast(files.length === 1 ? "Image uploaded." : `${files.length} images uploaded.`);
        });

        el.assets.addEventListener("click", event => {
            const remove = event.target.closest("[data-delete]");
            if (remove) {
                const path = remove.dataset.delete;
                if (isAssetUsed(path) && !confirm(`${path} is still used. Delete it anyway?`)) return;
                if (state.project.icon === path) state.project.icon = "";
                removeAsset(path);
                renderAssets();
                renderIcon();
                refreshView();
                changed();
                return;
            }
            const item = event.target.closest(".creator-asset");
            if (item && IMAGE_EXT.test(item.dataset.path) && editorEnabled()) {
                openImageDialog({ presetPath: item.dataset.path });
            }
        });
    }

    // Editor

    function editorEnabled() {
        const page = currentPage();
        return !!page && page.type === "page";
    }

    function loadEditor() {
        const enabled = editorEnabled();
        el.editor.disabled = !enabled;
        el.editor.value = enabled ? currentPage().content : "";
        el.editor.placeholder = enabled
            ? "Write this page in Markdown…"
            : "Sections only group pages in the sidebar. Select a page to edit it.";
        el.toolbar.querySelectorAll("button").forEach(button => { button.disabled = !enabled; });
    }

    function insertText(text) {
        if (isVisual()) {
            el.editor.setRangeText(text, el.editor.selectionStart, el.editor.selectionEnd, "end");
            el.editor.dispatchEvent(new Event("input", { bubbles: true }));
            return;
        }
        el.editor.focus();
        if (!document.execCommand("insertText", false, text)) {
            el.editor.setRangeText(text, el.editor.selectionStart, el.editor.selectionEnd, "end");
            el.editor.dispatchEvent(new Event("input", { bubbles: true }));
        }
    }

    function replaceRange(start, end, text, selStart, selEnd) {
        if (!isVisual()) el.editor.focus();
        el.editor.setSelectionRange(start, end);
        insertText(text);
        if (selStart !== undefined) {
            el.editor.setSelectionRange(start + selStart, start + (selEnd !== undefined ? selEnd : selStart));
        }
    }

    function selectedText() {
        return el.editor.value.slice(el.editor.selectionStart, el.editor.selectionEnd);
    }

    function wrap(before, after, placeholder) {
        const start = el.editor.selectionStart;
        const end = el.editor.selectionEnd;
        const text = el.editor.value.slice(start, end) || placeholder;
        replaceRange(start, end, before + text + after, before.length, before.length + text.length);
    }

    function lineRange() {
        const value = el.editor.value;
        const selStart = el.editor.selectionStart;
        let selEnd = el.editor.selectionEnd;
        if (selEnd > selStart && value[selEnd - 1] === "\n") selEnd--;
        const start = value.lastIndexOf("\n", selStart - 1) + 1;
        let end = value.indexOf("\n", selEnd);
        if (end === -1) end = value.length;
        return { start, end };
    }

    function transformLines(fn) {
        const { start, end } = lineRange();
        const lines = el.editor.value.slice(start, end).split("\n");
        const single = lines.length === 1;
        let n = 0;
        const out = lines.map(line => (!single && !line.trim()) ? line : fn(line, n++)).join("\n");
        replaceRange(start, end, out, single ? out.length : 0, out.length);
    }

    function listify(marker) {
        transformLines((line, n) => {
            const m = line.match(LIST_LINE);
            return m[1] + marker(n) + m[2];
        });
    }

    function insertBlock(text, selStart, selEnd) {
        const value = el.editor.value;
        const start = el.editor.selectionStart;
        const end = el.editor.selectionEnd;
        const before = value.slice(0, start);
        const after = value.slice(end);
        const lead = !before.length || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
        const trail = after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
        const full = lead + text + trail;
        const a = selStart === undefined ? full.length : lead.length + selStart;
        const b = selStart === undefined ? full.length : lead.length + (selEnd === undefined ? selStart : selEnd);
        replaceRange(start, end, full, a, b);
    }

    function containerBlock(head, placeholder) {
        const body = selectedText() || placeholder;
        const open = `::: ${head}\n`;
        insertBlock(`${open}${body}\n:::`, open.length, open.length + body.length);
    }

    function heading(level) {
        const prefix = "#".repeat(level) + " ";
        transformLines(line => {
            const m = line.match(/^\s*(#{1,6})\s+(.*)$/);
            if (m && m[1].length === level) return m[2];
            return prefix + (m ? m[2] : line);
        });
    }

    function matchAtCursor(source) {
        const value = el.editor.value;
        const cursor = el.editor.selectionStart;
        const lineStart = value.lastIndexOf("\n", cursor - 1) + 1;
        let lineEnd = value.indexOf("\n", cursor);
        if (lineEnd === -1) lineEnd = value.length;
        const line = value.slice(lineStart, lineEnd);
        const re = new RegExp(source, "g");
        let m;
        while ((m = re.exec(line))) {
            const start = lineStart + m.index;
            const end = start + m[0].length;
            if (cursor >= start && cursor <= end) return { start, end, match: m };
        }
        return null;
    }

    function onEditorKeydown(event) {
        const ed = el.editor;
        const mod = event.ctrlKey || event.metaKey;

        if (mod && !event.altKey) {
            const key = event.key.toLowerCase();
            if (key === "b") { event.preventDefault(); wrap("**", "**", "bold text"); return; }
            if (key === "i") { event.preventDefault(); wrap("*", "*", "italic text"); return; }
            if (key === "k") { event.preventDefault(); openLinkDialog(); return; }
        }

        if (event.key === "Tab" && !mod && !event.altKey) {
            event.preventDefault();
            const multi = selectedText().includes("\n");
            if (event.shiftKey) {
                transformLines(line => line.replace(/^ {1,4}/, ""));
            } else if (multi) {
                transformLines(line => "    " + line);
            } else {
                insertText("    ");
            }
            return;
        }

        if (event.key === "Enter" && !event.shiftKey && !mod && !event.altKey && ed.selectionStart === ed.selectionEnd) {
            const value = ed.value;
            const pos = ed.selectionStart;
            const lineStart = value.lastIndexOf("\n", pos - 1) + 1;
            const line = value.slice(lineStart, pos);
            const m = line.match(/^(\s*)([-*+]|\d+[.)])(\s+)(\[[ xX]\]\s+)?(.*)$/);
            if (!m) return;
            event.preventDefault();
            if (!m[5].trim()) {
                replaceRange(lineStart, pos, "", 0);
                return;
            }
            let marker = m[2];
            if (/\d/.test(marker)) marker = (parseInt(marker, 10) + 1) + marker.slice(-1);
            insertText("\n" + m[1] + marker + m[3] + (m[4] ? "[ ] " : ""));
        }
    }

    async function insertImageFiles(files) {
        const images = files.filter(file => file.type.startsWith("image/"));
        if (!images.length || !editorEnabled()) return false;
        const lines = [];
        for (const file of images) {
            const name = file.name && file.name !== "image.png" ? file.name : `screenshot_${Date.now()}.png`;
            const path = await uploadImage(file, 1600, name);
            lines.push(`![](${path})`);
        }
        insertBlock(lines.join("\n\n"));
        return true;
    }

    function bindEditor() {
        el.editor.addEventListener("input", () => {
            const page = currentPage();
            if (!page || page.type !== "page") return;
            page.content = el.editor.value;
            changed();
            if (isVisual()) scheduleVisualFromEditor();
            else schedulePreview();
        });

        el.editor.addEventListener("keydown", onEditorKeydown);

        el.editor.addEventListener("paste", event => {
            const files = [...(event.clipboardData ? event.clipboardData.files : [])];
            if (files.some(file => file.type.startsWith("image/"))) {
                event.preventDefault();
                insertImageFiles(files);
            }
        });

        el.editor.addEventListener("dragover", event => {
            if (![...event.dataTransfer.types].includes("Files")) return;
            event.preventDefault();
            el.editor.classList.add("creator-drop-target");
        });

        el.editor.addEventListener("dragleave", () => el.editor.classList.remove("creator-drop-target"));

        el.editor.addEventListener("drop", event => {
            el.editor.classList.remove("creator-drop-target");
            const files = [...event.dataTransfer.files];
            if (!files.length) return;
            event.preventDefault();
            insertImageFiles(files);
        });
    }

    // Toolbar

    const TOOLS = [
        ["B", "Bold (Ctrl+B)", () => wrap("**", "**", "bold text")],
        ["I", "Italic (Ctrl+I)", () => wrap("*", "*", "italic text")],
        ["S", "Strikethrough", () => wrap("~~", "~~", "text")],
        ["Code", "Inline code", () => wrap("`", "`", "code")],
        null,
        ["H1", "Page title (replaces the title from the page settings)", () => heading(1)],
        ["H2", "Heading 2", () => heading(2)],
        ["H3", "Heading 3", () => heading(3)],
        ["H4", "Heading 4", () => heading(4)],
        null,
        ["List", "Bullet list", () => listify(() => "- ")],
        ["1.", "Numbered list", () => listify(n => `${n + 1}. `)],
        ["Task", "Checklist", () => listify(() => "- [ ] ")],
        ["Quote", "Quote", () => transformLines(line => "> " + line.replace(/^\s*>\s?/, ""))],
        null,
        ["Left", "Align left", () => alignText("left")],
        ["Center", "Align center", () => alignText("center")],
        ["Right", "Align right", () => alignText("right")],
        null,
        ["Link", "Link (Ctrl+K)", () => openLinkDialog()],
        ["Image", "Image", () => openImageDialog()],
        ["Icon", "Inline icon", () => openIconDialog()],
        ["Table", "Table", () => openTableDialog()],
        ["Loader", "Loader chips", () => openLoaderDialog()],
        ["Color", "Text color", () => openColorDialog()],
        null,
        ["Tabs", "Tabs", () => openTabsDialog()],
        ["Details", "Collapsible section", () => containerBlock("details Click to open", "Hidden content.")],
        ["Callout", "Info, tip, warning or danger box", () => openCalloutDialog()],
        ["Changelog", "Changelog block", () => containerBlock("changelog", "## v1.0\n- [green]Added[/] ")],
        ["Recipe", "Crafting, furnace or brewing recipe", () => recipeTool()],
        ["Video", "YouTube video", () => videoTool()],
        ["Gallery", "Image gallery", () => galleryTool()],
        ["Code block", "Code block", () => {
            const body = selectedText();
            insertBlock("```\n" + body + "\n```", 3);
        }],
        ["Line", "Divider", () => insertBlock("---")]
    ];

    function buildToolbar() {
        el.toolbar.innerHTML = TOOLS.map((tool, i) => tool
            ? `<button type="button" class="creator-tool" data-tool="${i}" title="${esc(tool[1])}">${esc(tool[0])}</button>`
            : `<span class="creator-tool-sep" aria-hidden="true"></span>`).join("");
        el.toolbar.addEventListener("mousedown", event => {
            if (event.target.closest(".creator-tool")) event.preventDefault();
        });
        el.toolbar.addEventListener("click", event => {
            const button = event.target.closest(".creator-tool");
            if (button && !button.disabled) runTool(Number(button.dataset.tool));
        });
    }

    // Attribute helpers

    function parseAttrsRaw(text) {
        const list = [];
        if (!text) return list;
        const re = /([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s}]+)))?/g;
        let m;
        while ((m = re.exec(text))) {
            const value = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4];
            list.push([m[1].toLowerCase(), value === undefined ? true : value]);
        }
        return list;
    }

    function getAttr(list, key) {
        const entry = list.find(([k]) => k === key);
        return entry ? entry[1] : undefined;
    }

    function setAttr(list, key, value) {
        const index = list.findIndex(([k]) => k === key);
        if (value === undefined || value === null || value === "" || value === false) {
            if (index !== -1) list.splice(index, 1);
            return;
        }
        if (index === -1) list.push([key, value]);
        else list[index][1] = value;
    }

    function serializeAttrs(list) {
        if (!list.length) return "";
        return "{" + list.map(([key, value]) => {
            if (value === true) return key;
            const text = String(value);
            return /[\s"'}]/.test(text) || key === "caption" ? `${key}="${text.replace(/"/g, "'")}"` : `${key}=${text}`;
        }).join(" ") + "}";
    }

    // Dialog

    function openDialog({ title, body, confirmLabel, onConfirm, onOpen, wide }) {
        const dialog = el.dialog;
        dialog.innerHTML = `
            <form method="dialog" class="creator-dialog-form" novalidate>
                <div class="creator-dialog-head">
                    <span>${esc(title)}</span>
                    <button type="button" class="creator-small-btn" data-close>Close</button>
                </div>
                <div class="creator-dialog-body">${body}</div>
                <div class="creator-dialog-foot">
                    <button type="button" class="wiki-btn wiki-btn-secondary" data-close>Cancel</button>
                    ${confirmLabel ? `<button type="submit" class="wiki-btn wiki-btn-primary">${esc(confirmLabel)}</button>` : ""}
                </div>
            </form>`;
        const form = dialog.querySelector("form");
        dialog.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => dialog.close()));
        form.addEventListener("submit", event => {
            event.preventDefault();
            if (onConfirm && onConfirm(form) === false) return;
            dialog.close();
        });
        dialog.classList.toggle("creator-dialog-wide", !!wide);
        dialog.showModal();
        if (onOpen) onOpen(form);
    }

    function pickerHtml(selected) {
        const paths = imageAssets();
        if (!paths.length) return `<p class="creator-hint">No images uploaded yet.</p>`;
        return paths.map(path => `
            <div class="creator-asset${path === selected ? " creator-selected" : ""}" data-pick="${esc(path)}" title="${esc(path)}">
                <img src="${state.assets.get(path).url}" alt="">
                <span class="creator-asset-name">${esc(path.split("/").pop())}</span>
            </div>`).join("");
    }

    // Link dialog

    function headingsOf(page) {
        const result = [];
        const counts = new Map();
        const stack = [];
        let fence = null;
        page.content.split("\n").forEach(line => {
            const f = line.match(FENCE);
            if (fence) {
                if (f && f[1][0] === fence[0] && f[1].length >= fence.length && !line.trim().slice(f[1].length).trim()) fence = null;
                return;
            }
            if (f) {
                fence = f[1];
                return;
            }
            const open = line.match(CONTAINER_OPEN);
            if (open) {
                stack.push(open[1].toLowerCase());
                return;
            }
            if (CONTAINER_CLOSE.test(line)) {
                stack.pop();
                return;
            }
            if (stack.includes("changelog")) return;
            const h = line.match(HEADING);
            if (!h) return;
            const base = WikiMarkdown.slug(h[2], { colors: state.colors, loaders: state.loaders });
            const count = counts.get(base) || 0;
            counts.set(base, count + 1);
            result.push({ text: h[2], level: h[1].length, slug: count ? `${base}-${count + 1}` : base });
        });
        return result;
    }

    function openLinkDialog() {
        if (!editorEnabled()) return;
        const selection = selectedText();
        const pages = docPages();
        const current = currentPage();
        openDialog({
            title: "Link",
            confirmLabel: "Insert",
            body: `
                <div class="creator-field">
                    <label for="linkText">Text</label>
                    <input id="linkText" name="text" class="creator-input" value="${esc(selection)}" autocomplete="off">
                </div>
                <div class="creator-field">
                    <label for="linkTarget">Target</label>
                    <select id="linkTarget" class="creator-input">
                        <optgroup label="Pages of this project">
                            ${pages.map(page => `<option value="${esc(page.uid)}"${page === current ? " selected" : ""}>${esc(page.title)}${page === current ? " (this page)" : ""}</option>`).join("")}
                        </optgroup>
                        <option value="custom">Other project or external URL</option>
                    </select>
                </div>
                <div class="creator-field" id="linkSectionField">
                    <label for="linkSection">Section</label>
                    <select id="linkSection" class="creator-input"></select>
                </div>
                <div class="creator-field" id="linkCustomField" hidden>
                    <label for="linkUrl">Address</label>
                    <input id="linkUrl" class="creator-input" placeholder="https://… or other_project/page" autocomplete="off">
                </div>`,
            onOpen: form => {
                const target = form.querySelector("#linkTarget");
                const section = form.querySelector("#linkSection");
                const update = () => {
                    const custom = target.value === "custom";
                    form.querySelector("#linkCustomField").hidden = !custom;
                    form.querySelector("#linkSectionField").hidden = custom;
                    if (custom) return;
                    const page = pageByUid(target.value);
                    section.innerHTML = `<option value="">Top of the page</option>` + headingsOf(page)
                        .map(h => `<option value="${esc(h.slug)}">${"  ".repeat(Math.max(0, h.level - 1))}${esc(h.text)}</option>`).join("");
                };
                target.addEventListener("change", update);
                update();
                form.querySelector("#linkText").focus();
            },
            onConfirm: form => {
                const target = form.querySelector("#linkTarget").value;
                let href;
                let fallback;
                if (target === "custom") {
                    href = form.querySelector("#linkUrl").value.trim();
                    fallback = href;
                } else {
                    const page = pageByUid(target);
                    const anchor = form.querySelector("#linkSection").value;
                    href = page === current && anchor ? `#${anchor}` : page.file + (anchor ? `#${anchor}` : "");
                    fallback = page.title;
                }
                if (!href) {
                    toast("Enter an address for the link.", true);
                    return false;
                }
                const text = form.querySelector("#linkText").value.trim() || fallback;
                const start = el.editor.selectionStart;
                replaceRange(start, el.editor.selectionEnd, `[${text}](${href})`, 1, 1 + text.length);
            }
        });
    }

    // Image dialog

    function openImageDialog(options) {
        if (!editorEnabled()) return;
        const opts = options || {};
        const found = opts.presetPath ? null : matchAtCursor(IMAGE_SOURCE);
        const m = found ? found.match : null;
        const attrs = m ? parseAttrsRaw(m[4]) : [];
        const data = {
            path: m ? m[2] : (opts.presetPath || ""),
            alt: m ? m[1] : "",
            title: m && m[3] ? m[3] : "",
            width: Number(getAttr(attrs, "width")) || 0,
            natural: 0
        };

        openDialog({
            title: found ? "Edit image" : "Image",
            confirmLabel: found ? "Update" : "Insert",
            wide: true,
            body: `
                <div class="creator-field">
                    <span class="creator-label">Choose an image</span>
                    <div class="creator-picker" id="imgPicker">${pickerHtml(normalizeAsset(data.path))}</div>
                    <div class="creator-row">
                        <button type="button" class="creator-small-btn" id="imgUpload">Upload new</button>
                        <label class="creator-check"><input type="checkbox" id="imgShrink" checked> Shrink files wider than</label>
                        <input type="number" id="imgShrinkMax" class="creator-input creator-input-small" value="1600" min="64">
                        <span class="creator-hint">px</span>
                        <input type="file" id="imgFile" accept="image/*" hidden>
                    </div>
                </div>
                <div class="creator-field">
                    <label for="imgPath">Path</label>
                    <input id="imgPath" class="creator-input" value="${esc(data.path)}" autocomplete="off">
                </div>
                <div class="creator-stage" id="imgStage"></div>
                <div class="creator-field">
                    <span class="creator-label">Display width</span>
                    <div class="creator-row">
                        <input type="range" id="imgRange" class="creator-range" min="16" max="1200" value="${data.width || 400}">
                        <input type="number" id="imgWidth" class="creator-input creator-input-small" min="16" value="${data.width || ""}" placeholder="auto">
                        <span class="creator-hint">px</span>
                        <button type="button" class="creator-small-btn" id="imgAuto">Original size</button>
                    </div>
                    <span class="creator-hint" id="imgNatural"></span>
                </div>
                <div class="creator-grid2">
                    <div class="creator-field">
                        <label for="imgAlign">Alignment</label>
                        <select id="imgAlign" class="creator-input">
                            <option value="">Inline (in the text)</option>
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                        </select>
                    </div>
                    <div class="creator-field">
                        <label for="imgAlt">Description (for screen readers)</label>
                        <input id="imgAlt" class="creator-input" value="${esc(data.alt)}" autocomplete="off">
                    </div>
                </div>
                <div class="creator-field">
                    <label for="imgCaption">Caption</label>
                    <input id="imgCaption" class="creator-input" value="${esc(getAttr(attrs, "caption") || "")}" autocomplete="off">
                </div>
                <div class="creator-row">
                    <label class="creator-check"><input type="checkbox" id="imgPixelated"${getAttr(attrs, "pixelated") ? " checked" : ""}> Keep pixel art sharp</label>
                    <label class="creator-check"><input type="checkbox" id="imgNozoom"${getAttr(attrs, "nozoom") ? " checked" : ""}> No click to enlarge</label>
                </div>`,
            onOpen: form => {
                const q = sel => form.querySelector(sel);
                const stage = q("#imgStage");
                const range = q("#imgRange");
                const width = q("#imgWidth");
                const path = q("#imgPath");
                q("#imgAlign").value = getAttr(attrs, "align") || "";

                const drawStage = () => {
                    if (!data.path) {
                        stage.innerHTML = `<span class="creator-stage-empty">No image selected</span>`;
                        q("#imgNatural").textContent = "";
                        return;
                    }
                    stage.innerHTML = `<img alt="" src="${esc(assetUrl(data.path))}">`;
                    const img = stage.querySelector("img");
                    img.classList.toggle("wiki-pixelated", q("#imgPixelated").checked);
                    img.style.width = data.width ? `${data.width}px` : "";
                    img.addEventListener("load", () => {
                        data.natural = img.naturalWidth;
                        range.max = String(Math.max(1200, data.natural));
                        q("#imgNatural").textContent = `Original: ${img.naturalWidth} × ${img.naturalHeight} px. The wiki shows images at most about 840 px wide.`;
                    });
                };

                const setWidth = value => {
                    data.width = value ? clamp(Math.round(value), 16, 4000) : 0;
                    width.value = data.width || "";
                    if (data.width) range.value = String(data.width);
                    const img = stage.querySelector("img");
                    if (img) img.style.width = data.width ? `${data.width}px` : "";
                };

                const choose = value => {
                    data.path = value;
                    path.value = value;
                    q("#imgPicker").innerHTML = pickerHtml(normalizeAsset(value));
                    drawStage();
                };

                q("#imgPicker").addEventListener("click", event => {
                    const item = event.target.closest("[data-pick]");
                    if (item) choose(item.dataset.pick);
                });
                q("#imgUpload").addEventListener("click", () => q("#imgFile").click());
                q("#imgFile").addEventListener("change", async () => {
                    const file = q("#imgFile").files[0];
                    if (!file) return;
                    const max = q("#imgShrink").checked ? Number(q("#imgShrinkMax").value) || 0 : 0;
                    choose(await uploadImage(file, max));
                });
                path.addEventListener("change", () => {
                    data.path = path.value.trim();
                    q("#imgPicker").innerHTML = pickerHtml(normalizeAsset(data.path));
                    drawStage();
                });
                range.addEventListener("input", () => setWidth(Number(range.value)));
                width.addEventListener("input", () => setWidth(Number(width.value)));
                q("#imgAuto").addEventListener("click", () => setWidth(0));
                q("#imgPixelated").addEventListener("change", drawStage);
                drawStage();
            },
            onConfirm: form => {
                const q = sel => form.querySelector(sel);
                const path = q("#imgPath").value.trim();
                if (!path) {
                    toast("Choose or upload an image first.", true);
                    return false;
                }
                const list = attrs.slice();
                setAttr(list, "width", data.width ? String(data.width) : null);
                setAttr(list, "align", q("#imgAlign").value || null);
                setAttr(list, "caption", q("#imgCaption").value.trim() || null);
                setAttr(list, "pixelated", q("#imgPixelated").checked);
                setAttr(list, "nozoom", q("#imgNozoom").checked);
                const title = data.title ? ` "${data.title}"` : "";
                const markdown = `![${q("#imgAlt").value.trim().replace(/[[\]]/g, "")}](${path}${title})${serializeAttrs(list)}`;
                if (found) {
                    replaceRange(found.start, found.end, markdown, markdown.length);
                } else if (getAttr(list, "align") || getAttr(list, "caption")) {
                    insertBlock(markdown);
                } else {
                    insertText(markdown);
                }
            }
        });
    }

    // Icon dialog

    function openIconDialog() {
        if (!editorEnabled()) return;
        const found = matchAtCursor(ICON_SOURCE);
        const m = found ? found.match : null;
        const attrs = m ? parseAttrsRaw(m[2]) : [];
        const data = { path: m ? m[1].trim() : "", size: parseInt(getAttr(attrs, "size"), 10) || 0 };

        openDialog({
            title: found ? "Edit icon" : "Inline icon",
            confirmLabel: found ? "Update" : "Insert",
            body: `
                <div class="creator-field">
                    <span class="creator-label">Choose an icon</span>
                    <div class="creator-picker" id="iconPicker">${pickerHtml(normalizeAsset(data.path))}</div>
                    <div class="creator-row">
                        <button type="button" class="creator-small-btn" id="iconUpload">Upload new</button>
                        <input type="file" id="iconFile" accept="image/*" hidden>
                    </div>
                </div>
                <div class="creator-field">
                    <label for="iconPath">Path</label>
                    <input id="iconPath" class="creator-input" value="${esc(data.path)}" autocomplete="off">
                </div>
                <div class="creator-stage creator-stage-text" id="iconStage"></div>
                <div class="creator-field">
                    <span class="creator-label">Size</span>
                    <div class="creator-row">
                        <label class="creator-check"><input type="checkbox" id="iconAuto"${data.size ? "" : " checked"}> Text height</label>
                        <input type="range" id="iconRange" class="creator-range" min="8" max="128" value="${data.size || 24}">
                        <input type="number" id="iconSize" class="creator-input creator-input-small" min="8" value="${data.size || 24}">
                        <span class="creator-hint">px</span>
                    </div>
                </div>`,
            onOpen: form => {
                const q = sel => form.querySelector(sel);
                const draw = () => {
                    const auto = q("#iconAuto").checked;
                    q("#iconRange").disabled = auto;
                    q("#iconSize").disabled = auto;
                    q("#iconStage").innerHTML = data.path
                        ? `<span>Some text <img class="wiki-icon" alt="" src="${esc(assetUrl(data.path))}"${auto ? "" : ` style="height:${data.size}px"`}> more text</span>`
                        : `<span class="creator-stage-empty">No icon selected</span>`;
                };
                const choose = value => {
                    data.path = value;
                    q("#iconPath").value = value;
                    q("#iconPicker").innerHTML = pickerHtml(normalizeAsset(value));
                    draw();
                };
                const setSize = value => {
                    data.size = clamp(Math.round(value) || 24, 8, 512);
                    q("#iconRange").value = String(data.size);
                    q("#iconSize").value = String(data.size);
                    draw();
                };
                if (!data.size) data.size = 24;
                q("#iconPicker").addEventListener("click", event => {
                    const item = event.target.closest("[data-pick]");
                    if (item) choose(item.dataset.pick);
                });
                q("#iconUpload").addEventListener("click", () => q("#iconFile").click());
                q("#iconFile").addEventListener("change", async () => {
                    const file = q("#iconFile").files[0];
                    if (file) choose(await uploadImage(file, 0));
                });
                q("#iconPath").addEventListener("change", () => choose(q("#iconPath").value.trim()));
                q("#iconAuto").addEventListener("change", draw);
                q("#iconRange").addEventListener("input", () => setSize(Number(q("#iconRange").value)));
                q("#iconSize").addEventListener("input", () => setSize(Number(q("#iconSize").value)));
                draw();
            },
            onConfirm: form => {
                const path = form.querySelector("#iconPath").value.trim();
                if (!path) {
                    toast("Choose or upload an icon first.", true);
                    return false;
                }
                const list = attrs.slice();
                setAttr(list, "size", form.querySelector("#iconAuto").checked ? null : String(data.size));
                const markdown = `:icon[${path}]${serializeAttrs(list)}`;
                if (found) replaceRange(found.start, found.end, markdown, markdown.length);
                else insertText(markdown);
            }
        });
    }

    // Table dialog

    function splitRow(line) {
        let s = line.trim();
        if (s.startsWith("|")) s = s.slice(1);
        if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
        const cells = [];
        let current = "";
        for (let k = 0; k < s.length; k++) {
            if (s[k] === "\\" && s[k + 1] === "|") {
                current += "|";
                k++;
            } else if (s[k] === "|") {
                cells.push(current.trim());
                current = "";
            } else {
                current += s[k];
            }
        }
        cells.push(current.trim());
        return cells;
    }

    function tableAtCursor() {
        const value = el.editor.value;
        const lines = value.split("\n");
        const cursorLine = value.slice(0, el.editor.selectionStart).split("\n").length - 1;
        const isRow = i => i >= 0 && i < lines.length && lines[i].trim() && lines[i].includes("|");
        if (!isRow(cursorLine)) return null;
        let top = cursorLine;
        let bottom = cursorLine;
        while (isRow(top - 1)) top--;
        while (isRow(bottom + 1)) bottom++;
        if (bottom - top < 1 || !TABLE_SEP.test(lines[top + 1])) return null;
        const start = lines.slice(0, top).reduce((sum, line) => sum + line.length + 1, 0);
        const text = lines.slice(top, bottom + 1).join("\n");
        return { start, end: start + text.length, lines: lines.slice(top, bottom + 1) };
    }

    function parseTableLines(lines) {
        const head = splitRow(lines[0]);
        const aligns = splitRow(lines[1]).map(cell => {
            const left = cell.startsWith(":");
            const right = cell.endsWith(":");
            return left && right ? "center" : right ? "right" : left ? "left" : "";
        });
        const cols = head.length;
        const rows = [head, ...lines.slice(2).map(splitRow)].map(row => Array.from({ length: cols }, (_, i) => row[i] || ""));
        return { rows, aligns: Array.from({ length: cols }, (_, i) => aligns[i] || "") };
    }

    function serializeTable(table) {
        const cell = text => text.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ").trim();
        const rows = table.rows.map(row => row.map(cell));
        const widths = table.aligns.map((_, c) => Math.max(3, ...rows.map(row => row[c].length)));
        const line = row => "| " + row.map((text, c) => text.padEnd(widths[c])).join(" | ") + " |";
        const sep = "| " + table.aligns.map((align, c) => {
            const dashes = "-".repeat(Math.max(3, widths[c] - (align === "center" ? 2 : align ? 1 : 0)));
            return align === "center" ? `:${dashes}:` : align === "left" ? `:${dashes}` : align === "right" ? `${dashes}:` : dashes;
        }).join(" | ") + " |";
        return [line(rows[0]), sep, ...rows.slice(1).map(line)].join("\n");
    }

    function openTableDialog() {
        if (!editorEnabled()) return;
        const found = tableAtCursor();
        const table = found
            ? parseTableLines(found.lines)
            : { rows: [["Column 1", "Column 2"], ["", ""], ["", ""]], aligns: ["", ""] };

        openDialog({
            title: found ? "Edit table" : "Table",
            confirmLabel: found ? "Update" : "Insert",
            wide: true,
            body: `
                <div class="creator-table-editor" id="tableEditor"></div>
                <div class="creator-row">
                    <button type="button" class="creator-small-btn" id="tableAddRow">Add row</button>
                    <button type="button" class="creator-small-btn" id="tableAddCol">Add column</button>
                    <span class="creator-hint">The first row is the header. You can paste cells copied from Excel.</span>
                </div>`,
            onOpen: form => {
                const editor = form.querySelector("#tableEditor");
                const draw = () => {
                    const cols = table.aligns.length;
                    editor.innerHTML = `
                        <table>
                            <thead><tr><th></th>${table.aligns.map((align, c) => `
                                <th>
                                    <select class="creator-input" data-align="${c}" title="Alignment">
                                        <option value=""${align === "" ? " selected" : ""}>Default</option>
                                        <option value="left"${align === "left" ? " selected" : ""}>Left</option>
                                        <option value="center"${align === "center" ? " selected" : ""}>Center</option>
                                        <option value="right"${align === "right" ? " selected" : ""}>Right</option>
                                    </select>
                                    <button type="button" class="creator-small-btn creator-danger" data-delcol="${c}"${cols === 1 ? " disabled" : ""} aria-label="Remove column">×</button>
                                </th>`).join("")}</tr></thead>
                            <tbody>${table.rows.map((row, r) => `
                                <tr>
                                    <td>${r === 0 ? `<span class="creator-row-label">Header</span>` : `<button type="button" class="creator-small-btn creator-danger" data-delrow="${r}"${table.rows.length === 2 ? " disabled" : ""} aria-label="Remove row">×</button>`}</td>
                                    ${row.map((text, c) => `<td><input class="creator-input" data-r="${r}" data-c="${c}" value="${esc(text)}"></td>`).join("")}
                                </tr>`).join("")}
                            </tbody>
                        </table>`;
                };

                editor.addEventListener("input", event => {
                    const input = event.target.closest("[data-r]");
                    if (input) table.rows[input.dataset.r][input.dataset.c] = input.value;
                });
                editor.addEventListener("change", event => {
                    const select = event.target.closest("[data-align]");
                    if (select) table.aligns[select.dataset.align] = select.value;
                });
                editor.addEventListener("click", event => {
                    const delRow = event.target.closest("[data-delrow]");
                    const delCol = event.target.closest("[data-delcol]");
                    if (delRow) {
                        table.rows.splice(Number(delRow.dataset.delrow), 1);
                        draw();
                    } else if (delCol) {
                        const c = Number(delCol.dataset.delcol);
                        table.aligns.splice(c, 1);
                        table.rows.forEach(row => row.splice(c, 1));
                        draw();
                    }
                });
                editor.addEventListener("paste", event => {
                    const input = event.target.closest("[data-r]");
                    const text = event.clipboardData.getData("text/plain");
                    if (!input || !/[\t\n]/.test(text.trim())) return;
                    event.preventDefault();
                    const startR = Number(input.dataset.r);
                    const startC = Number(input.dataset.c);
                    text.replace(/\r/g, "").replace(/\n+$/, "").split("\n").forEach((line, dr) => {
                        line.split("\t").forEach((value, dc) => {
                            const r = startR + dr;
                            const c = startC + dc;
                            while (table.aligns.length <= c) {
                                table.aligns.push("");
                                table.rows.forEach(row => row.push(""));
                            }
                            while (table.rows.length <= r) table.rows.push(table.aligns.map(() => ""));
                            table.rows[r][c] = value.trim();
                        });
                    });
                    draw();
                });
                form.querySelector("#tableAddRow").addEventListener("click", () => {
                    table.rows.push(table.aligns.map(() => ""));
                    draw();
                    const inputs = editor.querySelectorAll(`[data-r="${table.rows.length - 1}"]`);
                    if (inputs[0]) inputs[0].focus();
                });
                form.querySelector("#tableAddCol").addEventListener("click", () => {
                    table.aligns.push("");
                    table.rows.forEach((row, r) => row.push(r === 0 ? `Column ${table.aligns.length}` : ""));
                    draw();
                });
                draw();
                const first = editor.querySelector("[data-r]");
                if (first) first.focus();
            },
            onConfirm: () => {
                const markdown = serializeTable(table);
                if (found) replaceRange(found.start, found.end, markdown, markdown.length);
                else insertBlock(markdown);
            }
        });
    }

    // Loader, color, callout and tabs dialogs

    function openLoaderDialog() {
        if (!editorEnabled()) return;
        const found = matchAtCursor(LOADER_SOURCE);
        const active = new Set(found ? found.match[1].split(",").map(name => name.trim().toLowerCase()) : []);
        const names = Object.keys(state.loaders);
        openDialog({
            title: found ? "Edit loaders" : "Loader chips",
            confirmLabel: found ? "Update" : "Insert",
            body: names.length
                ? `<div class="creator-chips" id="loaderChips">${names.map(name => {
                    const color = state.loaders[name];
                    return `<button type="button" class="wiki-loader${active.has(name.toLowerCase()) ? " creator-on" : ""}" data-loader="${esc(name)}" style="color:${esc(color)};border-color:${esc(color)}" aria-pressed="${active.has(name.toLowerCase())}">${esc(name)}</button>`;
                }).join("")}</div>`
                : `<p class="creator-hint">content/loaders.json could not be loaded.</p>`,
            onOpen: form => {
                const chips = form.querySelector("#loaderChips");
                if (!chips) return;
                chips.addEventListener("click", event => {
                    const chip = event.target.closest("[data-loader]");
                    if (!chip) return;
                    const on = chip.classList.toggle("creator-on");
                    chip.setAttribute("aria-pressed", String(on));
                });
            },
            onConfirm: form => {
                const selected = [...form.querySelectorAll(".creator-on")].map(chip => chip.dataset.loader);
                if (!selected.length) {
                    toast("Select at least one loader.", true);
                    return false;
                }
                const markdown = `:loader[${selected.join(", ")}]`;
                if (found) replaceRange(found.start, found.end, markdown, markdown.length);
                else insertText(markdown);
            }
        });
    }

    function openColorDialog() {
        if (!editorEnabled()) return;
        const names = Object.keys(state.colors);
        const apply = name => wrap(`[${name}]`, "[/]", "text");
        openDialog({
            title: "Text color",
            confirmLabel: "Use custom color",
            body: `
                <div class="creator-swatches" id="colorSwatches">${names.map(name => `
                    <button type="button" class="creator-swatch" data-color="${esc(name)}">
                        <span class="creator-swatch-dot" style="background:${esc(state.colors[name])}"></span>
                        <span style="color:${esc(state.colors[name])}">${esc(name)}</span>
                    </button>`).join("")}
                </div>
                <div class="creator-field">
                    <span class="creator-label">Custom color</span>
                    <div class="creator-row">
                        <input type="color" id="colorPicker" value="#ff55ff">
                        <input id="colorHex" class="creator-input creator-input-small" value="#ff55ff" autocomplete="off">
                    </div>
                </div>`,
            onOpen: form => {
                const picker = form.querySelector("#colorPicker");
                const hex = form.querySelector("#colorHex");
                picker.addEventListener("input", () => { hex.value = picker.value; });
                hex.addEventListener("input", () => {
                    if (/^#[0-9a-f]{6}$/i.test(hex.value)) picker.value = hex.value;
                });
                form.querySelector("#colorSwatches").addEventListener("click", event => {
                    const swatch = event.target.closest("[data-color]");
                    if (!swatch) return;
                    el.dialog.close();
                    apply(swatch.dataset.color);
                });
            },
            onConfirm: form => {
                const hex = form.querySelector("#colorHex").value.trim();
                if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) {
                    toast("Enter a color like #ff55ff.", true);
                    return false;
                }
                apply(hex.toLowerCase());
            }
        });
    }

    function openCalloutDialog() {
        if (!editorEnabled()) return;
        const types = [["info", "Info"], ["tip", "Tip"], ["warning", "Warning"], ["danger", "Danger"]];
        let chosen = "info";
        openDialog({
            title: "Callout",
            confirmLabel: "Insert",
            body: `
                <div class="creator-callout-types" id="calloutTypes">${types.map(([value, label]) =>
                    `<button type="button" class="creator-small-btn" data-type="${value}" aria-pressed="${value === chosen}">${label}</button>`).join("")}
                </div>
                <div class="creator-field">
                    <label for="calloutTitle">Title (optional)</label>
                    <input id="calloutTitle" class="creator-input" autocomplete="off">
                </div>
                <div id="calloutPreview"></div>`,
            onOpen: form => {
                const draw = () => {
                    const title = form.querySelector("#calloutTitle").value.trim();
                    form.querySelector("#calloutPreview").innerHTML = WikiMarkdown.render(`::: ${chosen} ${title}\n${selectedText() || "Content"}\n:::`, { colors: state.colors, loaders: state.loaders });
                };
                form.querySelector("#calloutTypes").addEventListener("click", event => {
                    const button = event.target.closest("[data-type]");
                    if (!button) return;
                    chosen = button.dataset.type;
                    form.querySelectorAll("[data-type]").forEach(b => b.setAttribute("aria-pressed", String(b === button)));
                    draw();
                });
                form.querySelector("#calloutTitle").addEventListener("input", draw);
                draw();
            },
            onConfirm: form => {
                const title = form.querySelector("#calloutTitle").value.trim();
                containerBlock(`${chosen}${title ? " " + title : ""}`, "Content");
            }
        });
    }

    function openTabsDialog() {
        if (!editorEnabled()) return;
        openDialog({
            title: "Tabs",
            confirmLabel: "Insert",
            body: `
                <div class="creator-field">
                    <label for="tabNames">Tab names, separated by commas</label>
                    <input id="tabNames" class="creator-input" value="Fabric, Quilt" autocomplete="off">
                    <span class="creator-hint">Tabs with the same name switch together on the whole page.</span>
                </div>`,
            onOpen: form => form.querySelector("#tabNames").select(),
            onConfirm: form => {
                const names = form.querySelector("#tabNames").value.split(",").map(name => name.trim()).filter(Boolean);
                if (!names.length) {
                    toast("Enter at least one tab name.", true);
                    return false;
                }
                const first = selectedText() || `${names[0]} content`;
                const head = `::: tabs\n@tab ${names[0]}\n`;
                const rest = names.slice(1).map(name => `\n@tab ${name}\n${name} content`).join("");
                insertBlock(`${head}${first}${rest}\n:::`, head.length, head.length + first.length);
            }
        });
    }

    // Recipe, video and gallery dialogs

    const RECIPE_SLOTS = {
        crafting: [],
        furnace: [["input", "Input"], ["fuel", "Fuel"], ["result", "Result"]],
        brewing: [["ingredient", "Ingredient"], ["fuel", "Fuel"], ["input", "Input potion"], ["result", "Result potion"]]
    };
    const POTION_LABELS = { potion: "Potion", splash_potion: "Splash potion", lingering_potion: "Lingering potion" };

    function today() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    }

    function parseContainerText(text) {
        const lines = String(text || "").split("\n");
        const m = lines[0].match(/^\s*:::\s*([a-zA-Z][\w-]*)\+?\s*(.*)$/);
        if (!m) return null;
        const body = lines.slice(1);
        while (body.length && !body[body.length - 1].trim()) body.pop();
        if (body.length && /^\s*:::\s*$/.test(body[body.length - 1])) body.pop();
        return { type: m[1].toLowerCase(), args: m[2].trim(), body };
    }

    function containerAtCursor(types) {
        const value = el.editor.value;
        const lines = value.split("\n");
        const cursorLine = value.slice(0, el.editor.selectionStart).split("\n").length - 1;
        const stack = [];
        let fence = null;
        for (let i = 0; i <= cursorLine && i < lines.length; i++) {
            const line = lines[i];
            if (fence) {
                if (fenceCloses(line, fence)) fence = null;
                continue;
            }
            const f = line.match(FENCE);
            if (f) {
                fence = f[1];
                continue;
            }
            if (CONTAINER_OPEN.test(line)) stack.push(i);
            else if (CONTAINER_CLOSE.test(line) && i < cursorLine) stack.pop();
        }
        if (fence || !stack.length) return null;
        const open = stack[stack.length - 1];
        const m = lines[open].match(/^\s*:::\s*([a-zA-Z][\w-]*)\+?\s*(.*)$/);
        if (!m || !types.includes(m[1].toLowerCase())) return null;
        const end = containerEnd(lines, open + 1);
        const start = lines.slice(0, open).reduce((sum, line) => sum + line.length + 1, 0);
        const text = lines.slice(open, end + 1).join("\n");
        return { start, end: start + text.length, text };
    }

    function saveContainer(found) {
        return markdown => {
            if (found) replaceRange(found.start, found.end, markdown, markdown.length);
            else insertBlock(markdown);
        };
    }

    function previewInto(target, markdown) {
        target.innerHTML = WikiMarkdown.render(markdown, renderOptions());
        target.querySelectorAll(".wiki-anchor").forEach(anchor => anchor.remove());
        prepareImages(target);
        WikiMarkdown.enhance(target);
    }

    function serializeAlt(alt) {
        const head = alt.potion ? `${alt.potion} ${alt.color}` : alt.path;
        const name = alt.name ? ` "${alt.name.replace(/"/g, "'")}"` : "";
        return head + name + (alt.count > 1 ? ` x${alt.count}` : "");
    }

    function usableAlts(alts) {
        return (alts || []).filter(alt => alt.potion || alt.path);
    }

    function serializeSpec(alts) {
        return usableAlts(alts).map(serializeAlt).join(" | ");
    }

    function serializeRecipe(model) {
        const lines = [`::: ${model.type}${model.type === "crafting" && model.shapeless ? " shapeless" : ""}`];
        const s = model.slots;
        if (model.type === "crafting") {
            const keys = new Map();
            const letters = "ABCDEFGHI";
            const grid = [];
            for (let i = 0; i < 9; i++) {
                const spec = serializeSpec(s["g" + i]);
                if (!spec) {
                    grid.push(".");
                    continue;
                }
                if (!keys.has(spec)) keys.set(spec, letters[keys.size]);
                grid.push(keys.get(spec));
            }
            for (let r = 0; r < 3; r++) lines.push(grid.slice(r * 3, r * 3 + 3).join(" "));
            keys.forEach((letter, spec) => lines.push(`${letter}: ${spec}`));
        } else if (model.type === "furnace") {
            if (serializeSpec(s.input)) lines.push(`input: ${serializeSpec(s.input)}`);
            if (serializeSpec(s.fuel)) lines.push(`fuel: ${serializeSpec(s.fuel)}`);
        } else {
            if (serializeSpec(s.ingredient)) lines.push(`ingredient: ${serializeSpec(s.ingredient)}`);
            if (serializeSpec(s.fuel)) lines.push(`fuel: ${serializeSpec(s.fuel)}`);
            if (serializeSpec(s.input)) lines.push(`input: ${serializeSpec(s.input)}`);
        }
        if (serializeSpec(s.result)) lines.push(`=> ${serializeSpec(s.result)}`);
        lines.push(":::");
        return lines.join("\n");
    }

    function openRecipeDialog(text, onSave) {
        const parsed = parseContainerText(text);
        const start = parsed && ["crafting", "furnace", "brewing"].includes(parsed.type)
            ? WikiMarkdown.parseRecipe(parsed.type, parsed.args, parsed.body)
            : { type: "crafting", shapeless: false, slots: {} };
        const model = { type: start.type, shapeless: start.shapeless, slots: {} };
        Object.entries(start.slots).forEach(([key, alts]) => { model.slots[key] = alts ? alts.map(alt => ({ ...alt })) : null; });
        let selected = model.type === "crafting" ? "g0" : RECIPE_SLOTS[model.type][0][0];

        openDialog({
            title: parsed ? "Edit recipe" : "Recipe",
            confirmLabel: parsed ? "Update" : "Insert",
            wide: true,
            body: `
                <div class="creator-row creator-recipe-types" id="recipeTypes">
                    <button type="button" class="creator-small-btn" data-type="crafting">Crafting</button>
                    <button type="button" class="creator-small-btn" data-type="furnace">Furnace</button>
                    <button type="button" class="creator-small-btn" data-type="brewing">Brewing</button>
                    <label class="creator-check" id="recipeShapelessField"><input type="checkbox" id="recipeShapeless"> Shapeless</label>
                </div>
                <div class="wiki-article creator-recipe-preview" id="recipePreview"></div>
                <div class="creator-row creator-recipe-slots" id="recipeSlots"></div>
                <div class="creator-recipe-editor" id="recipeEditor"></div>`,
            onOpen: form => {
                const q = sel => form.querySelector(sel);
                const known = () => {
                    const names = new Map();
                    const spec = /(\S+\.(?:png|jpe?g|gif|webp|svg))\s+"([^"]+)"/gi;
                    docPages().forEach(doc => {
                        let m;
                        while ((m = spec.exec(doc.content))) if (!names.has(m[1])) names.set(m[1], m[2]);
                    });
                    Object.values(model.slots).forEach(alts => (alts || []).forEach(alt => {
                        if (alt.path && alt.name) names.set(alt.path, alt.name);
                    }));
                    return names;
                };

                const drawPreview = () => {
                    previewInto(q("#recipePreview"), serializeRecipe(model));
                    q("#recipePreview").querySelectorAll(".mc-slot").forEach(slot => {
                        const name = slot.dataset.slot.startsWith("bottle") ? "input" : slot.dataset.slot;
                        slot.classList.toggle("creator-slot-selected", name === selected);
                        slot.dataset.pick = name;
                    });
                };

                const drawSlots = () => {
                    q("#recipeTypes").querySelectorAll("[data-type]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.type === model.type)));
                    q("#recipeShapelessField").hidden = model.type !== "crafting";
                    q("#recipeShapeless").checked = !!model.shapeless;
                    const chips = model.type === "crafting"
                        ? [["result", "Result"]]
                        : RECIPE_SLOTS[model.type];
                    q("#recipeSlots").innerHTML = `<span class="creator-hint">${model.type === "crafting" ? "Click a slot in the grid, or:" : "Slot:"}</span>` + chips.map(([key, label]) =>
                        `<button type="button" class="creator-small-btn" data-slot-chip="${key}" aria-pressed="${key === selected}">${label}</button>`).join("");
                };

                const drawEditor = () => {
                    const alts = model.slots[selected] || [];
                    const isResult = selected === "result";
                    const label = selected.startsWith("g") ? `Grid slot ${Number(selected.slice(1)) + 1}` : (RECIPE_SLOTS[model.type].find(([key]) => key === selected) || ["", "Result"])[1];
                    q("#recipeEditor").innerHTML = `
                        <div class="creator-recipe-head">
                            <strong>${esc(label)}</strong>
                            <span class="creator-hint">${alts.length > 1 ? "The slot cycles through these items." : "Add more items to let the slot cycle through them."}</span>
                        </div>
                        ${alts.map((alt, i) => `
                            <div class="creator-alt" data-alt="${i}">
                                <div class="creator-row">
                                    <select class="creator-input creator-input-small" data-field="kind">
                                        <option value="image"${alt.potion ? "" : " selected"}>Image</option>
                                        ${Object.entries(POTION_LABELS).map(([value, text]) => `<option value="${value}"${alt.potion === value ? " selected" : ""}>${text}</option>`).join("")}
                                    </select>
                                    ${alt.potion ? `<input type="color" data-field="color" value="${esc(alt.color)}" title="Potion color">` : `<span class="creator-hint creator-alt-path">${esc(alt.path || "No image chosen")}</span>`}
                                    <input class="creator-input" data-field="name" placeholder="Name shown on hover" value="${esc(alt.name || "")}">
                                    ${isResult ? `<input type="number" min="1" max="64" class="creator-input creator-input-small" data-field="count" value="${alt.count || 1}" title="Amount">` : ""}
                                    <button type="button" class="creator-small-btn creator-danger" data-remove-alt="${i}" aria-label="Remove item">×</button>
                                </div>
                                ${alt.potion ? "" : `<div class="creator-picker" data-alt-picker="${i}">${pickerHtml(alt.path)}</div>`}
                            </div>`).join("")}
                        <div class="creator-row">
                            <button type="button" class="creator-small-btn" id="recipeAddAlt">${alts.length ? "Add alternative" : "Choose item"}</button>
                            <button type="button" class="creator-small-btn" id="recipeUpload">Upload image</button>
                            ${alts.length ? `<button type="button" class="creator-small-btn creator-danger" id="recipeClear">Clear slot</button>` : ""}
                            <input type="file" id="recipeFile" accept="image/*" hidden>
                        </div>`;
                };

                const drawAll = () => {
                    drawSlots();
                    drawPreview();
                    drawEditor();
                };

                const ensureAlt = () => {
                    if (!model.slots[selected] || !model.slots[selected].length) {
                        model.slots[selected] = [{ path: "", potion: model.type === "brewing" && (selected === "input" || selected === "result") ? "potion" : null, color: "#385dc6", name: "", count: 1 }];
                    }
                    return model.slots[selected];
                };

                q("#recipeTypes").addEventListener("click", event => {
                    const button = event.target.closest("[data-type]");
                    if (!button || button.dataset.type === model.type) return;
                    model.type = button.dataset.type;
                    const result = model.slots.result;
                    model.slots = { result };
                    selected = model.type === "crafting" ? "g0" : RECIPE_SLOTS[model.type][0][0];
                    drawAll();
                });

                q("#recipeShapeless").addEventListener("change", () => {
                    model.shapeless = q("#recipeShapeless").checked;
                    drawPreview();
                });

                q("#recipePreview").addEventListener("click", event => {
                    const slot = event.target.closest("[data-pick]");
                    if (!slot) return;
                    selected = slot.dataset.pick;
                    drawAll();
                });

                q("#recipeSlots").addEventListener("click", event => {
                    const chip = event.target.closest("[data-slot-chip]");
                    if (!chip) return;
                    selected = chip.dataset.slotChip;
                    drawAll();
                });

                const editor = q("#recipeEditor");

                editor.addEventListener("click", async event => {
                    const pick = event.target.closest("[data-pick]");
                    if (pick) {
                        const box = pick.closest("[data-alt-picker]");
                        const alt = model.slots[selected][Number(box.dataset.altPicker)];
                        alt.path = pick.dataset.pick;
                        if (!alt.name) alt.name = known().get(alt.path) || "";
                        drawPreview();
                        drawEditor();
                        return;
                    }
                    const remove = event.target.closest("[data-remove-alt]");
                    if (remove) {
                        model.slots[selected].splice(Number(remove.dataset.removeAlt), 1);
                        if (!model.slots[selected].length) model.slots[selected] = null;
                        drawPreview();
                        drawEditor();
                        return;
                    }
                    if (event.target.closest("#recipeAddAlt")) {
                        const alts = model.slots[selected];
                        if (alts && alts.length) alts.push({ path: "", potion: null, color: "#385dc6", name: "", count: 1 });
                        else ensureAlt();
                        drawEditor();
                        return;
                    }
                    if (event.target.closest("#recipeClear")) {
                        model.slots[selected] = null;
                        drawPreview();
                        drawEditor();
                        return;
                    }
                    if (event.target.closest("#recipeUpload")) q("#recipeFile").click();
                });

                editor.addEventListener("change", async event => {
                    if (event.target.id === "recipeFile") {
                        const file = event.target.files[0];
                        if (!file) return;
                        const path = await uploadImage(file, 0);
                        const alts = ensureAlt();
                        const empty = alts.find(alt => !alt.potion && !alt.path);
                        if (empty) empty.path = path;
                        else alts.push({ path, potion: null, color: "#385dc6", name: "", count: 1 });
                        drawPreview();
                        drawEditor();
                        return;
                    }
                    const row = event.target.closest("[data-alt]");
                    if (!row) return;
                    const alt = model.slots[selected][Number(row.dataset.alt)];
                    const field = event.target.dataset.field;
                    if (field === "kind") {
                        alt.potion = event.target.value === "image" ? null : event.target.value;
                        if (alt.potion && !alt.color) alt.color = "#385dc6";
                        drawEditor();
                    }
                    drawPreview();
                });

                editor.addEventListener("input", event => {
                    const row = event.target.closest("[data-alt]");
                    if (!row) return;
                    const alt = model.slots[selected][Number(row.dataset.alt)];
                    const field = event.target.dataset.field;
                    if (field === "name") alt.name = event.target.value;
                    else if (field === "count") alt.count = clamp(parseInt(event.target.value, 10) || 1, 1, 64);
                    else if (field === "color") alt.color = event.target.value;
                    else return;
                    drawPreview();
                });

                drawAll();
            },
            onConfirm: () => {
                if (!serializeSpec(model.slots.result) && model.type !== "brewing") {
                    toast("The recipe needs a result.", true);
                    return false;
                }
                onSave(serializeRecipe(model));
            }
        });
    }

    function openVideoDialog(text, onSave) {
        const parsed = parseContainerText(text);
        const [source = "", ...titleWords] = parsed ? parsed.args.split(/\s+/) : [];
        openDialog({
            title: parsed ? "Edit video" : "YouTube video",
            confirmLabel: parsed ? "Update" : "Insert",
            body: `
                <div class="creator-field">
                    <label for="videoUrl">YouTube link</label>
                    <input id="videoUrl" class="creator-input" value="${esc(source)}" placeholder="https://youtu.be/…" autocomplete="off">
                </div>
                <div class="creator-field">
                    <label for="videoTitle">Title</label>
                    <input id="videoTitle" class="creator-input" value="${esc(titleWords.join(" "))}" autocomplete="off">
                </div>
                <div class="creator-field">
                    <label for="videoDesc">Description (optional)</label>
                    <textarea id="videoDesc" class="creator-input" rows="3">${esc(parsed ? parsed.body.join("\n") : "")}</textarea>
                </div>
                <div class="wiki-article creator-block-preview" id="videoPreview"></div>`,
            onOpen: form => {
                const q = sel => form.querySelector(sel);
                const build = () => {
                    const desc = q("#videoDesc").value.trim();
                    return `::: youtube ${q("#videoUrl").value.trim()} ${q("#videoTitle").value.trim()}`.trim() + (desc ? `\n${desc}` : "") + "\n:::";
                };
                const draw = () => {
                    if (WikiMarkdown.youtubeId(q("#videoUrl").value)) previewInto(q("#videoPreview"), build());
                    else q("#videoPreview").innerHTML = `<p class="creator-empty">Paste a YouTube link to see the preview.</p>`;
                };
                form.addEventListener("input", debounce(draw, 200));
                form._build = build;
                draw();
                q("#videoUrl").focus();
            },
            onConfirm: form => {
                if (!WikiMarkdown.youtubeId(form.querySelector("#videoUrl").value)) {
                    toast("This is not a YouTube link.", true);
                    return false;
                }
                onSave(form._build());
            }
        });
    }

    function openGalleryDialog(text, onSave) {
        const parsed = parseContainerText(text);
        const re = /!\[([^\]]*)\]\(([^)\s]+)/;
        const items = parsed
            ? parsed.body.map(line => line.match(re)).filter(Boolean).map(m => ({ path: m[2], caption: m[1] }))
            : [];
        openDialog({
            title: parsed ? "Edit gallery" : "Gallery",
            confirmLabel: parsed ? "Update" : "Insert",
            wide: true,
            body: `
                <div class="creator-field">
                    <span class="creator-label">Click images to add them</span>
                    <div class="creator-picker" id="galleryPicker">${pickerHtml("")}</div>
                    <div class="creator-row">
                        <button type="button" class="creator-small-btn" id="galleryUpload">Upload images</button>
                        <input type="file" id="galleryFile" accept="image/*" multiple hidden>
                    </div>
                </div>
                <div class="creator-gallery-list" id="galleryList"></div>
                <div class="wiki-article creator-block-preview" id="galleryPreview"></div>`,
            onOpen: form => {
                const q = sel => form.querySelector(sel);
                const build = () => ["::: gallery", ...items.map(item => `![${item.caption.replace(/[[\]]/g, "")}](${item.path})`), ":::"].join("\n");
                const drawPreview = () => {
                    if (items.length) previewInto(q("#galleryPreview"), build());
                    else q("#galleryPreview").innerHTML = `<p class="creator-empty">Add at least one image.</p>`;
                };
                const drawList = () => {
                    q("#galleryList").innerHTML = items.map((item, i) => `
                        <div class="creator-gallery-item" data-item="${i}">
                            <img src="${esc(assetUrl(item.path))}" alt="">
                            <input class="creator-input" data-caption="${i}" placeholder="Caption" value="${esc(item.caption)}">
                            <button type="button" class="creator-small-btn" data-move="${i}" data-dir="-1"${i === 0 ? " disabled" : ""} aria-label="Move up">↑</button>
                            <button type="button" class="creator-small-btn" data-move="${i}" data-dir="1"${i === items.length - 1 ? " disabled" : ""} aria-label="Move down">↓</button>
                            <button type="button" class="creator-small-btn creator-danger" data-remove="${i}" aria-label="Remove">×</button>
                        </div>`).join("");
                    drawPreview();
                };
                q("#galleryPicker").addEventListener("click", event => {
                    const pick = event.target.closest("[data-pick]");
                    if (!pick) return;
                    items.push({ path: pick.dataset.pick, caption: "" });
                    drawList();
                });
                q("#galleryUpload").addEventListener("click", () => q("#galleryFile").click());
                q("#galleryFile").addEventListener("change", async () => {
                    const files = [...q("#galleryFile").files];
                    for (const file of files) items.push({ path: await uploadImage(file, 1600), caption: "" });
                    q("#galleryPicker").innerHTML = pickerHtml("");
                    drawList();
                });
                q("#galleryList").addEventListener("input", event => {
                    const input = event.target.closest("[data-caption]");
                    if (!input) return;
                    items[Number(input.dataset.caption)].caption = input.value;
                    drawPreview();
                });
                q("#galleryList").addEventListener("click", event => {
                    const move = event.target.closest("[data-move]");
                    const remove = event.target.closest("[data-remove]");
                    if (move) {
                        const i = Number(move.dataset.move);
                        const j = i + Number(move.dataset.dir);
                        [items[i], items[j]] = [items[j], items[i]];
                        drawList();
                    } else if (remove) {
                        items.splice(Number(remove.dataset.remove), 1);
                        drawList();
                    }
                });
                form._build = build;
                drawList();
            },
            onConfirm: form => {
                if (!items.length) {
                    toast("Add at least one image.", true);
                    return false;
                }
                onSave(form._build());
            }
        });
    }

    function recipeTool() {
        const found = containerAtCursor(["crafting", "furnace", "brewing"]);
        openRecipeDialog(found ? found.text : null, saveContainer(found));
    }

    function videoTool() {
        const found = containerAtCursor(["youtube"]);
        openVideoDialog(found ? found.text : null, saveContainer(found));
    }

    function galleryTool() {
        const found = containerAtCursor(["gallery"]);
        openGalleryDialog(found ? found.text : null, saveContainer(found));
    }

    // Preview

    let previewImages = [];
    let dragging = null;

    function findImageOccurrences(text) {
        const result = [];
        const re = new RegExp(IMAGE_SOURCE, "g");
        let fence = null;
        let inChangelog = false;
        let offset = 0;
        text.split("\n").forEach(line => {
            const f = line.match(FENCE);
            if (fence) {
                if (f && f[1][0] === fence[0] && f[1].length >= fence.length && !line.trim().slice(f[1].length).trim()) fence = null;
            } else if (f) {
                fence = f[1];
            } else if (inChangelog) {
                if (CONTAINER_CLOSE.test(line)) inChangelog = false;
            } else if (/^\s*:::\s*changelog\b/i.test(line)) {
                inChangelog = true;
            } else {
                const masked = line.replace(/``[\s\S]+?``|`[^`\n]+`/g, match => " ".repeat(match.length));
                re.lastIndex = 0;
                let m;
                while ((m = re.exec(masked))) {
                    if (m.index > 0 && masked[m.index - 1] === "\\") continue;
                    result.push({ start: offset + m.index, end: offset + m.index + m[0].length, match: m });
                }
            }
            offset += line.length + 1;
        });
        return result;
    }

    function activateTab(tab) {
        const list = tab.closest(".wiki-tab-list");
        const group = tab.closest(".wiki-tabs");
        list.querySelectorAll(":scope > .wiki-tab").forEach(other => {
            const active = other === tab;
            other.setAttribute("aria-selected", String(active));
            other.tabIndex = active ? 0 : -1;
            const panel = group.querySelector(`:scope > [id="${other.getAttribute("aria-controls")}"]`);
            if (!panel) return;
            const wasHidden = panel.hidden;
            panel.hidden = !active;
            if (active && wasHidden) {
                panel.classList.remove("wiki-fade-in");
                void panel.offsetWidth;
                panel.classList.add("wiki-fade-in");
            }
            WikiMarkdown.positionTabIndicator(list);
        });
    }

    function selectTab(tab) {
        const label = tab.textContent.trim().toLowerCase();
        activateTab(tab);
        const root = tab.closest(".wiki-article") || el.preview;
        root.querySelectorAll(".wiki-tab-list").forEach(list => {
            if (list.contains(tab)) return;
            const match = [...list.querySelectorAll(":scope > .wiki-tab")].find(other => other.textContent.trim().toLowerCase() === label);
            if (match) activateTab(match);
        });
    }

    function renderPreview() {
        const page = currentPage();
        const scroll = el.previewPane.scrollTop;
        const tabState = [...el.preview.querySelectorAll(".wiki-tab-list")]
            .map(list => [...list.children].findIndex(tab => tab.getAttribute("aria-selected") === "true"));
        const detailState = [...el.preview.querySelectorAll("details")].map(details => details.open);
        hideHandle();
        renderAssets();

        if (!page) {
            el.preview.innerHTML = `<p class="creator-empty">No page selected.</p>`;
            previewImages = [];
            return;
        }
        if (page.type === "section") {
            el.preview.innerHTML = `<h1>${esc(page.title)}</h1><p class="creator-empty">Sections only group pages in the sidebar.</p>`;
            previewImages = [];
            return;
        }

        let html = WikiMarkdown.render(page.content, {
            base: "",
            project: state.project.id || "project",
            colors: state.colors,
            loaders: state.loaders
        });
        if (!/^\s*<h1[\s>]/.test(html)) html = `<h1>${esc(page.title)}</h1>${html}`;
        el.preview.innerHTML = html;
        WikiMarkdown.enhance(el.preview);

        el.preview.querySelectorAll("img").forEach(img => {
            const src = img.getAttribute("src");
            const asset = state.assets.get(normalizeAsset(src));
            if (asset) {
                img.src = asset.url;
            } else if (!/^([a-z][a-z0-9+.-]*:|\/|\.\.\/)/i.test(src)) {
                img.classList.add("creator-missing");
                img.title = `${src} is not uploaded`;
            }
        });

        const lists = el.preview.querySelectorAll(".wiki-tab-list");
        if (lists.length === tabState.length) {
            lists.forEach((list, i) => {
                const tab = list.children[tabState[i]];
                if (tabState[i] > 0 && tab) activateTab(tab);
            });
        }
        const details = el.preview.querySelectorAll("details");
        if (details.length === detailState.length) {
            details.forEach((item, i) => { item.open = detailState[i]; });
        }

        indexImages(el.preview);
        el.previewPane.scrollTop = scroll;
    }

    function indexImages(root) {
        const page = currentPage();
        const images = [...root.querySelectorAll("img.wiki-img")];
        images.forEach(img => { delete img.dataset.creatorIndex; });
        previewImages = page && page.type === "page" && images.length === findImageOccurrences(page.content).length ? images : [];
        previewImages.forEach((img, i) => { img.dataset.creatorIndex = String(i); });
    }

    const schedulePreview = debounce(renderPreview, 150);

    function positionHandle(img) {
        const rect = img.getBoundingClientRect();
        const pane = el.previewPane.getBoundingClientRect();
        el.handle.style.left = `${rect.right - pane.left + el.previewPane.scrollLeft - 11}px`;
        el.handle.style.top = `${rect.bottom - pane.top + el.previewPane.scrollTop - 11}px`;
        const natural = img.naturalWidth ? ` / ${img.naturalWidth}px` : "";
        el.handleLabel.textContent = `${Math.round(rect.width)}px${natural}`;
    }

    function showHandle(img) {
        if (dragging) return;
        el.handle.dataset.index = img.dataset.creatorIndex;
        positionHandle(img);
        el.handle.hidden = false;
    }

    function hideHandle() {
        if (dragging) return;
        el.handle.hidden = true;
    }

    function setImageWidth(index, width) {
        const page = currentPage();
        if (!page) return;
        const occurrence = findImageOccurrences(page.content)[index];
        if (!occurrence) return;
        const m = occurrence.match;
        const list = parseAttrsRaw(m[4]);
        setAttr(list, "width", width ? String(width) : null);
        const title = m[3] ? ` "${m[3]}"` : "";
        const markdown = `![${m[1]}](${m[2]}${title})${serializeAttrs(list)}`;
        replaceRange(occurrence.start, occurrence.end, markdown, markdown.length);
    }

    function bindPreview() {
        el.preview.addEventListener("mouseover", event => {
            const img = event.target.closest("img.wiki-img[data-creator-index]");
            if (img && !img.closest(".wiki-gallery")) showHandle(img);
            else hideHandle();
        });

        el.previewPane.addEventListener("mouseleave", hideHandle);
        el.previewPane.addEventListener("scroll", () => {
            if (!el.handle.hidden && !dragging) hideHandle();
        });

        el.handle.addEventListener("pointerdown", event => {
            const img = previewImages[Number(el.handle.dataset.index)];
            if (!img) return;
            event.preventDefault();
            el.handle.setPointerCapture(event.pointerId);
            const style = getComputedStyle(el.preview);
            const maxWidth = el.preview.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
            dragging = { img, startX: event.clientX, startWidth: img.getBoundingClientRect().width, maxWidth, width: 0 };
        });

        el.handle.addEventListener("pointermove", event => {
            if (!dragging) return;
            dragging.width = clamp(Math.round(dragging.startWidth + event.clientX - dragging.startX), 16, Math.max(16, Math.round(dragging.maxWidth)));
            dragging.img.style.width = `${dragging.width}px`;
            positionHandle(dragging.img);
        });

        const finish = () => {
            if (!dragging) return;
            const { width } = dragging;
            const index = Number(el.handle.dataset.index);
            dragging = null;
            el.handle.hidden = true;
            if (width) setImageWidth(index, width);
        };
        el.handle.addEventListener("pointerup", finish);
        el.handle.addEventListener("pointercancel", finish);
        el.handle.addEventListener("dblclick", () => setImageWidth(Number(el.handle.dataset.index), null));

        el.preview.addEventListener("click", event => {
            const link = event.target.closest("a");
            if (link) {
                const href = link.getAttribute("href") || "";
                event.preventDefault();
                if (href.startsWith("#")) {
                    const target = el.preview.querySelector(`[id="${CSS.escape(decodeURIComponent(href.slice(1)))}"]`);
                    if (target) target.scrollIntoView({ block: "start" });
                } else if (link.hasAttribute("data-wiki-link")) {
                    const url = new URL(href, location.href);
                    const [project, file] = (url.searchParams.get("p") || "").split("/");
                    const page = docPages().find(doc => doc.file === file);
                    if (project === (state.project.id || "project") && page) {
                        selectPage(page.uid);
                        if (url.hash) {
                            const target = el.preview.querySelector(`[id="${CSS.escape(decodeURIComponent(url.hash.slice(1)))}"]`);
                            if (target) target.scrollIntoView({ block: "start" });
                        }
                    } else {
                        toast(`The link points to "${project}/${file || ""}", which is not a page of this project.`, true);
                    }
                } else if (/^https?:/i.test(link.href)) {
                    window.open(link.href, "_blank", "noopener");
                }
                return;
            }

            const tab = event.target.closest(".wiki-tab");
            if (tab) {
                selectTab(tab);
                return;
            }

            const copy = event.target.closest(".wiki-copy");
            if (copy) {
                const code = copy.parentElement.querySelector("code");
                navigator.clipboard.writeText(code.textContent).then(() => toast("Code copied."), () => toast("Copying failed.", true));
            }
        });
    }

    // Visual editor

    const MODE_KEY = "pixelalex-wiki-creator-mode";
    const TOKEN_START = "\uE000";
    const TOKEN_END = "\uE001";
    const TOKENS = /[\uE000\uE001]/g;
    const TEXT_KINDS = new Set(["paragraph", "heading", "list", "quote"]);
    const HR_LINE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
    const LIST_START = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
    const QUOTE_LINE = /^\s{0,3}>\s?(.*)$/;
    const LIST_LINE_PARTS = /^(\s*)([-*+]|\d+[.)])(\s+)(\[[ xX]\]\s+)?(.*)$/;
    const IMAGE_ONLY = /^!\[[^\]]*\]\([^)\s]+(?:\s+"[^"]*")?\)(?:\{[^}]*\})?$/;
    const PREFIX_TOKENS = /^([\uE000\uE001]+)(\s*(?:#{1,6}\s+|>\s?|(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?))/;
    const BLOCK_TAGS = new Set(["P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "BLOCKQUOTE", "TABLE", "PRE"]);
    const LINE_TOOLS = new Set(["H1", "H2", "H3", "H4", "H5", "H6", "List", "1.", "Task", "Quote"]);
    const ALIGN_SUFFIX = /\s*\{\.(left|center|right)\}\s*$/;
    const PLACEHOLDERS = { paragraph: "Type something, or use + for more blocks", heading: "Heading", list: "List item", quote: "Quote" };

    const visual = {
        blocks: [],
        kinds: [],
        history: new Map(),
        restoring: false,
        syncTimer: null,
        dragIndex: null,
        rendering: false,
        menu: null,
        colorNames: new Map()
    };

    function isVisual() {
        return state.mode === "visual";
    }

    function strip(text) {
        return text.replace(TOKENS, "");
    }

    function hasToken(text) {
        return /[\uE000\uE001]/.test(text);
    }

    function indentOf(line) {
        return line.match(/^\s*/)[0].length;
    }

    function blockIndex(blockEl) {
        return [...el.visual.querySelectorAll(":scope > .creator-vblock")].indexOf(blockEl);
    }

    function renderOptions() {
        return { base: "", project: state.project.id || "project", colors: state.colors, loaders: state.loaders };
    }

    function buildColorNames() {
        visual.colorNames.clear();
        Object.entries(state.colors).forEach(([name, value]) => {
            const hex = cssToHex(String(value));
            if (hex && !visual.colorNames.has(hex)) visual.colorNames.set(hex, name);
        });
    }

    function cssToHex(value) {
        const v = value.trim().toLowerCase();
        if (/^#[0-9a-f]{6}$/.test(v)) return v;
        if (/^#[0-9a-f]{3}$/.test(v)) return "#" + v.slice(1).split("").map(c => c + c).join("");
        const m = v.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (m) return "#" + m.slice(1, 4).map(n => Number(n).toString(16).padStart(2, "0")).join("");
        return null;
    }

    // Block splitting

    function fenceCloses(line, marker) {
        const m = line.match(/^\s*(`{3,}|~{3,})\s*$/);
        return !!m && m[1][0] === marker[0] && m[1].length >= marker.length;
    }

    function containerEnd(lines, start) {
        let depth = 0;
        let fence = null;
        for (let i = start; i < lines.length; i++) {
            const line = strip(lines[i]);
            if (fence) {
                if (fenceCloses(line, fence)) fence = null;
                continue;
            }
            const f = line.match(FENCE);
            if (f) {
                fence = f[1];
                continue;
            }
            if (CONTAINER_OPEN.test(line)) depth++;
            else if (CONTAINER_CLOSE.test(line)) {
                if (depth === 0) return i;
                depth--;
            }
        }
        return lines.length - 1;
    }

    function tableStartsAt(lines, i) {
        if (i + 1 >= lines.length) return false;
        const head = strip(lines[i]);
        const sep = strip(lines[i + 1]);
        return head.includes("|") && sep.includes("|") && TABLE_SEP.test(sep);
    }

    function startsBlock(lines, i) {
        const line = strip(lines[i]);
        return FENCE.test(line) || CONTAINER_OPEN.test(line) || HEADING.test(line) || HR_LINE.test(line)
            || QUOTE_LINE.test(line) || LIST_START.test(line) || tableStartsAt(lines, i);
    }

    function listEnd(lines, start) {
        const base = strip(lines[start]).match(LIST_START)[1].length;
        let i = start + 1;
        while (i < lines.length) {
            const line = strip(lines[i]);
            if (!line.trim()) {
                let j = i + 1;
                while (j < lines.length && !strip(lines[j]).trim()) j++;
                if (j >= lines.length) break;
                const next = strip(lines[j]);
                const m = next.match(LIST_START);
                if (indentOf(next) > base + 1 || (m && m[1].length >= base)) {
                    i = j;
                    continue;
                }
                break;
            }
            const m = line.match(LIST_START);
            if (m) {
                if (m[1].length < base) break;
                i++;
                continue;
            }
            if (indentOf(line) > base) {
                i++;
                continue;
            }
            break;
        }
        return i;
    }

    function splitBlocks(md) {
        const lines = md.replace(/\r\n?/g, "\n").split("\n");
        const blocks = [];
        let i = 0;
        while (i < lines.length) {
            if (!lines[i].trim()) {
                i++;
                continue;
            }
            const start = i;
            const line = strip(lines[i]);
            let kind;
            let f;
            if ((f = line.match(FENCE))) {
                kind = "code";
                i++;
                while (i < lines.length && !fenceCloses(strip(lines[i]), f[1])) i++;
                i++;
            } else if (CONTAINER_OPEN.test(line)) {
                kind = "container";
                i = containerEnd(lines, i + 1) + 1;
            } else if (HEADING.test(line)) {
                kind = "heading";
                i++;
            } else if (HR_LINE.test(line)) {
                kind = "hr";
                i++;
            } else if (QUOTE_LINE.test(line)) {
                kind = "quote";
                while (i < lines.length && strip(lines[i]).trim() && QUOTE_LINE.test(strip(lines[i]))) i++;
            } else if (LIST_START.test(line)) {
                kind = "list";
                i = listEnd(lines, i);
            } else if (tableStartsAt(lines, i)) {
                kind = "table";
                i += 2;
                while (i < lines.length && strip(lines[i]).trim() && strip(lines[i]).includes("|")) i++;
            } else {
                kind = "paragraph";
                i++;
                while (i < lines.length && lines[i].trim() && !startsBlock(lines, i)) i++;
            }
            let text = lines.slice(start, Math.min(i, lines.length)).join("\n").replace(/\n+$/, "");
            if (kind === "paragraph" && IMAGE_ONLY.test(strip(text).trim())) kind = "image";
            if (TEXT_KINDS.has(kind)) text = text.split("\n").map(row => row.replace(PREFIX_TOKENS, "$2$1")).join("\n");
            blocks.push({ text, kind });
        }
        return blocks;
    }

    function joinBlocks(blocks) {
        return blocks.map(strip).filter(text => text.trim()).join("\n\n");
    }

    // HTML to Markdown

    function escapeText(text) {
        return text.replace(/\u00a0/g, " ").replace(/\n/g, " ").replace(/[\\`*~[\]|{]/g, "\\$&");
    }

    function escapeLineStarts(text) {
        return text.split("\n").map(line => {
            if (HR_LINE.test(strip(line))) return "\\" + line;
            return line
                .replace(/^([\s\uE000\uE001]*)#/, "$1\\#")
                .replace(/^([\s\uE000\uE001]*)-(?=\s)/, "$1\\-")
                .replace(/^([\s\uE000\uE001]*):::/, "$1\\:::")
                .replace(/^([\s\uE000\uE001]*)(?=>|\+\s|\d+[.)]\s)/, "$1\u200B");
        }).join("\n");
    }

    function marks(mark, inner) {
        if (!inner.replace(/[\s\uE000\uE001]/g, "")) return inner;
        const lead = inner.match(/^\s*/)[0];
        const trail = inner.match(/\s*$/)[0];
        return lead + mark + inner.slice(lead.length, inner.length - trail.length) + mark + trail;
    }

    function codeMarkdown(text) {
        const value = text.replace(/\u00a0/g, " ");
        if (!value) return "";
        return value.includes("`") ? "`` " + value + " ``" : "`" + value + "`";
    }

    function linkTarget(link) {
        const href = link.getAttribute("href") || "";
        if (!link.hasAttribute("data-wiki-link")) return strip(href) || "#";
        const url = new URL(href, location.href);
        const [project, file] = (url.searchParams.get("p") || "").split("/");
        const target = project === (state.project.id || "project") ? (file || "") + url.hash : `${project}/${file || ""}${url.hash}`;
        return strip(target) || "#";
    }

    function imageMarkdown(img, figure) {
        if (!img) return "";
        const list = [];
        const width = img.style.width;
        const height = img.style.height;
        if (width) list.push(["width", width.endsWith("px") ? String(parseFloat(width)) : width]);
        if (height) list.push(["height", height.endsWith("px") ? String(parseFloat(height)) : height]);
        if (figure) {
            const align = ["left", "center", "right"].find(name => figure.classList.contains(`wiki-align-${name}`));
            if (align) list.push(["align", align]);
            const caption = figure.querySelector(".wiki-caption");
            if (caption && caption.textContent.trim()) list.push(["caption", caption.textContent.trim()]);
        }
        if (img.classList.contains("wiki-pixelated")) list.push(["pixelated", true]);
        if (img.classList.contains("wiki-no-zoom")) list.push(["nozoom", true]);
        const title = img.getAttribute("title") || "";
        const alt = (img.getAttribute("alt") || "").replace(/[[\]]/g, "");
        return `![${alt}](${img.dataset.mdSrc || img.getAttribute("src")}${title ? ` "${title}"` : ""})${serializeAttrs(list)}`;
    }

    function iconMarkdown(img) {
        const list = [];
        const height = img.style.height;
        if (height) list.push(["size", height.endsWith("px") ? String(parseFloat(height)) : height]);
        return `:icon[${img.dataset.mdSrc || img.getAttribute("src")}]${serializeAttrs(list)}`;
    }

    function inlineText(node, ctx) {
        return [...node.childNodes].map(child => serializeInline(child, ctx)).join("");
    }

    function serializeInline(node, ctx) {
        if (node.nodeType === 3) return escapeText(node.nodeValue);
        if (node.nodeType !== 1) return "";
        const tag = node.tagName;
        if (node.classList.contains("wiki-anchor") || tag === "INPUT") return "";
        if (tag === "BR") return "\n";
        if (node.classList.contains("wiki-figure")) return imageMarkdown(node.querySelector("img"), node);
        if (tag === "IMG") return node.classList.contains("wiki-icon") ? iconMarkdown(node) : imageMarkdown(node, null);
        if (node.classList.contains("wiki-loader")) return `:loader[${node.textContent.trim()}]`;
        if (tag === "STRONG" || tag === "B") return ctx.bold ? inlineText(node, ctx) : marks("**", inlineText(node, { ...ctx, bold: true }));
        if (tag === "EM" || tag === "I") return ctx.italic ? inlineText(node, ctx) : marks("*", inlineText(node, { ...ctx, italic: true }));
        if (tag === "DEL" || tag === "S" || tag === "STRIKE") return ctx.strike ? inlineText(node, ctx) : marks("~~", inlineText(node, { ...ctx, strike: true }));
        if (tag === "CODE") return codeMarkdown(node.textContent);
        if (tag === "A") return `[${inlineText(node, ctx).replace(/\n/g, " ")}](${linkTarget(node)})`;
        if (tag === "SPAN" && /^\s*color:\s*[^;]+;?\s*$/i.test(node.getAttribute("style") || "")) {
            const hex = cssToHex(node.style.color);
            if (hex) return `[${visual.colorNames.get(hex) || hex}]${inlineText(node, ctx)}[/]`;
        }
        if (BLOCK_TAGS.has(tag)) return "\n" + inlineText(node, ctx) + "\n";
        return inlineText(node, ctx);
    }

    function finishParagraph(text) {
        return escapeLineStarts(text.replace(/^\n+|\n+$/g, ""));
    }

    function serializeList(list, indent) {
        const ordered = list.tagName === "OL";
        let number = parseInt(list.getAttribute("start") || "1", 10) || 1;
        const lines = [];
        [...list.children].forEach(item => {
            const marker = ordered ? `${number++}. ` : "- ";
            const box = item.querySelector(":scope > input[type=checkbox]");
            const task = box ? (box.checked ? "[x] " : "[ ] ") : "";
            const pad = indent + " ".repeat(marker.length);
            let text = "";
            const nested = [];
            item.childNodes.forEach(child => {
                if (child.nodeType === 1 && (child.tagName === "UL" || child.tagName === "OL")) {
                    nested.push(serializeList(child, pad));
                } else if (child.nodeType === 1 && (child.tagName === "P" || child.tagName === "DIV")) {
                    text += (text ? "\n" : "") + inlineText(child, {});
                } else {
                    text += serializeInline(child, {});
                }
            });
            const body = escapeLineStarts(text.replace(/^\n+|\n+$/g, "")).split("\n").join("\n" + pad);
            lines.push(indent + marker + task + body);
            nested.forEach(block => lines.push(block));
        });
        return lines.join("\n");
    }

    function serializeBlockNode(node) {
        const tag = node.tagName;
        if (/^H[1-6]$/.test(tag)) return "#".repeat(Number(tag[1])) + " " + inlineText(node, {}).replace(/\n+/g, " ").trim() + alignSuffix(node);
        if (tag === "UL" || tag === "OL") return serializeList(node, "");
        if (tag === "BLOCKQUOTE") return serializeBlocks(node).split("\n").map(line => line ? `> ${line}` : ">").join("\n");
        if (tag === "TABLE" || tag === "PRE") return "";
        if ([...node.children].some(child => BLOCK_TAGS.has(child.tagName))) return serializeBlocks(node);
        const text = finishParagraph(inlineText(node, {}));
        return text.replace(/[\s\u200B]/g, "") ? text + alignSuffix(node) : text;
    }

    function alignSuffix(node) {
        const align = ["center", "right"].find(name => node.classList.contains(`wiki-text-${name}`));
        return align ? ` {.${align}}` : "";
    }

    function serializeBlocks(container) {
        const parts = [];
        let inline = "";
        const flush = () => {
            const text = finishParagraph(inline);
            if (text.replace(/[\s\u200B]/g, "")) parts.push(text);
            inline = "";
        };
        container.childNodes.forEach(node => {
            if (node.nodeType === 1 && BLOCK_TAGS.has(node.tagName)) {
                flush();
                const md = serializeBlockNode(node);
                if (md.replace(/[\s\u200B]/g, "")) parts.push(md);
            } else {
                inline += serializeInline(node, {});
            }
        });
        flush();
        return parts.join("\n\n");
    }

    function currentRange() {
        const selection = getSelection();
        return selection.rangeCount ? selection.getRangeAt(0) : null;
    }

    function serializeWithTokens(body, range) {
        const inserted = [];
        const r = range || currentRange();
        if (r && body.contains(r.startContainer)) {
            if (!r.collapsed) {
                const end = r.cloneRange();
                end.collapse(false);
                const endNode = document.createTextNode(TOKEN_END);
                end.insertNode(endNode);
                inserted.push(endNode);
            }
            const start = r.cloneRange();
            start.collapse(true);
            const startNode = document.createTextNode(TOKEN_START);
            start.insertNode(startNode);
            inserted.push(startNode);
        }
        const md = serializeBlocks(body);
        inserted.forEach(node => {
            const parent = node.parentNode;
            node.remove();
            if (parent) parent.normalize();
        });
        return md;
    }

    // Rendering

    function prepareImages(root) {
        root.querySelectorAll("*").forEach(node => {
            [...node.attributes].forEach(attr => {
                if (hasToken(attr.value)) node.setAttribute(attr.name, strip(attr.value));
            });
        });
        root.querySelectorAll("img").forEach(img => {
            const src = img.getAttribute("src");
            img.dataset.mdSrc = src;
            img.draggable = false;
            const asset = state.assets.get(normalizeAsset(src));
            if (asset) img.src = asset.url;
            else if (!/^([a-z][a-z0-9+.-]*:|\/|\.\.\/)/i.test(src)) img.classList.add("creator-missing");
        });
    }

    function updatePlaceholder(body, kind) {
        const empty = !body.textContent.replace(/[\s\u200B\uE000\uE001]/g, "") && !body.querySelector("img, .wiki-loader, input");
        body.classList.toggle("creator-vempty", empty);
        body.dataset.placeholder = PLACEHOLDERS[kind] || "";
    }

    function ensureEditable(body, kind) {
        if (!body.firstElementChild) body.innerHTML = "<p><br></p>";
        body.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, blockquote").forEach(node => {
            if (!node.textContent.replace(/[\u200B\uE000\uE001]/g, "").length && !node.querySelector("img, br, .wiki-loader, ul, ol, p")) {
                node.appendChild(document.createElement("br"));
            }
        });
        updatePlaceholder(body, kind);
    }

    function createVisualBlock(text, kind) {
        const special = !TEXT_KINDS.has(kind);
        const block = document.createElement("div");
        block.className = "creator-vblock" + (special ? " creator-special" : "");
        block.dataset.kind = kind;
        block.innerHTML = `
            <div class="creator-vblock-gutter" contenteditable="false">
                <button type="button" class="creator-vbtn" data-vaction="add" title="Add a block below">+</button>
                <span class="creator-vbtn creator-vdrag" draggable="true" title="Drag to move">≡</span>
            </div>
            <div class="creator-vblock-actions" contenteditable="false">
                ${special ? `<button type="button" class="creator-vbtn" data-vaction="edit">Edit</button>` : ""}
                <button type="button" class="creator-vbtn creator-vbtn-danger" data-vaction="delete" title="Delete block">×</button>
            </div>
            <div class="creator-vblock-body"></div>`;
        const body = block.querySelector(".creator-vblock-body");
        const source = special ? strip(text) : text;
        body.innerHTML = source.trim() ? WikiMarkdown.render(source, renderOptions()) : "";
        body.querySelectorAll(".wiki-anchor").forEach(anchor => anchor.remove());
        prepareImages(body);
        WikiMarkdown.enhance(body);
        if (!special) {
            body.contentEditable = "true";
            body.spellcheck = true;
            body.querySelectorAll("img, .wiki-loader, .wiki-figure").forEach(node => { node.contentEditable = "false"; });
            body.querySelectorAll("input[type=checkbox]").forEach(box => {
                box.disabled = false;
                box.contentEditable = "false";
            });
            ensureEditable(body, kind);
        }
        return block;
    }

    function placeTokens(root) {
        const found = {};
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(node => {
            let index;
            while ((index = node.nodeValue.search(/[\uE000\uE001]/)) !== -1) {
                const key = node.nodeValue[index] === TOKEN_START ? "start" : "end";
                node.deleteData(index, 1);
                if (!found[key]) found[key] = { node, offset: index };
            }
        });
        root.querySelectorAll(".creator-vblock-body[contenteditable=true]").forEach(body => ensureEditable(body, body.parentElement.dataset.kind));
        if (!found.start) return;
        const body = found.start.node.parentElement && found.start.node.parentElement.closest(".creator-vblock-body");
        if (!body || !body.isContentEditable) return;
        body.focus({ preventScroll: true });
        const range = document.createRange();
        range.setStart(found.start.node, found.start.offset);
        if (found.end && found.end.node.isConnected) range.setEnd(found.end.node, found.end.offset);
        else range.collapse(true);
        const selection = getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        const target = found.start.node.parentElement;
        if (target) target.scrollIntoView({ block: "nearest" });
    }

    function renderVisualBlocks(texts) {
        const page = currentPage();
        const expanded = [];
        texts.forEach(text => {
            if (!strip(text).trim()) expanded.push({ text, kind: "paragraph" });
            else expanded.push(...splitBlocks(text));
        });
        if (!expanded.length) expanded.push({ text: "", kind: "paragraph" });
        visual.blocks = expanded.map(block => strip(block.text));
        visual.kinds = expanded.map(block => block.kind);

        visual.rendering = true;
        const first = expanded[0];
        const hasTitle = first.kind === "heading" && /^\s*#\s/.test(strip(first.text));
        el.visual.innerHTML = hasTitle ? "" : `<h1 class="creator-vtitle" title="Change it in the page settings">${esc(page.title)}</h1>`;
        expanded.forEach(block => el.visual.appendChild(createVisualBlock(block.text, block.kind)));
        const add = document.createElement("button");
        add.type = "button";
        add.className = "creator-vadd-end";
        add.dataset.vaction = "add-end";
        add.textContent = "+ Add block";
        el.visual.appendChild(add);
        visual.rendering = false;
        placeTokens(el.visual);
    }

    function renderVisual() {
        closeInsertMenu();
        const page = currentPage();
        if (!page || page.type !== "page") {
            visual.blocks = [];
            visual.kinds = [];
            el.visual.innerHTML = page
                ? `<h1>${esc(page.title)}</h1><p class="creator-empty">Sections only group pages in the sidebar.</p>`
                : `<p class="creator-empty">No page selected.</p>`;
            return;
        }
        renderVisualBlocks([page.content]);
        indexImages(el.visual);
        pushHistory();
    }

    function updateVisualTitle() {
        const title = el.visual.querySelector(".creator-vtitle");
        const page = currentPage();
        if (title && page) title.textContent = page.title;
    }

    function syncFromVisual(immediateHistory) {
        const page = currentPage();
        if (!page || page.type !== "page") return;
        const content = joinBlocks(visual.blocks);
        if (page.content !== content) {
            page.content = content;
            el.editor.value = content;
            changed();
            scheduleAssets();
        }
        indexImages(el.visual);
        if (immediateHistory) pushHistory();
        else scheduleHistory();
    }

    function rebuildVisual(texts) {
        pushHistory();
        renderVisualBlocks(texts);
        syncFromVisual(true);
    }

    function replaceAt(index, items) {
        const texts = visual.blocks.slice();
        texts.splice(index, 1, ...items);
        return texts;
    }

    function rebuildFromEditor() {
        if (!isVisual() || !editorEnabled()) return;
        const value = el.editor.value;
        const start = el.editor.selectionStart;
        const end = el.editor.selectionEnd;
        const md = start === end
            ? value.slice(0, start) + TOKEN_START + value.slice(start)
            : value.slice(0, start) + TOKEN_START + value.slice(start, end) + TOKEN_END + value.slice(end);
        renderVisualBlocks([md]);
        syncFromVisual(true);
    }

    function scheduleVisualFromEditor() {
        clearTimeout(visual.syncTimer);
        visual.syncTimer = setTimeout(rebuildFromEditor, 0);
    }

    const scheduleAssets = debounce(renderAssets, 300);

    // Editing

    function blockKind(text) {
        const clean = strip(text);
        if (!clean.trim()) return "paragraph";
        const blocks = splitBlocks(clean);
        return blocks.length ? blocks[0].kind : "paragraph";
    }

    function commitBlock(blockEl) {
        const index = blockIndex(blockEl);
        if (index === -1) return;
        const body = blockEl.querySelector(".creator-vblock-body");
        const kind = blockEl.dataset.kind;
        const text = body.textContent.replace(/\u00a0/g, " ");
        if (kind === "paragraph" && /^(#{1,6} |[-*+] |\d+[.)] |> |\[ \] )/.test(text)) {
            const md = serializeWithTokens(body)
                .replace(/^\\\[ \\\] /, "- [ ] ")
                .replace(/^\\\* /, "* ")
                .replace(/^\\(?=[#-])/, "")
                .replace(/^\u200B/, "");
            rebuildVisual(replaceAt(index, [md]));
            return;
        }
        const md = serializeBlocks(body);
        visual.blocks[index] = md;
        updatePlaceholder(body, kind);
        const parsed = strip(md).trim() ? splitBlocks(md) : [{ kind: "paragraph" }];
        if (parsed.length > 1 || parsed[0].kind !== kind) {
            rebuildVisual(replaceAt(index, [serializeWithTokens(body)]));
            return;
        }
        syncFromVisual(false);
    }

    function splitListOnEnter(md) {
        const lines = md.split("\n");
        const row = lines.findIndex(line => line.includes(TOKEN_START));
        const m = row === -1 ? null : lines[row].match(LIST_LINE_PARTS);
        if (!m) return [md.replace(TOKEN_START, "\n" + TOKEN_START)];
        const [before, after] = m[5].split(TOKEN_START);
        if (!before.trim() && !after.trim()) {
            if (m[1].length) {
                lines[row] = " ".repeat(Math.max(0, m[1].length - 4)) + m[2] + m[3] + (m[4] || "") + TOKEN_START;
                return [lines.join("\n")];
            }
            const head = lines.slice(0, row).join("\n");
            const tail = lines.slice(row + 1).join("\n");
            return [head, TOKEN_START, tail].filter((text, i) => i === 1 || text.trim());
        }
        let marker = m[2];
        if (/\d/.test(marker)) marker = (parseInt(marker, 10) + 1) + marker.slice(-1);
        lines[row] = m[1] + m[2] + m[3] + (m[4] || "") + before;
        lines.splice(row + 1, 0, m[1] + marker + m[3] + (m[4] ? "[ ] " : "") + TOKEN_START + after);
        return [lines.join("\n")];
    }

    function splitOnEnter(md, kind) {
        if (kind === "list") return splitListOnEnter(md);
        const align = md.match(ALIGN_SUFFIX);
        if (align && (kind === "paragraph" || kind === "heading")) {
            const parts = splitOnEnter(md.replace(ALIGN_SUFFIX, ""), kind);
            return parts.map((part, i) => {
                if (!strip(part).trim() && !hasToken(part)) return part;
                if (kind === "heading" && i > 0 && !/^\s*#/.test(strip(part))) return part;
                return part + align[0];
            });
        }
        const at = md.indexOf(TOKEN_START);
        if (at === -1) return [md, TOKEN_START];
        const before = md.slice(0, at);
        const after = md.slice(at + 1);
        if (kind === "heading") {
            if (!before.replace(/^\s*#{1,6}\s*/, "").trim() && after.trim()) return ["", before + TOKEN_START + after];
            return [before, TOKEN_START + after.trim()];
        }
        if (kind === "quote") {
            if (!after.trim()) return [before.replace(/\n>\s*$/, ""), TOKEN_START];
            return [before.replace(/\n>\s*$/, ""), "> " + TOKEN_START + after.replace(/^\s+/, "")];
        }
        if (!before.trim()) return ["", TOKEN_START + after];
        return [before.replace(/\n+$/, ""), TOKEN_START + after.replace(/^\n+/, "")];
    }

    function indentListLine(md, outdent) {
        const lines = md.split("\n");
        const row = lines.findIndex(line => line.includes(TOKEN_START));
        if (row === -1) return md;
        if (outdent) lines[row] = lines[row].replace(/^ {1,4}/, "");
        else if (row > 0) lines[row] = "    " + lines[row];
        return lines.join("\n");
    }

    function caretAtStart(body) {
        const range = currentRange();
        if (!range) return false;
        const before = document.createRange();
        before.selectNodeContents(body);
        before.setEnd(range.startContainer, range.startOffset);
        const fragment = before.cloneContents();
        return !fragment.textContent.replace(/[\u200B\uE000\uE001]/g, "").length && !fragment.querySelector("img, .wiki-loader, input");
    }

    function backspaceAtStart(index, kind, body) {
        const md = serializeWithTokens(body);
        if (kind === "heading") return replaceAt(index, [md.replace(/^(\s*)#{1,6}\s+/, "")]);
        if (kind === "quote") return replaceAt(index, [md.split("\n").map(line => line.replace(/^\s{0,3}>\s?/, "")).join("\n")]);
        if (kind === "list") {
            const lines = md.split("\n");
            lines[0] = lines[0].replace(/^(\s*)([-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?/, "");
            return replaceAt(index, [lines.join("\n")]);
        }
        if (index === 0) return null;
        const prevKind = visual.kinds[index - 1];
        const texts = visual.blocks.slice();
        if (!strip(md).trim()) {
            texts.splice(index, 1);
            if (TEXT_KINDS.has(prevKind)) texts[index - 1] = texts[index - 1] + TOKEN_START;
            return texts;
        }
        if (!TEXT_KINDS.has(prevKind)) return null;
        const prevAlign = (visual.blocks[index - 1].match(ALIGN_SUFFIX) || [""])[0];
        texts.splice(index - 1, 2, visual.blocks[index - 1].replace(ALIGN_SUFFIX, "") + md.replace(ALIGN_SUFFIX, "") + prevAlign);
        return texts;
    }

    function activeBody() {
        const range = currentRange();
        if (!range) return null;
        const node = range.startContainer;
        const element = node.nodeType === 1 ? node : node.parentElement;
        const body = element && element.closest(".creator-vblock-body");
        return body && el.visual.contains(body) && body.isContentEditable ? body : null;
    }

    function applyTextsToEditor(texts) {
        const md = texts.filter(text => strip(text).trim() || hasToken(text)).join("\n\n");
        const start = md.indexOf(TOKEN_START);
        const end = md.indexOf(TOKEN_END);
        const clean = strip(md);
        const a = start === -1 ? clean.length : start;
        const b = end === -1 ? a : end - (start !== -1 && start < end ? 1 : 0);
        const page = currentPage();
        page.content = clean;
        el.editor.value = clean;
        el.editor.setSelectionRange(a, b);
        changed();
    }

    function bridge(action) {
        if (!editorEnabled()) return;
        pushHistory();
        const body = activeBody();
        const texts = visual.blocks.slice();
        if (body) {
            const index = blockIndex(body.closest(".creator-vblock"));
            texts[index] = serializeWithTokens(body);
            visual.blocks[index] = strip(texts[index]);
        } else {
            texts.push(TOKEN_START);
        }
        applyTextsToEditor(texts);
        action();
    }

    function toggleInlineCode() {
        const body = activeBody();
        const range = currentRange();
        if (!body || !range) return;
        const start = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
        const existing = start.closest("code");
        if (existing && body.contains(existing)) {
            existing.replaceWith(document.createTextNode(existing.textContent));
        } else {
            if (range.collapsed) return;
            const code = document.createElement("code");
            code.textContent = range.toString();
            range.deleteContents();
            range.insertNode(code);
            getSelection().selectAllChildren(code);
        }
        commitBlock(body.closest(".creator-vblock"));
    }

    const VISUAL_TOOLS = {
        Left: () => alignText("left"),
        Center: () => alignText("center"),
        Right: () => alignText("right"),
        B: () => document.execCommand("bold"),
        I: () => document.execCommand("italic"),
        S: () => document.execCommand("strikeThrough"),
        Code: toggleInlineCode
    };

    function insideFence(lines, row) {
        let fence = null;
        for (let i = 0; i <= row && i < lines.length; i++) {
            if (fence) {
                if (i < row && fenceCloses(lines[i], fence)) fence = null;
                continue;
            }
            const f = lines[i].match(FENCE);
            if (f) fence = f[1];
        }
        return !!fence;
    }

    function alignText(dir) {
        if (isVisual()) {
            const body = activeBody();
            if (!body) return;
            const blockEl = body.closest(".creator-vblock");
            if (!["paragraph", "heading"].includes(blockEl.dataset.kind)) {
                toast("Only paragraphs and headings can be aligned.", true);
                return;
            }
            const targets = [...body.children].filter(node => /^(P|DIV|H[1-6])$/.test(node.tagName));
            const current = ["center", "right"].find(name => targets[0] && targets[0].classList.contains(`wiki-text-${name}`)) || "left";
            const next = current === dir ? "left" : dir;
            targets.forEach(node => {
                node.classList.remove("wiki-text-left", "wiki-text-center", "wiki-text-right");
                if (next !== "left") node.classList.add(`wiki-text-${next}`);
            });
            commitBlock(blockEl);
            return;
        }
        const value = el.editor.value;
        const lines = value.split("\n");
        const row = value.slice(0, el.editor.selectionStart).split("\n").length - 1;
        const line = lines[row] || "";
        const heading = HEADING.test(line);
        if (!line.trim() || insideFence(lines, row) || (!heading && startsBlock(lines, row))) {
            toast("Put the cursor into a paragraph or heading first.", true);
            return;
        }
        let target = row;
        if (!heading) {
            while (target + 1 < lines.length && lines[target + 1].trim() && !startsBlock(lines, target + 1)) target++;
        }
        const old = lines[target];
        const m = old.match(ALIGN_SUFFIX);
        const next = (m ? m[1] : "left") === dir ? "left" : dir;
        const updated = old.replace(ALIGN_SUFFIX, "") + (next === "left" ? "" : ` {.${next}}`);
        const start = lines.slice(0, target).reduce((sum, item) => sum + item.length + 1, 0);
        const cursor = el.editor.selectionStart;
        replaceRange(start, start + old.length, updated);
        const position = Math.min(cursor, el.editor.value.length);
        el.editor.setSelectionRange(position, position);
    }

    function runTool(index) {
        const tool = TOOLS[index];
        if (!isVisual()) {
            tool[2]();
            return;
        }
        if (VISUAL_TOOLS[tool[0]]) {
            if (activeBody()) VISUAL_TOOLS[tool[0]]();
            else toast("Click into a text block first.", true);
            return;
        }
        if (LINE_TOOLS.has(tool[0]) && !activeBody()) {
            toast("Click into a text block first.", true);
            return;
        }
        bridge(tool[2]);
    }

    // History

    function historyFor(uid) {
        if (!visual.history.has(uid)) visual.history.set(uid, { stack: [], index: -1 });
        return visual.history.get(uid);
    }

    function pushHistory() {
        if (visual.restoring) return;
        const page = currentPage();
        if (!page || page.type !== "page") return;
        const history = historyFor(page.uid);
        if (history.stack[history.index] === page.content) return;
        history.stack = history.stack.slice(0, history.index + 1);
        history.stack.push(page.content);
        if (history.stack.length > 200) history.stack.shift();
        history.index = history.stack.length - 1;
    }

    const scheduleHistory = debounce(pushHistory, 500);

    function restoreHistory(delta) {
        const page = currentPage();
        if (!page || page.type !== "page") return;
        pushHistory();
        const history = historyFor(page.uid);
        const target = history.index + delta;
        if (target < 0 || target >= history.stack.length) return;
        history.index = target;
        const content = history.stack[target];
        let at = 0;
        while (at < content.length && content[at] === page.content[at]) at++;
        visual.restoring = true;
        page.content = content;
        el.editor.value = content;
        changed();
        renderVisualBlocks([content.slice(0, at) + TOKEN_START + content.slice(at)]);
        indexImages(el.visual);
        scheduleAssets();
        visual.restoring = false;
    }

    // Special blocks and the insert menu

    function blockOffset(index) {
        let offset = 0;
        for (let i = 0; i < index; i++) {
            if (visual.blocks[i].trim()) offset += visual.blocks[i].length + 2;
        }
        return offset;
    }

    function openSpecialBlock(index) {
        const kind = visual.kinds[index];
        if (kind === "table" || kind === "image") {
            pushHistory();
            applyTextsToEditor(visual.blocks);
            const offset = blockOffset(index);
            el.editor.setSelectionRange(offset, offset);
            if (kind === "table") openTableDialog();
            else openImageDialog();
            return;
        }
        const parsed = kind === "container" ? parseContainerText(visual.blocks[index]) : null;
        const save = markdown => rebuildVisual(replaceAt(index, [markdown]));
        if (parsed && ["crafting", "furnace", "brewing"].includes(parsed.type)) openRecipeDialog(visual.blocks[index], save);
        else if (parsed && parsed.type === "youtube") openVideoDialog(visual.blocks[index], save);
        else if (parsed && parsed.type === "gallery") openGalleryDialog(visual.blocks[index], save);
        else openBlockDialog(index);
    }

    function openBlockDialog(index) {
        openDialog({
            title: "Edit block",
            confirmLabel: "Save",
            wide: true,
            body: `
                <div class="creator-field">
                    <label for="blockSource">Markdown</label>
                    <textarea id="blockSource" class="creator-input creator-block-source" spellcheck="false">${esc(visual.blocks[index])}</textarea>
                </div>
                <span class="creator-label">Preview</span>
                <div class="wiki-article creator-block-preview" id="blockPreview"></div>
                <div class="creator-row">
                    <button type="button" class="creator-small-btn creator-danger" id="blockDelete">Delete block</button>
                </div>`,
            onOpen: form => {
                const source = form.querySelector("#blockSource");
                const preview = form.querySelector("#blockPreview");
                const draw = () => {
                    previewInto(preview, source.value);
                };
                source.addEventListener("input", debounce(draw, 150));
                source.addEventListener("keydown", event => {
                    if (event.key !== "Tab") return;
                    event.preventDefault();
                    source.setRangeText("    ", source.selectionStart, source.selectionEnd, "end");
                    draw();
                });
                preview.addEventListener("click", event => {
                    const tab = event.target.closest(".wiki-tab");
                    if (tab) selectTab(tab);
                    if (event.target.closest("a")) event.preventDefault();
                });
                form.querySelector("#blockDelete").addEventListener("click", () => {
                    el.dialog.close();
                    const texts = visual.blocks.slice();
                    texts.splice(index, 1);
                    rebuildVisual(texts);
                });
                draw();
                source.focus();
            },
            onConfirm: form => {
                rebuildVisual(replaceAt(index, [form.querySelector("#blockSource").value.replace(/\s+$/, "")]));
            }
        });
    }

    function textBlockItem(prefix) {
        return index => {
            const texts = visual.blocks.slice();
            texts.splice(index + 1, 0, prefix + TOKEN_START);
            rebuildVisual(texts);
        };
    }

    function dialogBlockItem(action) {
        return index => {
            pushHistory();
            const texts = visual.blocks.slice();
            texts.splice(index + 1, 0, TOKEN_START);
            applyTextsToEditor(texts);
            action();
        };
    }

    function sourceBlockItem(template) {
        return index => {
            const texts = visual.blocks.slice();
            texts.splice(index + 1, 0, template);
            rebuildVisual(texts);
            openBlockDialog(index + 1);
        };
    }

    const INSERT_ITEMS = [
        ["Text", textBlockItem("")],
        ["Heading 1", textBlockItem("# ")],
        ["Heading 2", textBlockItem("## ")],
        ["Heading 3", textBlockItem("### ")],
        ["Heading 4", textBlockItem("#### ")],
        ["Bullet list", textBlockItem("- ")],
        ["Numbered list", textBlockItem("1. ")],
        ["Checklist", textBlockItem("- [ ] ")],
        ["Quote", textBlockItem("> ")],
        ["Image", dialogBlockItem(() => openImageDialog())],
        ["Table", dialogBlockItem(() => openTableDialog())],
        ["Tabs", dialogBlockItem(() => openTabsDialog())],
        ["Callout", dialogBlockItem(() => openCalloutDialog())],
        ["Details", sourceBlockItem("::: details Click to open\nHidden content.\n:::")],
        ["Changelog", sourceBlockItem("::: changelog\n## v1.0\n- [green]Added[/] \n:::")],
        ["Recipe", dialogBlockItem(() => recipeTool())],
        ["Video", dialogBlockItem(() => videoTool())],
        ["Gallery", dialogBlockItem(() => galleryTool())],
        ["Code block", sourceBlockItem("```\n\n```")],
        ["Divider", index => {
            const texts = visual.blocks.slice();
            texts.splice(index + 1, 0, "---", TOKEN_START);
            rebuildVisual(texts);
        }]
    ];

    function closeInsertMenu() {
        if (!visual.menu) return;
        visual.menu.remove();
        visual.menu = null;
        document.removeEventListener("mousedown", onMenuOutside);
    }

    function onMenuOutside(event) {
        if (visual.menu && !visual.menu.contains(event.target)) closeInsertMenu();
    }

    function openInsertMenu(anchor, index) {
        closeInsertMenu();
        const menu = document.createElement("div");
        menu.className = "creator-insert-menu";
        menu.innerHTML = INSERT_ITEMS.map(([label], n) => `<button type="button" data-insert="${n}">${esc(label)}</button>`).join("");
        el.previewPane.appendChild(menu);
        const a = anchor.getBoundingClientRect();
        const pane = el.previewPane.getBoundingClientRect();
        const left = clamp(a.left - pane.left + el.previewPane.scrollLeft, 8, Math.max(8, el.previewPane.clientWidth - menu.offsetWidth - 8));
        menu.style.left = `${left}px`;
        menu.style.top = `${a.bottom - pane.top + el.previewPane.scrollTop + 4}px`;
        menu.addEventListener("click", event => {
            const button = event.target.closest("[data-insert]");
            if (!button) return;
            closeInsertMenu();
            INSERT_ITEMS[Number(button.dataset.insert)][1](index);
        });
        visual.menu = menu;
        setTimeout(() => document.addEventListener("mousedown", onMenuOutside), 0);
    }

    // Visual events

    function onVisualKeydown(event) {
        if (event.isComposing) return;
        const mod = event.ctrlKey || event.metaKey;
        if (event.key === "Escape") {
            closeInsertMenu();
            return;
        }
        if (mod && !event.altKey) {
            const key = event.key.toLowerCase();
            if (key === "k") {
                event.preventDefault();
                bridge(openLinkDialog);
                return;
            }
            if (key === "u") {
                event.preventDefault();
                return;
            }
        }
        const body = activeBody();
        if (!body) return;
        const blockEl = body.closest(".creator-vblock");
        const kind = blockEl.dataset.kind;
        const index = blockIndex(blockEl);

        if (event.key === "Enter" && !mod) {
            event.preventDefault();
            if (event.shiftKey) {
                document.execCommand("insertLineBreak");
                return;
            }
            const selection = getSelection();
            if (!selection.isCollapsed) document.execCommand("delete");
            rebuildVisual(replaceAt(index, splitOnEnter(serializeWithTokens(body), kind)));
            return;
        }

        if (event.key === "Tab" && !mod) {
            event.preventDefault();
            if (kind === "list") rebuildVisual(replaceAt(index, [indentListLine(serializeWithTokens(body), event.shiftKey)]));
            return;
        }

        if (event.key === "Backspace" && !mod && getSelection().isCollapsed && caretAtStart(body)) {
            event.preventDefault();
            const texts = backspaceAtStart(index, kind, body);
            if (texts) rebuildVisual(texts);
        }
    }

    function bindVisual() {
        document.execCommand("defaultParagraphSeparator", false, "p");
        document.execCommand("styleWithCSS", false, false);

        el.modeButtons.forEach(button => button.addEventListener("click", () => setMode(button.dataset.mode)));

        el.visual.addEventListener("input", event => {
            const body = event.target.closest && event.target.closest(".creator-vblock-body");
            if (body) commitBlock(body.closest(".creator-vblock"));
        });

        el.visual.addEventListener("change", event => {
            const box = event.target.closest("input[type=checkbox]");
            if (box) commitBlock(box.closest(".creator-vblock"));
        });

        el.visual.addEventListener("keydown", onVisualKeydown);

        document.addEventListener("keydown", event => {
            if (!isVisual() || !(event.ctrlKey || event.metaKey) || event.altKey) return;
            if (event.target.closest && event.target.closest("input, textarea, select, dialog")) return;
            const key = event.key.toLowerCase();
            if (key === "z") {
                event.preventDefault();
                restoreHistory(event.shiftKey ? 1 : -1);
            } else if (key === "y") {
                event.preventDefault();
                restoreHistory(1);
            }
        });

        el.visual.addEventListener("focusout", event => {
            if (visual.rendering) return;
            const body = event.target.closest && event.target.closest(".creator-vblock-body");
            if (!body || !body.isContentEditable) return;
            if (event.relatedTarget && body.contains(event.relatedTarget)) return;
            const blockEl = body.closest(".creator-vblock");
            const index = blockIndex(blockEl);
            if (index === -1 || index >= visual.blocks.length) return;
            blockEl.replaceWith(createVisualBlock(visual.blocks[index], visual.kinds[index]));
            indexImages(el.visual);
        });

        el.visual.addEventListener("paste", event => {
            const body = activeBody();
            if (!body) return;
            event.preventDefault();
            const files = [...(event.clipboardData ? event.clipboardData.files : [])].filter(file => file.type.startsWith("image/"));
            if (files.length) {
                bridge(() => insertImageFiles(files));
                return;
            }
            const text = event.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n");
            if (!text) return;
            if (!getSelection().isCollapsed) document.execCommand("delete");
            const index = blockIndex(body.closest(".creator-vblock"));
            const md = serializeWithTokens(body).replace(TOKEN_START, text + TOKEN_START);
            rebuildVisual(replaceAt(index, [md]));
        });

        el.visual.addEventListener("click", event => {
            const action = event.target.closest("[data-vaction]");
            if (action) {
                const blockEl = action.closest(".creator-vblock");
                const index = blockEl ? blockIndex(blockEl) : visual.blocks.length - 1;
                const name = action.dataset.vaction;
                if (name === "add" || name === "add-end") {
                    openInsertMenu(action, index);
                } else if (name === "edit") {
                    openSpecialBlock(index);
                } else if (name === "delete") {
                    const texts = visual.blocks.slice();
                    texts.splice(index, 1);
                    rebuildVisual(texts);
                }
                return;
            }

            if (event.target.closest(".creator-vtitle")) {
                const title = $("pageTitle");
                if (title) {
                    title.focus();
                    title.select();
                }
                return;
            }

            if (event.target.closest("a")) event.preventDefault();
            const blockEl = event.target.closest(".creator-vblock");
            if (!blockEl) return;
            const index = blockIndex(blockEl);

            if (blockEl.classList.contains("creator-special")) {
                const tab = event.target.closest(".wiki-tab");
                if (tab) {
                    selectTab(tab);
                    return;
                }
                if (event.target.closest("summary, .wiki-copy, .wiki-gallery-prev, .wiki-gallery-next, .wiki-gallery-dot")) return;
                openSpecialBlock(index);
                return;
            }

            const atom = event.target.closest(".wiki-figure, img.wiki-img, img.wiki-icon, .wiki-loader");
            if (!atom) return;
            const node = atom.closest(".wiki-figure") || atom;
            const range = document.createRange();
            range.setStartBefore(node);
            range.setEndAfter(node);
            const selection = getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            if (node.classList.contains("wiki-loader")) bridge(openLoaderDialog);
            else if (node.classList.contains("wiki-icon")) bridge(openIconDialog);
            else bridge(() => openImageDialog());
        });

        el.visual.addEventListener("dragstart", event => {
            const handle = event.target.closest && event.target.closest(".creator-vdrag");
            if (!handle) return;
            const blockEl = handle.closest(".creator-vblock");
            visual.dragIndex = blockIndex(blockEl);
            blockEl.classList.add("creator-dragging");
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", "");
            event.dataTransfer.setDragImage(blockEl, 20, 20);
        });

        const clearDrop = () => el.visual.querySelectorAll(".creator-drop-before, .creator-drop-after")
            .forEach(node => node.classList.remove("creator-drop-before", "creator-drop-after"));

        el.visual.addEventListener("dragover", event => {
            if (visual.dragIndex === null) {
                if ([...event.dataTransfer.types].includes("Files")) event.preventDefault();
                return;
            }
            const blockEl = event.target.closest(".creator-vblock");
            if (!blockEl) return;
            event.preventDefault();
            clearDrop();
            const rect = blockEl.getBoundingClientRect();
            blockEl.classList.add(event.clientY < rect.top + rect.height / 2 ? "creator-drop-before" : "creator-drop-after");
        });

        el.visual.addEventListener("drop", event => {
            if (visual.dragIndex === null) {
                const files = [...event.dataTransfer.files].filter(file => file.type.startsWith("image/"));
                if (!files.length) return;
                event.preventDefault();
                const range = document.caretRangeFromPoint ? document.caretRangeFromPoint(event.clientX, event.clientY) : null;
                if (range) {
                    const selection = getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
                bridge(() => insertImageFiles(files));
                return;
            }
            const blockEl = event.target.closest(".creator-vblock");
            event.preventDefault();
            if (!blockEl) return;
            const target = blockIndex(blockEl);
            const before = blockEl.classList.contains("creator-drop-before");
            const from = visual.dragIndex;
            clearDrop();
            visual.dragIndex = null;
            if (target === from) return;
            const texts = visual.blocks.slice();
            const [moved] = texts.splice(from, 1);
            let to = target > from ? target - 1 : target;
            if (!before) to++;
            texts.splice(to, 0, moved);
            rebuildVisual(texts);
        });

        el.visual.addEventListener("dragend", () => {
            visual.dragIndex = null;
            clearDrop();
            el.visual.querySelectorAll(".creator-dragging").forEach(node => node.classList.remove("creator-dragging"));
        });

        el.visual.addEventListener("mouseover", event => {
            const img = event.target.closest("img.wiki-img[data-creator-index]");
            if (img && !img.closest(".wiki-gallery")) showHandle(img);
            else hideHandle();
        });
    }

    function setMode(mode) {
        state.mode = mode === "visual" ? "visual" : "markdown";
        try {
            localStorage.setItem(MODE_KEY, state.mode);
        } catch {
        }
        document.body.classList.toggle("creator-visual-mode", isVisual());
        el.modeButtons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.mode === state.mode)));
        el.preview.hidden = isVisual();
        el.visual.hidden = !isVisual();
        hideHandle();
        closeInsertMenu();
        const page = currentPage();
        if (page && page.type === "page") el.editor.value = page.content;
        refreshView();
    }

    function refreshView() {
        if (isVisual()) renderVisual();
        else renderPreview();
    }

    // Import and export

    function validate() {
        const p = state.project;
        const errors = [];
        if (!/^[a-z0-9_]+$/.test(p.id)) errors.push("Enter a web ID (lowercase letters, numbers and _).");
        if (!p.name.trim()) errors.push("Enter a project name.");
        const pages = docPages();
        if (!pages.length) errors.push("Add at least one page.");
        const files = new Set();
        pages.forEach(page => {
            if (!/^[a-z0-9_-]+$/.test(page.file)) errors.push(`The page "${page.title}" has no valid file name.`);
            if (files.has(page.file)) errors.push(`The file name "${page.file}" is used twice.`);
            files.add(page.file);
            if (!page.title.trim()) errors.push(`The page "${page.file}" has no title.`);
        });
        p.pages.filter(page => page.type === "section" && !page.title.trim()).forEach(() => errors.push("A section has no title."));
        return errors;
    }

    async function exportZip() {
        const errors = validate();
        if (errors.length) {
            toast(errors[0], true);
            return;
        }
        const p = state.project;
        const json = {
            name: p.name.trim(),
            category: p.category,
            icon: p.icon,
            description: p.description.trim(),
            mainSite: p.mainSite || defaultMainSite(),
            links: p.links.filter(link => link.url).map(link => ({ label: link.label || link.url, url: link.url })),
            updated: p.updated || "",
            pages: p.pages.map(page => page.type === "section" ? { section: page.title.trim() } : { file: page.file, title: page.title.trim() })
        };
        const files = [{ path: "project.json", data: JSON.stringify(json, null, 2) + "\n" }];
        docPages().forEach(page => {
            files.push({ path: `${page.file}.md`, data: page.content.replace(/\s*$/, "") + "\n" });
        });
        let skipped = 0;
        [...state.assets.keys()].sort().forEach(path => {
            if (isAssetUsed(path)) files.push({ path, data: state.assets.get(path).blob });
            else skipped++;
        });
        try {
            const blob = await CreatorZip.create(files);
            download(blob, `${p.id}.zip`);
            const note = skipped ? ` ${skipped} unused image${skipped === 1 ? " was" : "s were"} left out.` : "";
            toast(`Exported ${p.id}.zip. Extract it into content/${p.id}/ and add "${p.id}" to content/projects.json.${note}`);
        } catch (error) {
            console.error(error);
            toast("The ZIP could not be created.", true);
        }
    }

    async function importEntries(entries, fallbackId) {
        const candidates = entries
            .filter(entry => /(^|\/)project\.json$/i.test(entry.path))
            .sort((a, b) => a.path.split("/").length - b.path.split("/").length);
        if (!candidates.length) throw new Error("No project.json found.");

        const projectFile = candidates[0];
        const prefix = projectFile.path.slice(0, projectFile.path.length - "project.json".length);
        const data = JSON.parse(await projectFile.blob.text());
        const folder = prefix.replace(/\/$/, "").split("/").pop();
        const id = (folder || fallbackId || "").toLowerCase().replace(/[^a-z0-9_]/g, "");

        const inside = entries
            .filter(entry => entry !== projectFile && entry.path.startsWith(prefix))
            .map(entry => ({ rel: entry.path.slice(prefix.length), blob: entry.blob }));
        const markdown = new Map(inside
            .filter(entry => /\.md$/i.test(entry.rel) && !entry.rel.includes("/"))
            .map(entry => [entry.rel.slice(0, -3), entry]));

        const pages = [];
        for (const entry of Array.isArray(data.pages) ? data.pages : []) {
            if (entry.section) {
                pages.push(newSection(entry.section));
            } else if (entry.file) {
                const file = markdown.get(entry.file);
                pages.push({ uid: uid(), type: "page", title: entry.title || entry.file, file: entry.file, autoFile: false, content: file ? await file.blob.text() : "" });
                markdown.delete(entry.file);
            }
        }
        for (const [file, entry] of markdown) {
            pages.push({ uid: uid(), type: "page", title: file, file, autoFile: false, content: await entry.blob.text() });
        }
        if (!pages.some(page => page.type === "page")) {
            pages.push({ uid: uid(), type: "page", title: "Overview", file: "overview", autoFile: true, content: "" });
        }

        clearAssets();
        inside.filter(entry => !/\.md$/i.test(entry.rel) || entry.rel.includes("/")).forEach(entry => {
            const type = entry.blob.type || CreatorZip.mimeFor(entry.rel);
            addAsset(entry.rel, entry.blob.type ? entry.blob : new Blob([entry.blob], { type }));
        });

        state.project = {
            id,
            name: data.name || "",
            category: CATEGORY_LABELS[data.category] ? data.category : "mods",
            icon: data.icon || "",
            description: data.description || "",
            updated: /^\d{4}-\d{2}-\d{2}$/.test(data.updated || "") ? data.updated : "",
            mainSite: data.mainSite && data.mainSite !== `${MAIN_SITE}/${data.category}/#${id}` ? data.mainSite : "",
            links: Array.isArray(data.links) ? data.links.map(link => ({ label: link.label || "", url: link.url || "" })) : [],
            pages
        };
        state.current = pages.find(page => page.type === "page").uid;
        renderAll();
        changed();
        toast(`Imported ${state.project.name || id}.`);
    }

    async function runImport(loader) {
        if (hasContent() && !confirm("Replace the current draft? Export it first if you want to keep it.")) return;
        try {
            await loader();
        } catch (error) {
            console.error(error);
            toast(`Import failed: ${error.message}`, true);
        }
    }

    function bindTopBar() {
        el.newBtn.addEventListener("click", () => {
            if (hasContent() && !confirm("Start a new project? The current draft will be replaced.")) return;
            clearAssets();
            state.project = emptyProject();
            state.current = state.project.pages[0].uid;
            renderAll();
            changed();
            el.id.focus();
        });

        el.importZipBtn.addEventListener("click", () => el.importZipInput.click());
        el.importZipInput.addEventListener("change", () => {
            const file = el.importZipInput.files[0];
            el.importZipInput.value = "";
            if (!file) return;
            runImport(async () => importEntries(await CreatorZip.read(file), file.name.replace(/\.zip$/i, "")));
        });

        el.importFolderBtn.addEventListener("click", () => el.importFolderInput.click());
        el.importFolderInput.addEventListener("change", () => {
            const files = [...el.importFolderInput.files];
            el.importFolderInput.value = "";
            if (!files.length) return;
            runImport(() => importEntries(files.map(file => ({ path: file.webkitRelativePath || file.name, blob: file }))));
        });

        el.exportBtn.addEventListener("click", exportZip);

        window.addEventListener("pagehide", saveDraft);
    }

    // Init

    function renderAll() {
        renderProjectFields();
        renderPages();
        loadEditor();
        refreshView();
    }

    async function init() {
        buildToolbar();
        bindProjectFields();
        bindPages();
        bindAssets();
        bindEditor();
        bindPreview();
        bindVisual();
        bindTopBar();

        const [colors, loaders, draft] = await Promise.all([
            fetchJson(CONTENT + "color_map.json"),
            fetchJson(CONTENT + "loaders.json"),
            loadDraft()
        ]);
        state.colors = colors;
        state.loaders = loaders;
        buildColorNames();

        if (draft && draft.project && Array.isArray(draft.project.pages)) {
            state.project = draft.project;
            (draft.assets || []).forEach(asset => addAsset(asset.path, asset.blob));
            state.current = draft.current;
        } else {
            state.project = emptyProject();
        }
        if (!pageByUid(state.current)) state.current = state.project.pages[0].uid;

        let mode = "markdown";
        try {
            mode = localStorage.getItem(MODE_KEY) || "markdown";
        } catch {
        }
        renderProjectFields();
        renderPages();
        loadEditor();
        setMode(mode);
        setSaveState("Draft saved");
    }

    init();
})();