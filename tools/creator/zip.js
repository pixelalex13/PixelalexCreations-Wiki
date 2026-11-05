(function () {
    const CRC_TABLE = (() => {
        const table = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
            table[n] = c >>> 0;
        }
        return table;
    })();

    const MIME = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        webp: "image/webp",
        svg: "image/svg+xml",
        md: "text/markdown",
        json: "application/json",
        txt: "text/plain"
    };

    const ALREADY_COMPRESSED = /\.(png|jpe?g|gif|webp|zip|woff2?)$/i;

    function crc32(bytes) {
        let c = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
        return (c ^ 0xFFFFFFFF) >>> 0;
    }

    function mimeFor(path) {
        const ext = (path.split(".").pop() || "").toLowerCase();
        return MIME[ext] || "application/octet-stream";
    }

    function dosDateTime(date) {
        return {
            time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
            date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
        };
    }

    async function pipe(bytes, transform) {
        const stream = new Blob([bytes]).stream().pipeThrough(transform);
        return new Uint8Array(await new Response(stream).arrayBuffer());
    }

    async function toBytes(data) {
        if (typeof data === "string") return new TextEncoder().encode(data);
        if (data instanceof Uint8Array) return data;
        return new Uint8Array(await data.arrayBuffer());
    }

    async function create(entries) {
        const encoder = new TextEncoder();
        const canDeflate = typeof CompressionStream === "function";
        const stamp = dosDateTime(new Date());
        const parts = [];
        const central = [];
        let offset = 0;

        for (const entry of entries) {
            const name = encoder.encode(entry.path);
            const raw = await toBytes(entry.data);
            const crc = crc32(raw);
            let method = 0;
            let body = raw;

            if (canDeflate && raw.length > 64 && !ALREADY_COMPRESSED.test(entry.path)) {
                const deflated = await pipe(raw, new CompressionStream("deflate-raw"));
                if (deflated.length < raw.length) {
                    method = 8;
                    body = deflated;
                }
            }

            const local = new DataView(new ArrayBuffer(30));
            local.setUint32(0, 0x04034b50, true);
            local.setUint16(4, 20, true);
            local.setUint16(6, 0x0800, true);
            local.setUint16(8, method, true);
            local.setUint16(10, stamp.time, true);
            local.setUint16(12, stamp.date, true);
            local.setUint32(14, crc, true);
            local.setUint32(18, body.length, true);
            local.setUint32(22, raw.length, true);
            local.setUint16(26, name.length, true);
            local.setUint16(28, 0, true);
            parts.push(local, name, body);

            const header = new DataView(new ArrayBuffer(46));
            header.setUint32(0, 0x02014b50, true);
            header.setUint16(4, 20, true);
            header.setUint16(6, 20, true);
            header.setUint16(8, 0x0800, true);
            header.setUint16(10, method, true);
            header.setUint16(12, stamp.time, true);
            header.setUint16(14, stamp.date, true);
            header.setUint32(16, crc, true);
            header.setUint32(20, body.length, true);
            header.setUint32(24, raw.length, true);
            header.setUint16(28, name.length, true);
            header.setUint16(30, 0, true);
            header.setUint16(32, 0, true);
            header.setUint16(34, 0, true);
            header.setUint16(36, 0, true);
            header.setUint32(38, 0, true);
            header.setUint32(42, offset, true);
            central.push(header, name);

            offset += 30 + name.length + body.length;
        }

        const centralSize = central.reduce((sum, part) => sum + part.byteLength, 0);
        const end = new DataView(new ArrayBuffer(22));
        end.setUint32(0, 0x06054b50, true);
        end.setUint16(4, 0, true);
        end.setUint16(6, 0, true);
        end.setUint16(8, entries.length, true);
        end.setUint16(10, entries.length, true);
        end.setUint32(12, centralSize, true);
        end.setUint32(16, offset, true);
        end.setUint16(20, 0, true);

        return new Blob([...parts, ...central, end], { type: "application/zip" });
    }

    async function read(blob) {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const view = new DataView(bytes.buffer);
        const decoder = new TextDecoder();

        let end = -1;
        for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
            if (view.getUint32(i, true) === 0x06054b50) {
                end = i;
                break;
            }
        }
        if (end === -1) throw new Error("This file is not a ZIP archive.");

        const count = view.getUint16(end + 10, true);
        let pointer = view.getUint32(end + 16, true);
        const files = [];

        for (let n = 0; n < count; n++) {
            if (view.getUint32(pointer, true) !== 0x02014b50) throw new Error("The ZIP archive is damaged.");
            const flags = view.getUint16(pointer + 8, true);
            const method = view.getUint16(pointer + 10, true);
            const compressedSize = view.getUint32(pointer + 20, true);
            const nameLength = view.getUint16(pointer + 28, true);
            const extraLength = view.getUint16(pointer + 30, true);
            const commentLength = view.getUint16(pointer + 32, true);
            const localOffset = view.getUint32(pointer + 42, true);
            const path = decoder.decode(bytes.subarray(pointer + 46, pointer + 46 + nameLength)).replace(/\\/g, "/");
            pointer += 46 + nameLength + extraLength + commentLength;

            if (path.endsWith("/")) continue;
            if (flags & 0x1) throw new Error(`${path} is encrypted.`);

            const localName = view.getUint16(localOffset + 26, true);
            const localExtra = view.getUint16(localOffset + 28, true);
            const start = localOffset + 30 + localName + localExtra;
            const data = bytes.subarray(start, start + compressedSize);

            let content;
            if (method === 0) {
                content = data;
            } else if (method === 8) {
                content = await pipe(data, new DecompressionStream("deflate-raw"));
            } else {
                throw new Error(`${path} uses an unsupported compression method.`);
            }

            files.push({ path, blob: new Blob([content], { type: mimeFor(path) }) });
        }

        return files;
    }

    window.CreatorZip = { create, read, mimeFor };
})();