(function () {
    const ASSET_BASE = new URL("../", document.currentScript ? document.currentScript.src : location.href).href;
    const FENCE = /^\s*(`{3,}|~{3,})\s*([\w+-]*)\s*$/;
    const FENCE_CLOSE = /^\s*(`{3,}|~{3,})\s*$/;
    const CONTAINER_OPEN = /^\s*:::\s*([a-zA-Z][\w-]*\+?)\s*(.*)$/;
    const CONTAINER_CLOSE = /^\s*:::\s*$/;
    const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;
    const HR = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
    const LIST_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
    const QUOTE = /^\s{0,3}>\s?(.*)$/;
    const TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;
    const TAB_MARK = /^\s*@tab\s+(.+?)\s*$/;
    const ALIGN = /\s*\{\.(left|center|right)\}\s*$/;
    const TASK = /^\[([ xX])\]\s+(.*)$/;
    const TOKEN = /\u0001(\d+)\u0002/g;
    const COLOR_TAG = /\[([#\w]+)\]((?:(?!\[[#\w]+\])[\s\S])*?)\[\/\]/g;
    const CALLOUT_TITLES = { info: "Info", tip: "Tip", warning: "Warning", danger: "Danger" };

    // Helpers

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function unescapeHtml(text) {
        return String(text)
            .replace(/&quot;/g, "\"")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&amp;/g, "&");
    }

    function wikiUrl(project, page) {
        if (!project) return "./";
        return "?p=" + [project, page].filter(Boolean).map(encodeURIComponent).join("/");
    }

    function indentOf(line) {
        return line.match(/^\s*/)[0].length;
    }

    function stripIndent(line, count) {
        return line.replace(new RegExp("^ {0," + count + "}"), "");
    }

    function nextNonBlank(lines, index) {
        for (let i = index + 1; i < lines.length; i++) {
            if (lines[i].trim()) return i;
        }
        return -1;
    }

    function isFenceClose(line, marker) {
        const m = line.match(FENCE_CLOSE);
        return !!m && m[1][0] === marker[0] && m[1].length >= marker.length;
    }

    function slugify(html) {
        return html
            .replace(/<[^>]*>/g, "")
            .replace(/&\w+;/g, " ")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "section";
    }

    function uniqueId(ctx, base) {
        const count = ctx.ids.get(base) || 0;
        ctx.ids.set(base, count + 1);
        return count ? `${base}-${count + 1}` : base;
    }

    function cssSize(value) {
        if (/^\d+(\.\d+)?$/.test(value)) return value + "px";
        if (/^\d+(\.\d+)?(px|%|em|rem|vw)$/.test(value)) return value;
        return "";
    }

    function parseAttrs(text) {
        const attrs = {};
        if (!text) return attrs;
        const re = /([\w-]+)(?:=(?:&quot;(.*?)&quot;|'([^']*)'|([^\s}]+)))?/g;
        let m;
        while ((m = re.exec(text))) {
            attrs[m[1].toLowerCase()] = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : "";
        }
        return attrs;
    }

    function resolveAsset(src, ctx) {
        if (/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(src)) return src;
        return ctx.base + src.replace(/^\.\//, "");
    }

    function resolveLink(href, ctx) {
        if (/^javascript:/i.test(href)) return { href: "#" };
        if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return { href, external: true };
        if (href.startsWith("#") || href.startsWith("/")) return { href };

        const hashIndex = href.indexOf("#");
        const path = hashIndex === -1 ? href : href.slice(0, hashIndex);
        const anchor = hashIndex === -1 ? "" : href.slice(hashIndex);

        if (/\.[a-z0-9]+$/i.test(path)) return { href: resolveAsset(path, ctx) + anchor };

        const parts = path.replace(/^\.\//, "").split("/").filter(part => part && part !== "..");
        if (path.endsWith("/") && parts.length === 1) return { href: wikiUrl(parts[0]) + anchor, wiki: true };
        if (parts.length >= 2) return { href: wikiUrl(parts[0], parts[1]) + anchor, wiki: true };
        return { href: wikiUrl(ctx.project, parts[0]) + anchor, wiki: true };
    }

    function resolveColor(name, ctx) {
        if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(name)) return name;
        return ctx.colors[name.toLowerCase()] || null;
    }

    function applyColors(text, ctx) {
        let previous;
        do {
            previous = text;
            text = text.replace(COLOR_TAG, (match, name, content) => {
                const color = resolveColor(name, ctx);
                return color ? `<span style="color:${color}">${content}</span>` : content;
            });
        } while (text !== previous);
        return text;
    }

    // Inline

    function renderInline(text, ctx) {
        const stash = [];
        let html = formatInline(escapeHtml(text), ctx, stash);
        while (html.includes("\u0001")) {
            html = html.replace(TOKEN, (match, index) => stash[index]);
        }
        return html;
    }

    function formatInline(text, ctx, stash) {
        const keep = html => `\u0001${stash.push(html) - 1}\u0002`;
        let s = text;

        s = s.replace(/``([\s\S]+?)``|`([^`\n]+)`/g, (match, double, single) => keep(`<code>${(double !== undefined ? double : single).trim()}</code>`));
        s = s.replace(/\\([\\`*~[\]{}()!:#|_-])/g, (match, char) => keep(char));
        s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;(.*?)&quot;)?\)(?:\{([^}]*)\})?/g, (match, alt, src, title, attrs) => keep(renderImage(alt, src, title, parseAttrs(attrs), ctx)));
        s = s.replace(/:icon\[([^\]]+)\](?:\{([^}]*)\})?/g, (match, src, attrs) => keep(renderIcon(src, parseAttrs(attrs), ctx)));
        s = s.replace(/:loader\[([^\]]+)\]/g, (match, list) => keep(renderLoaders(list, ctx)));
        s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;(.*?)&quot;)?\)/g, (match, label, href, title) => keep(renderLink(label, href, title, ctx, stash)));
        s = applyColors(s, ctx);
        s = s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, "<strong>$1</strong>");
        s = s.replace(/\*(?=\S)([\s\S]*?\S)\*/g, "<em>$1</em>");
        s = s.replace(/~~(?=\S)([\s\S]*?\S)~~/g, "<del>$1</del>");
        s = s.replace(/\n/g, "<br>");
        return s;
    }

    function renderLink(label, href, title, ctx, stash) {
        const text = formatInline(label, ctx, stash);
        const target = resolveLink(unescapeHtml(href), ctx);
        const titleAttr = title ? ` title="${title}"` : "";
        const url = escapeHtml(target.href);
        if (target.external) return `<a href="${url}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
        return `<a href="${url}"${titleAttr}${target.wiki ? " data-wiki-link" : ""}>${text}</a>`;
    }

    function renderImage(alt, src, title, attrs, ctx) {
        const url = escapeHtml(resolveAsset(unescapeHtml(src), ctx));
        const classes = ["wiki-img"];
        if ("pixelated" in attrs) classes.push("wiki-pixelated");
        if ("nozoom" in attrs) classes.push("wiki-no-zoom");
        const styles = [];
        if (attrs.width && cssSize(attrs.width)) styles.push(`width:${cssSize(attrs.width)}`);
        if (attrs.height && cssSize(attrs.height)) styles.push(`height:${cssSize(attrs.height)}`);
        const styleAttr = styles.length ? ` style="${styles.join(";")}"` : "";
        const titleAttr = title ? ` title="${title}"` : "";
        const img = `<img src="${url}" alt="${alt}" class="${classes.join(" ")}"${styleAttr}${titleAttr} loading="lazy">`;
        if (!attrs.align && !attrs.caption) return img;
        const align = ["left", "center", "right"].includes(attrs.align) ? attrs.align : "center";
        const caption = attrs.caption ? `<span class="wiki-caption">${attrs.caption}</span>` : "";
        return `<span class="wiki-figure wiki-align-${align}">${img}${caption}</span>`;
    }

    function renderIcon(src, attrs, ctx) {
        const clean = src.trim();
        const url = escapeHtml(resolveAsset(unescapeHtml(clean), ctx));
        const name = clean.split("/").pop().replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
        const size = attrs.size && cssSize(attrs.size) ? ` style="height:${cssSize(attrs.size)}"` : "";
        return `<img src="${url}" alt="${attrs.alt || name}" class="wiki-icon"${size}>`;
    }

    function renderLoaders(list, ctx) {
        return list.split(",").map(name => name.trim()).filter(Boolean).map(name => {
            const entry = ctx.loaders[unescapeHtml(name).toLowerCase()];
            if (!entry) return `<span class="wiki-loader">${name}</span>`;
            const style = entry.color ? ` style="color:${entry.color};border-color:${entry.color}"` : "";
            return `<span class="wiki-loader"${style}>${escapeHtml(entry.name)}</span>`;
        }).join("");
    }

    // Blocks

    function isTableStart(lines, i) {
        return i + 1 < lines.length
            && lines[i].includes("|")
            && lines[i + 1].includes("|")
            && TABLE_SEP.test(lines[i + 1]);
    }

    function isBlockStart(lines, i) {
        const line = lines[i];
        return FENCE.test(line)
            || CONTAINER_OPEN.test(line)
            || HEADING.test(line)
            || HR.test(line)
            || QUOTE.test(line)
            || LIST_ITEM.test(line)
            || isTableStart(lines, i);
    }

    function renderBlocks(lines, ctx, tight) {
        const out = [];
        let i = 0;
        while (i < lines.length) {
            const line = lines[i];
            let m;

            if (!line.trim()) {
                i++;
                continue;
            }

            if ((m = line.match(FENCE))) {
                const body = [];
                i++;
                while (i < lines.length && !isFenceClose(lines[i], m[1])) {
                    body.push(lines[i]);
                    i++;
                }
                i++;
                out.push(renderCode(body.join("\n"), m[2]));
                continue;
            }

            if ((m = line.match(CONTAINER_OPEN))) {
                const end = findContainerEnd(lines, i + 1);
                out.push(renderContainer(m[1], m[2], lines.slice(i + 1, end), ctx));
                i = end + 1;
                continue;
            }

            if ((m = line.match(HEADING))) {
                out.push(renderHeading(m[1].length, m[2], ctx));
                i++;
                continue;
            }

            if (HR.test(line)) {
                out.push("<hr>");
                i++;
                continue;
            }

            if (QUOTE.test(line)) {
                const body = [];
                while (i < lines.length && lines[i].trim() && QUOTE.test(lines[i])) {
                    body.push(lines[i].match(QUOTE)[1]);
                    i++;
                }
                out.push(`<blockquote>${renderBlocks(body, ctx, false)}</blockquote>`);
                continue;
            }

            if (LIST_ITEM.test(line)) {
                const list = parseList(lines, i, ctx);
                out.push(list.html);
                i = list.next;
                continue;
            }

            if (isTableStart(lines, i)) {
                const table = parseTable(lines, i, ctx);
                out.push(table.html);
                i = table.next;
                continue;
            }

            const paragraph = [];
            while (i < lines.length && lines[i].trim() && (!paragraph.length || !isBlockStart(lines, i))) {
                paragraph.push(lines[i].trim());
                i++;
            }
            let align = "";
            if (!tight) {
                const last = paragraph[paragraph.length - 1];
                const m = last.match(ALIGN);
                if (m) {
                    align = m[1];
                    paragraph[paragraph.length - 1] = last.replace(ALIGN, "");
                }
            }
            const html = renderInline(paragraph.join("\n"), ctx);
            out.push(tight ? html : `<p${align ? ` class="wiki-text-${align}"` : ""}>${html}</p>`);
        }
        return out.join("\n");
    }

    function renderCode(code, lang) {
        const cls = lang ? ` class="language-${escapeHtml(lang)}"` : "";
        return `<div class="wiki-code"><button type="button" class="wiki-copy">Copy</button><pre><code${cls}>${escapeHtml(code)}</code></pre></div>`;
    }

    function renderHeading(level, text, ctx) {
        const m = text.match(ALIGN);
        const html = renderInline(m ? text.replace(ALIGN, "") : text, ctx);
        const id = uniqueId(ctx, slugify(html));
        const cls = m ? ` class="wiki-text-${m[1]}"` : "";
        return `<h${level} id="${id}"${cls}>${html}<a class="wiki-anchor" href="#${id}" aria-label="Link to this section">#</a></h${level}>`;
    }

    function findContainerEnd(lines, start) {
        let depth = 0;
        let fence = null;
        for (let i = start; i < lines.length; i++) {
            const line = lines[i];
            if (fence) {
                if (isFenceClose(line, fence)) fence = null;
                continue;
            }
            const f = line.match(FENCE);
            if (f) {
                fence = f[1];
                continue;
            }
            if (CONTAINER_OPEN.test(line)) {
                depth++;
            } else if (CONTAINER_CLOSE.test(line)) {
                if (depth === 0) return i;
                depth--;
            }
        }
        return lines.length;
    }

    function renderContainer(rawType, args, body, ctx) {
        const open = rawType.endsWith("+");
        const type = rawType.replace(/\+$/, "").toLowerCase();
        const title = args.trim();

        switch (type) {
            case "details":
                return `<details class="wiki-details"${open ? " open" : ""}><summary>${renderInline(title || "Details", ctx)}</summary><div class="wiki-details-anim"><div class="wiki-details-clip"><div class="wiki-details-body">${renderBlocks(body, ctx, false)}</div></div></div></details>`;
            case "info":
            case "tip":
            case "warning":
            case "danger":
                return `<div class="wiki-callout wiki-callout-${type}"><div class="wiki-callout-title">${renderInline(title || CALLOUT_TITLES[type], ctx)}</div><div class="wiki-callout-body">${renderBlocks(body, ctx, false)}</div></div>`;
            case "tabs":
                return renderTabs(body, ctx);
            case "crafting":
            case "furnace":
            case "brewing":
                return renderRecipe(type, args, body, ctx);
            case "youtube":
                return renderVideo(args, body, ctx);
            case "gallery":
                return renderGallery(body, ctx);
            case "changelog":
                return `<div class="wiki-changelog">${renderChangelog(body.join("\n"), ctx)}</div>`;
            default:
                return `<div class="wiki-container wiki-container-${type}">${renderBlocks(body, ctx, false)}</div>`;
        }
    }

    function renderTabs(body, ctx) {
        const tabs = [];
        let current = null;
        let depth = 0;
        let fence = null;

        body.forEach(line => {
            if (fence) {
                if (isFenceClose(line, fence)) fence = null;
            } else {
                const f = line.match(FENCE);
                if (f) {
                    fence = f[1];
                } else if (CONTAINER_OPEN.test(line)) {
                    depth++;
                } else if (CONTAINER_CLOSE.test(line)) {
                    depth--;
                } else if (depth === 0) {
                    const t = line.match(TAB_MARK);
                    if (t) {
                        current = { title: t[1], lines: [] };
                        tabs.push(current);
                        return;
                    }
                }
            }
            if (current) current.lines.push(line);
        });

        if (!tabs.length) return renderBlocks(body, ctx, false);

        ctx.tabGroups++;
        const id = `wikitabs-${ctx.tabGroups}`;
        const buttons = tabs.map((tab, n) =>
            `<button type="button" class="wiki-tab" role="tab" id="${id}-tab-${n}" aria-controls="${id}-panel-${n}" aria-selected="${n === 0}" tabindex="${n === 0 ? 0 : -1}">${renderInline(tab.title, ctx)}</button>`
        ).join("");
        const panels = tabs.map((tab, n) =>
            `<div class="wiki-tab-panel" role="tabpanel" id="${id}-panel-${n}" aria-labelledby="${id}-tab-${n}"${n === 0 ? "" : " hidden"}>${renderBlocks(tab.lines, ctx, false)}</div>`
        ).join("");
        return `<div class="wiki-tabs"><div class="wiki-tab-list" role="tablist">${buttons}<span class="wiki-tab-indicator" aria-hidden="true"></span></div>${panels}</div>`;
    }

    function renderChangelog(text, ctx) {
        let html = escapeHtml(text.replace(/^\n+|\n+$/g, ""))
            .replace(/^## (.*)$/gm, "<span class=\"wiki-changelog-heading\">$1</span>")
            .replace(/^- (.*)$/gm, "•  $1")
            .replace(/~~(.*?)~~/g, "<s>$1</s>")
            .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
            .replace(/\*(.*?)\*/g, "<i>$1</i>");
        html = applyColors(html, ctx);
        return `<p>${html.replace(/\n/g, "<br>")}</p>`;
    }

    function parseList(lines, start, ctx) {
        const first = lines[start].match(LIST_ITEM);
        const baseIndent = first[1].length;
        const ordered = /\d/.test(first[2]);
        const items = [];
        let loose = false;
        let i = start;

        while (i < lines.length) {
            const line = lines[i];

            if (!line.trim()) {
                const next = nextNonBlank(lines, i);
                if (next === -1) break;
                const nextMatch = lines[next].match(LIST_ITEM);
                const continues = indentOf(lines[next]) > baseIndent + 1
                    || (nextMatch && nextMatch[1].length >= baseIndent && nextMatch[1].length <= baseIndent + 1 && /\d/.test(nextMatch[2]) === ordered);
                if (!continues) break;
                loose = true;
                items[items.length - 1].lines.push("");
                i++;
                continue;
            }

            const m = line.match(LIST_ITEM);
            if (m && m[1].length < baseIndent) break;
            if (m && m[1].length <= baseIndent + 1) {
                if (/\d/.test(m[2]) !== ordered) break;
                items.push({ lines: [m[3]], contentIndent: line.length - m[3].length });
            } else if (items.length && indentOf(line) > baseIndent) {
                const item = items[items.length - 1];
                item.lines.push(stripIndent(line, item.contentIndent));
            } else {
                break;
            }
            i++;
        }

        const tag = ordered ? "ol" : "ul";
        const startNumber = ordered ? parseInt(first[2], 10) : 1;
        const startAttr = ordered && startNumber !== 1 ? ` start="${startNumber}"` : "";
        const body = items.map(item => {
            const task = item.lines[0].match(TASK);
            let prefix = "";
            if (task) {
                prefix = `<input type="checkbox" disabled${task[1] === " " ? "" : " checked"}>`;
                item.lines[0] = task[2];
            }
            const inner = renderBlocks(item.lines, ctx, !loose);
            return `<li${task ? " class=\"wiki-task-item\"" : ""}>${prefix}${inner}</li>`;
        }).join("");

        return { html: `<${tag}${startAttr}>${body}</${tag}>`, next: i };
    }

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

    function parseTable(lines, start, ctx) {
        const head = splitRow(lines[start]);
        const aligns = splitRow(lines[start + 1]).map(cell => {
            const left = cell.startsWith(":");
            const right = cell.endsWith(":");
            return left && right ? "center" : right ? "right" : left ? "left" : "";
        });

        const rows = [];
        let i = start + 2;
        while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
            rows.push(splitRow(lines[i]));
            i++;
        }

        const cell = (tag, text, n) => `<${tag}${aligns[n] ? ` style="text-align:${aligns[n]}"` : ""}>${renderInline(text || "", ctx)}</${tag}>`;
        const thead = `<tr>${head.map((text, n) => cell("th", text, n)).join("")}</tr>`;
        const tbody = rows.map(row => `<tr>${head.map((_, n) => cell("td", row[n], n)).join("")}</tr>`).join("");
        const html = `<div class="wiki-table-wrap"><table><thead>${thead}</thead>${rows.length ? `<tbody>${tbody}</tbody>` : ""}</table></div>`;
        return { html, next: i };
    }

    // Recipes

    const MC = {
        crafting: {
            texture: "crafting.png",
            size: [132, 70],
            grid: [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => [9 + (i % 3) * 18, 9 + Math.floor(i / 3) * 18]),
            result: [103, 27]
        },
        furnace: {
            texture: "furnace.png",
            size: [100, 70],
            input: [10, 9],
            fuel: [10, 45],
            result: [70, 27],
            flame: [10, 28, 14, 14],
            arrow: [33, 26, 24, 16]
        },
        brewing: {
            texture: "brewing.png",
            size: [120, 78],
            fuel: [9, 11],
            ingredient: [71, 11],
            bottles: [[48, 45], [71, 52], [94, 45]],
            progress: [89, 10, 9, 28],
            bubbles: [55, 8, 12, 29],
            fuelBar: [52, 38, 18, 4]
        }
    };
    const POTION_TYPES = { potion: "Potion", splash_potion: "Splash Potion", lingering_potion: "Lingering Potion" };
    const ITEM_SPEC = /^\s*(\S+)(?:\s+(#[0-9a-fA-F]{6}))?(?:\s+"([^"]*)")?(?:\s+x(\d+))?\s*$/;

    function niceName(path) {
        const file = path.split("/").pop().replace(/\.[^.]+$/, "");
        return file.replace(/[_-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    }

    function parseItem(text) {
        const alts = String(text || "").split("|").map(part => part.trim()).filter(Boolean).map(part => {
            const m = part.match(ITEM_SPEC);
            if (!m) return null;
            const potion = POTION_TYPES[m[1]] ? m[1] : null;
            return {
                path: potion ? "" : m[1],
                potion,
                color: potion ? (m[2] || "#385dc6") : "",
                name: m[3] !== undefined ? m[3] : "",
                count: m[4] ? parseInt(m[4], 10) : 1
            };
        }).filter(Boolean);
        return alts.length ? alts : null;
    }

    function parseRecipe(type, args, lines) {
        const recipe = { type, shapeless: /\bshapeless\b/i.test(args || ""), slots: {}, error: "" };
        const keys = {};
        const pattern = [];
        lines.forEach(raw => {
            const line = raw.trim();
            if (!line) return;
            let m;
            if ((m = line.match(/^=>\s*(.+)$/))) {
                recipe.slots.result = parseItem(m[1]);
            } else if ((m = line.match(/^(input|fuel|ingredient)\s*:\s*(.+)$/i))) {
                recipe.slots[m[1].toLowerCase()] = parseItem(m[2]);
            } else if ((m = line.match(/^([A-Za-z0-9])\s*:\s*(.+)$/))) {
                keys[m[1]] = parseItem(m[2]);
            } else {
                pattern.push(line.split(/\s+/));
            }
        });
        if (type === "crafting") {
            for (let i = 0; i < 9; i++) {
                const key = (pattern[Math.floor(i / 3)] || [])[i % 3];
                if (key && !/^[._-]$/.test(key)) {
                    if (!keys[key]) recipe.error = `The key "${key}" has no item.`;
                    recipe.slots["g" + i] = keys[key] || null;
                }
            }
        }
        if (!recipe.slots.result && type !== "brewing") recipe.error = recipe.error || "The recipe has no result (=> item).";
        return recipe;
    }

    function itemSrc(alt, ctx) {
        return alt.potion ? `${ASSET_BASE}recipes/${alt.potion}.png` : resolveAsset(alt.path, ctx);
    }

    function itemName(alt) {
        if (alt.name) return alt.name;
        return alt.potion ? POTION_TYPES[alt.potion] : niceName(alt.path);
    }

    function renderItem(alts, ctx) {
        const many = alts.length > 1;
        return `<span class="mc-stack${many ? " mc-cycle" : ""}">${alts.map((alt, n) => {
            const potion = alt.potion ? ` data-potion="${alt.potion}" data-color="${escapeHtml(alt.color)}"` : "";
            const count = alt.count > 1 ? `<span class="mc-count">${alt.count}</span>` : "";
            return `<span class="mc-alt${n === 0 ? " mc-active" : ""}"><img class="mc-item" src="${escapeHtml(itemSrc(alt, ctx))}" alt="${escapeHtml(itemName(alt))}"${potion} draggable="false">${count}<span class="mc-tip">${escapeHtml(itemName(alt))}</span></span>`;
        }).join("")}</span>`;
    }

    function slotHtml(name, pos, alts, ctx, ghost) {
        const content = alts ? renderItem(alts, ctx) : ghost ? `<img class="mc-ghost" src="${ASSET_BASE}recipes/${ghost}" alt="" draggable="false">` : "";
        return `<span class="mc-slot${alts ? " mc-filled" : ""}" data-slot="${name}" style="--x:${pos[0]};--y:${pos[1]}">${content}</span>`;
    }

    function spriteHtml(cls, rect, file) {
        return `<span class="mc-sprite ${cls}" style="--x:${rect[0]};--y:${rect[1]};--w:${rect[2]};--h:${rect[3]}"><img src="${ASSET_BASE}recipes/${file}" alt="" draggable="false"></span>`;
    }

    function renderRecipe(type, args, lines, ctx) {
        const recipe = parseRecipe(type, args, lines);
        const layout = MC[type];
        const s = recipe.slots;
        const parts = [];
        if (type === "crafting") {
            layout.grid.forEach((pos, i) => parts.push(slotHtml("g" + i, pos, s["g" + i], ctx)));
            parts.push(slotHtml("result", layout.result, s.result, ctx));
        } else if (type === "furnace") {
            parts.push(slotHtml("input", layout.input, s.input, ctx));
            parts.push(slotHtml("fuel", layout.fuel, s.fuel, ctx));
            parts.push(slotHtml("result", layout.result, s.result, ctx));
            parts.push(spriteHtml("mc-flame", layout.flame, "lit_progress.png"));
            parts.push(spriteHtml("mc-arrow", layout.arrow, "burn_progress.png"));
        } else {
            parts.push(slotHtml("fuel", layout.fuel, s.fuel, ctx, "slot_brewing_fuel.png"));
            parts.push(slotHtml("ingredient", layout.ingredient, s.ingredient, ctx));
            layout.bottles.forEach((pos, i) => {
                const before = s.input ? renderItem(s.input, ctx) : `<img class="mc-ghost" src="${ASSET_BASE}recipes/slot_potion.png" alt="" draggable="false">`;
                const after = s.result ? renderItem(s.result, ctx) : before;
                parts.push(`<span class="mc-slot mc-filled" data-slot="bottle${i}" style="--x:${pos[0]};--y:${pos[1]}"><span class="mc-brew-before">${before}</span><span class="mc-brew-after">${after}</span></span>`);
            });
            parts.push(spriteHtml("mc-progress", layout.progress, "brew_progress.png"));
            parts.push(spriteHtml("mc-bubbles", layout.bubbles, "bubbles.png"));
            parts.push(spriteHtml("mc-fuel-bar", layout.fuelBar, "fuel_length.png"));
        }
        const note = recipe.error
            ? `<span class="mc-recipe-error">${escapeHtml(recipe.error)}</span>`
            : recipe.shapeless ? `<span class="mc-recipe-note">Shapeless</span>` : "";
        return `<div class="mc-recipe mc-recipe-${type}" data-recipe="${type}"><div class="mc-gui" style="--w:${layout.size[0]};--h:${layout.size[1]}"><img class="mc-gui-bg" src="${ASSET_BASE}recipes/${layout.texture}" alt="" draggable="false">${parts.join("")}</div>${note}</div>`;
    }

    // Video and gallery

    function youtubeId(input) {
        const text = String(input || "").trim();
        const m = text.match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
        if (m) return m[1];
        return /^[A-Za-z0-9_-]{11}$/.test(text) ? text : null;
    }

    function renderVideo(args, lines, ctx) {
        const [source, ...titleWords] = args.trim().split(/\s+/);
        const id = youtubeId(source);
        if (!id) return `<div class="wiki-message wiki-message-error">This is not a YouTube link: ${escapeHtml(source || "")}</div>`;
        const title = titleWords.join(" ");
        const description = lines.join("\n").trim();
        const caption = title || description
            ? `<figcaption>${title ? `<span class="wiki-video-title">${renderInline(title, ctx)}</span>` : ""}${description ? `<span class="wiki-video-desc">${renderInline(description, ctx)}</span>` : ""}</figcaption>`
            : "";
        return `<figure class="wiki-video"><div class="wiki-video-frame"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="${escapeHtml(title || "YouTube video")}" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>${caption}</figure>`;
    }

    function renderGallery(lines, ctx) {
        const re = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"(.*?)")?\)(?:\{([^}]*)\})?/;
        const slides = lines.map(line => line.match(re)).filter(Boolean);
        if (!slides.length) return `<div class="wiki-message wiki-message-error">The gallery has no images.</div>`;
        const many = slides.length > 1;
        const figures = slides.map((m, i) => {
            const caption = m[1].trim();
            const pixelated = /\bpixelated\b/.test(m[4] || "") ? " wiki-pixelated" : "";
            return `<figure class="wiki-gallery-slide${i === 0 ? " is-active" : ""}"><img class="wiki-img${pixelated}" src="${escapeHtml(resolveAsset(m[2], ctx))}" alt="${escapeHtml(caption)}" loading="lazy">${caption ? `<figcaption>${renderInline(caption, ctx)}</figcaption>` : ""}</figure>`;
        }).join("");
        const nav = many ? `<button type="button" class="wiki-gallery-prev" aria-label="Previous image">‹</button><button type="button" class="wiki-gallery-next" aria-label="Next image">›</button>` : "";
        const dots = many ? `<div class="wiki-gallery-dots">${slides.map((_, i) => `<button type="button" class="wiki-gallery-dot${i === 0 ? " is-active" : ""}" data-slide="${i}" aria-label="Image ${i + 1}"></button>`).join("")}</div>` : "";
        return `<div class="wiki-gallery"><div class="wiki-gallery-stage">${figures}${nav}</div>${dots}</div>`;
    }

    // Enhancements after rendering

    const imageCache = new Map();
    const potionCache = new Map();
    let installed = false;

    function loadImage(src) {
        if (!imageCache.has(src)) {
            imageCache.set(src, new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = src;
            }));
        }
        return imageCache.get(src);
    }

    function tintPotion(type, color) {
        const key = `${type}${color}`;
        if (!potionCache.has(key)) {
            potionCache.set(key, Promise.all([
                loadImage(`${ASSET_BASE}recipes/potion_overlay.png`),
                loadImage(`${ASSET_BASE}recipes/${type}.png`)
            ]).then(([overlay, bottle]) => {
                const canvas = document.createElement("canvas");
                canvas.width = 16;
                canvas.height = 16;
                const c = canvas.getContext("2d");
                c.drawImage(overlay, 0, 0);
                const data = c.getImageData(0, 0, 16, 16);
                const r = parseInt(color.slice(1, 3), 16);
                const g = parseInt(color.slice(3, 5), 16);
                const b = parseInt(color.slice(5, 7), 16);
                for (let i = 0; i < data.data.length; i += 4) {
                    data.data[i] = data.data[i] * r / 255;
                    data.data[i + 1] = data.data[i + 1] * g / 255;
                    data.data[i + 2] = data.data[i + 2] * b / 255;
                }
                c.putImageData(data, 0, 0);
                c.drawImage(bottle, 0, 0);
                return canvas.toDataURL();
            }));
        }
        return potionCache.get(key);
    }

    function showSlide(gallery, index) {
        const slides = gallery.querySelectorAll(".wiki-gallery-slide");
        const dots = gallery.querySelectorAll(".wiki-gallery-dot");
        const next = (index + slides.length) % slides.length;
        slides.forEach((slide, i) => slide.classList.toggle("is-active", i === next));
        dots.forEach((dot, i) => dot.classList.toggle("is-active", i === next));
        gallery.dataset.index = String(next);
    }

    function reducedMotion() {
        return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    function afterTransition(element, done, fallback) {
        let finished = false;
        const finish = event => {
            if (finished || (event && event.target !== element)) return;
            finished = true;
            element.removeEventListener("transitionend", finish);
            done();
        };
        element.addEventListener("transitionend", finish);
        setTimeout(finish, fallback);
    }

    function toggleDetails(details) {
        const wrap = details.querySelector(":scope > .wiki-details-anim");
        if (!wrap || reducedMotion()) {
            details.open = !details.open;
            return;
        }
        const token = (details._token || 0) + 1;
        details._token = token;
        const closing = details.open && !wrap.classList.contains("is-collapsed");
        if (closing) {
            wrap.classList.add("is-collapsed");
            afterTransition(wrap, () => {
                if (details._token !== token) return;
                details.open = false;
                wrap.classList.remove("is-collapsed");
            }, 400);
        } else if (details.open) {
            wrap.classList.remove("is-collapsed");
        } else {
            wrap.classList.add("is-collapsed");
            details.open = true;
            requestAnimationFrame(() => requestAnimationFrame(() => {
                if (details._token === token) wrap.classList.remove("is-collapsed");
            }));
        }
    }

    function positionTabIndicator(list) {
        const indicator = list.querySelector(":scope > .wiki-tab-indicator");
        const tab = list.querySelector(':scope > .wiki-tab[aria-selected="true"]');
        if (!indicator || !tab || !tab.offsetWidth) return;
        const first = !list.classList.contains("has-indicator");
        if (first) indicator.style.transition = "none";
        indicator.style.left = `${tab.offsetLeft}px`;
        indicator.style.top = `${tab.offsetTop}px`;
        indicator.style.width = `${tab.offsetWidth}px`;
        indicator.style.height = `${tab.offsetHeight}px`;
        if (first) {
            void indicator.offsetWidth;
            indicator.style.transition = "";
            list.classList.add("has-indicator");
        }
    }

    function install() {
        if (installed) return;
        installed = true;

        document.addEventListener("click", event => {
            const nav = event.target.closest(".wiki-gallery-prev, .wiki-gallery-next, .wiki-gallery-dot");
            if (nav) {
                event.preventDefault();
                const gallery = nav.closest(".wiki-gallery");
                const current = Number(gallery.dataset.index || 0);
                if (nav.classList.contains("wiki-gallery-dot")) showSlide(gallery, Number(nav.dataset.slide));
                else showSlide(gallery, current + (nav.classList.contains("wiki-gallery-next") ? 1 : -1));
                return;
            }
            const summary = event.target.closest(".wiki-details > summary");
            if (summary && !event.defaultPrevented) {
                event.preventDefault();
                toggleDetails(summary.parentElement);
            }
        });

        let swipe = null;
        document.addEventListener("pointerdown", event => {
            const stage = event.target.closest(".wiki-gallery-stage");
            if (stage && event.pointerType !== "mouse") swipe = { stage, x: event.clientX };
        });
        document.addEventListener("pointerup", event => {
            if (!swipe) return;
            const dx = event.clientX - swipe.x;
            const gallery = swipe.stage.closest(".wiki-gallery");
            swipe = null;
            if (Math.abs(dx) > 40 && gallery.querySelectorAll(".wiki-gallery-slide").length > 1) {
                showSlide(gallery, Number(gallery.dataset.index || 0) + (dx < 0 ? 1 : -1));
            }
        });

        setInterval(() => {
            document.querySelectorAll(".mc-cycle").forEach(cycle => {
                const alts = cycle.querySelectorAll(":scope > .mc-alt");
                const current = [...alts].findIndex(alt => alt.classList.contains("mc-active"));
                alts.forEach((alt, i) => alt.classList.toggle("mc-active", i === (current + 1) % alts.length));
            });
        }, 1200);
    }

    function enhance(root) {
        install();
        (root || document).querySelectorAll(".wiki-tab-list").forEach(list => {
            positionTabIndicator(list);
            if (list._observed || typeof ResizeObserver !== "function") return;
            list._observed = true;
            new ResizeObserver(() => positionTabIndicator(list)).observe(list);
        });
        (root || document).querySelectorAll("img[data-potion]").forEach(img => {
            if (img.dataset.tinted) return;
            img.dataset.tinted = "1";
            const color = /^#[0-9a-f]{6}$/i.test(img.dataset.color) ? img.dataset.color : "#385dc6";
            tintPotion(img.dataset.potion, color).then(src => { img.src = src; }, () => {});
        });
    }

    // Public API

    function lowerKeys(map) {
        return Object.fromEntries(Object.entries(map || {}).map(([key, value]) => [key.toLowerCase(), value]));
    }

    function buildLoaderMap(map) {
        return Object.fromEntries(Object.entries(map || {}).map(([name, color]) => [
            name.toLowerCase(),
            { name, color: /^#[0-9a-f]{3,8}$/i.test(color) ? color : null }
        ]));
    }

    function render(markdown, options) {
        const opts = options || {};
        const ctx = {
            base: opts.base || "",
            project: opts.project || "",
            colors: lowerKeys(opts.colors),
            loaders: buildLoaderMap(opts.loaders),
            ids: new Map(),
            tabGroups: 0
        };
        const lines = String(markdown || "")
            .replace(/[\u0001\u0002]/g, "")
            .replace(/\r\n?/g, "\n")
            .replace(/\t/g, "    ")
            .split("\n");
        return renderBlocks(lines, ctx, false);
    }

    function slug(text, options) {
        const opts = options || {};
        const ctx = {
            base: "",
            project: "",
            colors: lowerKeys(opts.colors),
            loaders: buildLoaderMap(opts.loaders),
            ids: new Map(),
            tabGroups: 0
        };
        return slugify(renderInline(text, ctx));
    }

    window.WikiMarkdown = { render, slug, enhance, positionTabIndicator, parseRecipe, parseItem, youtubeId, escape: escapeHtml, url: wikiUrl, assetBase: ASSET_BASE };
})();