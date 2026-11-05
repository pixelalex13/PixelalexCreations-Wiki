(function () {
    const CONTENT = "content/";
    const SITE_TITLE = "Pixelalex Creations Wiki";
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

    const esc = WikiMarkdown.escape;
    const url = WikiMarkdown.url;
    const app = document.getElementById("wikiApp");
    const lightbox = document.getElementById("wikiLightbox");
    const state = { projects: [], byId: new Map(), colors: {}, loaders: {} };
    let currentKey = null;
    let renderToken = 0;

    // Loading

    async function loadJson(path) {
        const res = await fetch(path, { cache: "no-cache" });
        if (!res.ok) throw new Error(`${path} returned ${res.status}`);
        return res.json();
    }

    async function loadText(path) {
        const res = await fetch(path, { cache: "no-cache" });
        if (!res.ok) throw new Error(`${path} returned ${res.status}`);
        return res.text();
    }

    function normalizeProject(id, data) {
        const pages = (Array.isArray(data.pages) ? data.pages : []).filter(page => page && (page.file || page.section));
        return {
            id,
            name: data.name || id,
            category: data.category || "",
            icon: data.icon || "",
            description: data.description || "",
            updated: data.updated || "",
            mainSite: data.mainSite || "",
            links: Array.isArray(data.links) ? data.links.filter(link => link && link.url) : [],
            pages,
            docs: pages.filter(page => page.file).map(page => ({ file: page.file, title: page.title || page.file }))
        };
    }

    async function init() {
        setupChrome();
        setupInteractions();
        setupSearch();
        try {
            const [ids, colors, loaders] = await Promise.all([
                loadJson(CONTENT + "projects.json"),
                loadJson(CONTENT + "color_map.json").catch(() => ({})),
                loadJson(CONTENT + "loaders.json").catch(() => ({}))
            ]);
            state.colors = colors;
            state.loaders = loaders;
            const projects = await Promise.all((Array.isArray(ids) ? ids : []).map(async id => {
                try {
                    return normalizeProject(id, await loadJson(`${CONTENT}${id}/project.json`));
                } catch (error) {
                    console.warn(`Project "${id}" could not be loaded:`, error);
                    return null;
                }
            }));
            state.projects = projects.filter(Boolean);
            state.projects.forEach(project => state.byId.set(project.id, project));
        } catch (error) {
            console.error(error);
            app.innerHTML = messageHtml("The wiki could not be loaded", "content/projects.json is missing or not valid JSON.", false);
            return;
        }
        route();
    }

    // Routing

    function routeKey() {
        return new URLSearchParams(location.search).get("p") || "";
    }

    function route() {
        currentKey = routeKey();
        const [projectId, pageId] = currentKey.split("/").filter(Boolean);

        if (!projectId) {
            renderHome();
            return;
        }

        const project = state.byId.get(projectId);
        if (!project) {
            document.title = `Not found - ${SITE_TITLE}`;
            app.innerHTML = messageHtml("Project not found", `There is no wiki for "${projectId}".`, true);
            window.scrollTo(0, 0);
            return;
        }

        const page = pageId ? project.docs.find(doc => doc.file === pageId) : project.docs[0];
        renderProject(project, page, pageId);
    }

    function navigate(href) {
        history.pushState(null, "", href);
        closeNav();
        if (routeKey() === currentKey) {
            scrollToHash();
        } else {
            route();
        }
    }

    function scrollToHash() {
        const id = decodeURIComponent(location.hash.slice(1));
        const target = id && document.getElementById(id);
        if (target) {
            target.scrollIntoView();
        } else {
            window.scrollTo(0, 0);
        }
    }

    // Rendering

    function iconSrc(project) {
        if (/^([a-z][a-z0-9+.-]*:|\/)/i.test(project.icon)) return project.icon;
        return `${CONTENT}${project.id}/${project.icon}`;
    }

    function iconHtml(project, className) {
        if (project.icon) return `<img src="${esc(iconSrc(project))}" alt="" class="${className}">`;
        return `<span class="${className} wiki-icon-placeholder" aria-hidden="true">${esc(project.name.charAt(0).toUpperCase())}</span>`;
    }

    function messageHtml(title, text, withHomeLink) {
        const link = withHomeLink ? `<a class="wiki-btn wiki-btn-secondary" href="./" data-wiki-link>Back to all projects</a>` : "";
        return `<div class="wiki-message wiki-message-error"><strong>${esc(title)}</strong><p>${esc(text)}</p>${link}</div>`;
    }

    function renderHome() {
        document.title = SITE_TITLE;
        const groups = Object.keys(CATEGORY_LABELS)
            .map(category => ({ id: category, label: CATEGORY_LABELS[category], items: state.projects.filter(p => p.category === category) }))
            .filter(group => group.items.length);
        const other = state.projects.filter(p => !CATEGORY_LABELS[p.category]);
        if (other.length) groups.push({ id: "other", label: "Other", items: other });

        const tile = project => `
            <a class="wiki-tile" href="${esc(url(project.id))}" data-wiki-link>
                ${iconHtml(project, "wiki-tile-icon")}
                <span class="wiki-tile-text">
                    <span>${esc(project.name)}</span>
                    ${project.description ? `<span class="wiki-tile-desc">${esc(project.description)}</span>` : ""}
                </span>
            </a>`;

        const body = groups.length
            ? groups.map(group => `<h2 id="${esc(group.id)}">${esc(group.label)}</h2><div class="wiki-tile-grid">${group.items.map(tile).join("")}</div>`).join("")
            : `<p class="wiki-home-intro">No projects yet. Add a project folder and list its id in content/projects.json.</p>`;

        app.innerHTML = `
            <section class="wiki-home">
                <h1>Pixelalex Creations Wiki</h1>
                <p class="wiki-home-intro">Guides and documentation for the projects on Pixelalex Creations.</p>
                ${searchBoxHtml()}
                ${body}
            </section>`;
        scrollToHash();
    }

    function navItemsHtml(project, page) {
        return project.pages.map(entry => {
            if (!entry.file) return `<div class="wiki-page-nav-section">${esc(entry.section)}</div>`;
            const active = page && entry.file === page.file;
            return `<a href="${esc(url(project.id, entry.file))}" data-wiki-link${active ? " class=\"wiki-active\" aria-current=\"page\"" : ""}>${esc(entry.title || entry.file)}</a>`;
        }).join("");
    }

    function sidebarLinksHtml(project) {
        const links = [];
        if (project.mainSite) {
            links.push(`<a class="wiki-btn wiki-btn-primary" href="${esc(project.mainSite)}" target="_blank" rel="noopener">View on Pixelalex Creations</a>`);
        }
        project.links.forEach(link => {
            links.push(`<a class="wiki-btn wiki-btn-secondary" href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${esc(link.label || link.url)}</a>`);
        });
        return links.join("");
    }

    function breadcrumbHtml(project, page) {
        const category = CATEGORY_LABELS[project.category];
        const separator = `<span class="wiki-breadcrumb-sep" aria-hidden="true">›</span>`;
        const parts = [`<a href="./" data-wiki-link>Wiki</a>`];
        if (category) parts.push(`<a href="./#${esc(project.category)}" data-wiki-link>${esc(category)}</a>`);
        parts.push(page
            ? `<a href="${esc(url(project.id))}" data-wiki-link>${esc(project.name)}</a>`
            : `<span aria-current="page">${esc(project.name)}</span>`);
        if (page) parts.push(`<span aria-current="page">${esc(page.title)}</span>`);
        return `<nav class="wiki-breadcrumb" aria-label="Breadcrumb">${parts.join(separator)}</nav>`;
    }

    function pagerHtml(project, page) {
        const index = project.docs.findIndex(doc => doc.file === page.file);
        const prev = project.docs[index - 1];
        const next = project.docs[index + 1];
        if (!prev && !next) return "";
        const prevHtml = prev ? `<a class="wiki-pager-prev" href="${esc(url(project.id, prev.file))}" data-wiki-link><span class="wiki-pager-label">Previous</span>${esc(prev.title)}</a>` : "";
        const nextHtml = next ? `<a class="wiki-pager-next" href="${esc(url(project.id, next.file))}" data-wiki-link><span class="wiki-pager-label">Next</span>${esc(next.title)}</a>` : "";
        return `<nav class="wiki-pager" aria-label="Page navigation">${prevHtml}${nextHtml}</nav>`;
    }

    async function renderProject(project, page, requestedPage) {
        const token = ++renderToken;
        document.title = `${page ? page.title + " - " : ""}${project.name} - ${SITE_TITLE}`;

        app.innerHTML = `
            <div class="wiki-breadcrumb-row">${breadcrumbHtml(project, page)}</div>
            <div class="wiki-layout">
                <aside class="wiki-sidebar" id="wikiSidebar">
                    <a class="wiki-back" href="./" data-wiki-link><span aria-hidden="true">←</span> All projects</a>
                    ${searchBoxHtml()}
                    <a class="wiki-project-head" href="${esc(url(project.id))}" data-wiki-link>
                        ${iconHtml(project, "wiki-project-icon")}
                        <span class="wiki-project-text">
                            <span class="wiki-project-name">${esc(project.name)}</span>
                            ${CATEGORY_LABELS[project.category] ? `<span class="wiki-project-category">${esc(CATEGORY_LABELS[project.category])}</span>` : ""}
                            ${project.updated && formatDate(project.updated) ? `<span class="wiki-project-updated">Updated ${esc(formatDate(project.updated))}</span>` : ""}
                        </span>
                    </a>
                    <button type="button" class="wiki-sidebar-toggle" aria-expanded="false" aria-controls="wikiSidebarBody">${esc(page ? page.title : "Pages")}</button>
                    <div class="wiki-sidebar-body" id="wikiSidebarBody">
                        <nav class="wiki-page-nav" aria-label="${esc(project.name)} pages">${navItemsHtml(project, page)}</nav>
                        ${project.mainSite || project.links.length ? `<div class="wiki-sidebar-links">${sidebarLinksHtml(project)}</div>` : ""}
                    </div>
                </aside>
                <div class="wiki-content" id="wikiContent"></div>
            </div>`;
        window.scrollTo(0, 0);

        const content = document.getElementById("wikiContent");

        if (!page) {
            content.innerHTML = project.docs.length
                ? messageHtml("Page not found", `"${requestedPage}" is not a page of ${project.name}.`, false)
                : messageHtml("No pages yet", `${project.name} has no pages in its project.json.`, false);
            return;
        }

        let markdown;
        try {
            markdown = await loadText(`${CONTENT}${project.id}/${page.file}.md`);
        } catch (error) {
            if (token !== renderToken) return;
            console.error(error);
            content.innerHTML = messageHtml("This page could not be loaded", `content/${project.id}/${page.file}.md is missing.`, false);
            return;
        }
        if (token !== renderToken) return;

        let html = WikiMarkdown.render(markdown, renderOptions(project));
        if (!/^\s*<h1[\s>]/.test(html)) html = `<h1>${esc(page.title)}</h1>${html}`;

        content.innerHTML = `<article class="wiki-article">${html}</article>${pagerHtml(project, page)}`;
        WikiMarkdown.enhance(content);
        scrollToHash();
    }

    // Search

    const search = { index: null, loading: null };

    function searchBoxHtml() {
        return `
            <div class="wiki-search" role="search">
                <input type="search" class="wiki-search-input" placeholder="Search the wiki (Ctrl+K)" aria-label="Search the wiki" autocomplete="off" spellcheck="false">
                <div class="wiki-search-results" hidden></div>
            </div>`;
    }

    function renderOptions(project) {
        return { base: `${CONTENT}${project.id}/`, project: project.id, colors: state.colors, loaders: state.loaders };
    }

    function textOf(node) {
        const walker = node.ownerDocument.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        const parts = [];
        while (walker.nextNode()) parts.push(walker.currentNode.nodeValue);
        return parts.join(" ");
    }

    function buildIndex() {
        if (search.loading) return search.loading;
        search.loading = (async () => {
            const entries = [];
            const scratch = document.implementation.createHTMLDocument("");
            await Promise.all(state.projects.map(project => Promise.all(project.docs.map(async doc => {
                let markdown;
                try {
                    markdown = await loadText(`${CONTENT}${project.id}/${doc.file}.md`);
                } catch {
                    return;
                }
                const box = scratch.createElement("div");
                box.innerHTML = WikiMarkdown.render(markdown, renderOptions(project));
                box.querySelectorAll(".wiki-anchor, .wiki-copy, .wiki-gallery-prev, .wiki-gallery-next").forEach(node => node.remove());
                let section = { anchor: "", heading: "", text: "" };
                const sections = [section];
                [...box.children].forEach(child => {
                    if (/^H[1-4]$/.test(child.tagName)) {
                        section = { anchor: child.id, heading: textOf(child).replace(/\s+/g, " ").trim(), text: "" };
                        sections.push(section);
                    } else {
                        section.text += " " + textOf(child);
                    }
                });
                sections.forEach((item, i) => {
                    const text = item.text.replace(/\s+/g, " ").trim();
                    if (!text && !item.heading) return;
                    entries.push({
                        project,
                        page: doc,
                        anchor: i === 1 && item.heading === doc.title ? "" : item.anchor,
                        heading: item.heading === doc.title ? "" : item.heading,
                        text,
                        hay: `${project.name} ${doc.title} ${item.heading} ${text}`.toLowerCase()
                    });
                });
            }))));
            search.index = entries;
            return entries;
        })();
        return search.loading;
    }

    function runSearch(query) {
        const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
        if (!terms.length || !search.index) return { terms, results: [] };
        const results = search.index.map(entry => {
            if (!terms.every(term => entry.hay.includes(term))) return null;
            let score = 0;
            terms.forEach(term => {
                if (entry.page.title.toLowerCase().includes(term)) score += 5;
                if (entry.heading.toLowerCase().includes(term)) score += 3;
                if (entry.project.name.toLowerCase().includes(term)) score += 2;
                if (entry.text.toLowerCase().includes(term)) score += 1;
            });
            return { entry, score };
        }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 12).map(item => item.entry);
        return { terms, results };
    }

    function highlight(text, terms) {
        let html = esc(text);
        terms.map(term => esc(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).forEach(term => {
            html = html.replace(new RegExp(`(${term})(?![^<]*>)`, "gi"), "<mark>$1</mark>");
        });
        return html;
    }

    function snippet(text, terms) {
        const lower = text.toLowerCase();
        const hits = terms.map(term => lower.indexOf(term)).filter(index => index !== -1);
        const at = hits.length ? Math.min(...hits) : 0;
        const start = Math.max(0, at - 50);
        const part = text.slice(start, start + 150);
        return (start > 0 ? "…" : "") + part + (start + 150 < text.length ? "…" : "");
    }

    async function updateSearch(input) {
        const box = input.parentElement.querySelector(".wiki-search-results");
        const query = input.value.trim();
        if (!query) {
            box.hidden = true;
            box.innerHTML = "";
            return;
        }
        box.hidden = false;
        if (!search.index) {
            box.innerHTML = `<div class="wiki-search-empty">Searching…</div>`;
            await buildIndex();
            if (input.value.trim() !== query) return;
        }
        const { terms, results } = runSearch(query);
        box.innerHTML = results.length
            ? results.map((entry, i) => {
                const path = [entry.project.name, entry.page.title].map(esc).join(" › ");
                const title = entry.heading || entry.page.title;
                const href = url(entry.project.id, entry.page.file) + (entry.anchor ? `#${entry.anchor}` : "");
                return `<a class="wiki-search-result${i === 0 ? " is-selected" : ""}" href="${esc(href)}" data-wiki-link>
                    <span class="wiki-search-path">${path}</span>
                    <span class="wiki-search-title">${highlight(title, terms)}</span>
                    ${entry.text ? `<span class="wiki-search-snippet">${highlight(snippet(entry.text, terms), terms)}</span>` : ""}
                </a>`;
            }).join("")
            : `<div class="wiki-search-empty">Nothing found for "${esc(query)}".</div>`;
    }

    function closeSearches(except) {
        document.querySelectorAll(".wiki-search-results").forEach(box => {
            if (box !== except) box.hidden = true;
        });
    }

    function setupSearch() {
        document.addEventListener("input", event => {
            const input = event.target.closest && event.target.closest(".wiki-search-input");
            if (input) updateSearch(input);
        });

        document.addEventListener("focusin", event => {
            const input = event.target.closest && event.target.closest(".wiki-search-input");
            if (!input) return;
            buildIndex();
            if (input.value.trim()) updateSearch(input);
        });

        document.addEventListener("keydown", event => {
            if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "k") {
                const input = [...document.querySelectorAll(".wiki-search-input")].find(field => field.offsetParent !== null);
                if (input) {
                    event.preventDefault();
                    input.focus();
                    input.select();
                }
                return;
            }
            const input = event.target.closest && event.target.closest(".wiki-search-input");
            if (!input) return;
            const box = input.parentElement.querySelector(".wiki-search-results");
            const items = [...box.querySelectorAll(".wiki-search-result")];
            const current = items.findIndex(item => item.classList.contains("is-selected"));
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                if (!items.length) return;
                event.preventDefault();
                const next = event.key === "ArrowDown" ? Math.min(items.length - 1, current + 1) : Math.max(0, current - 1);
                items.forEach((item, i) => item.classList.toggle("is-selected", i === next));
                items[next].scrollIntoView({ block: "nearest" });
            } else if (event.key === "Enter") {
                const target = items[current] || items[0];
                if (target) {
                    event.preventDefault();
                    target.click();
                }
            } else if (event.key === "Escape") {
                input.value = "";
                box.hidden = true;
                input.blur();
            }
        });

        document.addEventListener("click", event => {
            const search = event.target.closest(".wiki-search");
            closeSearches(search ? search.querySelector(".wiki-search-results") : null);
        });
    }

    function formatDate(value) {
        const date = new Date(`${value}T00:00:00Z`);
        if (Number.isNaN(date.getTime())) return "";
        return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    }

    // Interactions

    function setupNavSlider() {
        const navbar = document.querySelector(".wiki-navbar");
        const link = document.querySelector(".wiki-nav-wiki");
        if (!navbar || !link) return;
        const slider = document.createElement("div");
        slider.className = "wiki-nav-slider";
        navbar.appendChild(slider);
        const place = () => {
            slider.style.left = `${link.offsetLeft}px`;
            slider.style.width = `${link.offsetWidth}px`;
        };
        place();
        if (typeof ResizeObserver === "function") {
            const observer = new ResizeObserver(place);
            observer.observe(navbar);
            observer.observe(link);
        } else {
            window.addEventListener("resize", place);
        }
        window.addEventListener("load", place);
        if (document.fonts) document.fonts.ready.then(place);
    }

    function setupChrome() {
        setupNavSlider();
        const toggle = document.querySelector(".wiki-nav-toggle");
        const links = document.getElementById("wikiNavLinks");
        toggle.addEventListener("click", () => {
            const open = links.classList.toggle("wiki-open");
            toggle.setAttribute("aria-expanded", String(open));
        });
        document.getElementById("wikiYear").textContent = new Date().getFullYear();
    }

    function closeNav() {
        const links = document.getElementById("wikiNavLinks");
        const toggle = document.querySelector(".wiki-nav-toggle");
        links.classList.remove("wiki-open");
        toggle.setAttribute("aria-expanded", "false");
    }

    function toggleSidebar(button) {
        const sidebar = button.closest(".wiki-sidebar");
        const open = sidebar.classList.toggle("wiki-open");
        button.setAttribute("aria-expanded", String(open));
    }

    function activateTab(tab) {
        const list = tab.closest(".wiki-tab-list");
        list.querySelectorAll(":scope > .wiki-tab").forEach(other => {
            const active = other === tab;
            other.setAttribute("aria-selected", String(active));
            other.tabIndex = active ? 0 : -1;
            const panel = document.getElementById(other.getAttribute("aria-controls"));
            if (!panel) return;
            const wasHidden = panel.hidden;
            panel.hidden = !active;
            if (active && wasHidden) {
                panel.classList.remove("wiki-fade-in");
                void panel.offsetWidth;
                panel.classList.add("wiki-fade-in");
            }
        });
        WikiMarkdown.positionTabIndicator(list);
    }

    function selectTab(tab) {
        const label = tab.textContent.trim().toLowerCase();
        activateTab(tab);
        document.querySelectorAll(".wiki-article .wiki-tab-list").forEach(list => {
            if (list.contains(tab)) return;
            const match = [...list.querySelectorAll(":scope > .wiki-tab")].find(other => other.textContent.trim().toLowerCase() === label);
            if (match) activateTab(match);
        });
    }

    function onTabKeydown(event) {
        const tab = event.target.closest(".wiki-tab");
        if (!tab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        const tabs = [...tab.closest(".wiki-tab-list").querySelectorAll(":scope > .wiki-tab")];
        const index = tabs.indexOf(tab);
        let next = index;
        if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = tabs.length - 1;
        event.preventDefault();
        tabs[next].focus();
        selectTab(tabs[next]);
    }

    async function copyCode(button) {
        const code = button.parentElement.querySelector("code");
        try {
            await navigator.clipboard.writeText(code.textContent);
            button.textContent = "Copied";
            button.classList.add("wiki-copied");
        } catch {
            button.textContent = "Copy failed";
        }
        setTimeout(() => {
            button.textContent = "Copy";
            button.classList.remove("wiki-copied");
        }, 1500);
    }

    function openLightbox(img) {
        const view = lightbox.querySelector("img");
        view.src = img.currentSrc || img.src;
        view.alt = img.alt;
        lightbox.hidden = false;
        document.body.style.overflow = "hidden";
    }

    function closeLightbox() {
        if (lightbox.hidden) return;
        lightbox.hidden = true;
        lightbox.querySelector("img").removeAttribute("src");
        document.body.style.overflow = "";
    }

    function setupInteractions() {
        document.addEventListener("click", event => {
            const link = event.target.closest("a[data-wiki-link]");
            if (link && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                const target = new URL(link.href, location.href);
                if (target.origin === location.origin && target.pathname === location.pathname) {
                    event.preventDefault();
                    navigate(target.href);
                    return;
                }
            }

            const tab = event.target.closest(".wiki-tab");
            if (tab) {
                selectTab(tab);
                return;
            }

            const copy = event.target.closest(".wiki-copy");
            if (copy) {
                copyCode(copy);
                return;
            }

            const sidebarToggle = event.target.closest(".wiki-sidebar-toggle");
            if (sidebarToggle) {
                toggleSidebar(sidebarToggle);
                return;
            }

            const img = event.target.closest(".wiki-article .wiki-img");
            if (img && !img.classList.contains("wiki-no-zoom") && !img.closest("a")) {
                openLightbox(img);
            }
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") closeLightbox();
            onTabKeydown(event);
        });

        lightbox.addEventListener("click", closeLightbox);

        window.addEventListener("popstate", () => {
            if (routeKey() === currentKey) {
                scrollToHash();
            } else {
                route();
            }
        });
    }

    init();
})();