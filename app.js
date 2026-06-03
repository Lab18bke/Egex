(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  const els = {
    mode: $("#mode"),
    rawWrap: $("#rawWrap"),
    raw: $("#raw"),
    rules: $("#rules"),

    fg: $("#fg"),
    fi: $("#fi"),
    fm: $("#fm"),
    fs: $("#fs"),
    fu: $("#fu"),

    regexOut: $("#regexOut"),
    flagsOut: $("#flagsOut"),
    status: $("#status"),

    text: $("#text"),
    preview: $("#preview"),
    matchInfo: $("#matchInfo"),
    groups: $("#groups"),

    lang: $("#lang"),
    export: $("#export"),
    explain: $("#explain"),

    addBtn: $("#addBtn"),
    resetBtn: $("#resetBtn"),
    presetBtn: $("#presetBtn"),
    shareBtn: $("#shareBtn"),
    exampleBtn: $("#exampleBtn"),

    copyRegexBtn: $("#copyRegexBtn"),
    copyPatBtn: $("#copyPatBtn"),
    copyExportBtn: $("#copyExportBtn"),
  };

  const esc = (s) => String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));

  const safeJSON = (s) => {
    try { return JSON.parse(s); } catch { return null; }
  };

  const encodeState = (obj) => {
    const json = JSON.stringify(obj);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  };

  const decodeState = (b64url) => {
    try {
      const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
      const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
      const json = decodeURIComponent(escape(atob(b64 + pad)));
      return safeJSON(json);
    } catch {
      return null;
    }
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        document.body.removeChild(ta);
        return true;
      } catch {
        document.body.removeChild(ta);
        return false;
      }
    }
  };

  let _toastTimer = null;
  const toast = (msg, ms = 2200) => {
    let el = document.getElementById("__toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "__toast";
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => el.classList.remove("show"), ms);
  };

  const copyWithFeedback = async (btn, getText) => {
    const orig = btn.textContent;
    const ok = await copy(getText());
    if (ok) {
      btn.textContent = "Copied!";
      setTimeout(() => { btn.textContent = orig; }, 1600);
    } else {
      toast("Copy failed — try again");
    }
  };

  const h = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const RULES_DEF = [
    {
      type: "starts_with",
      label: "Starts with",
      params: [
        { key: "text", kind: "text", label: "Text", placeholder: "Hello", def: "" },
        { key: "escape", kind: "toggle", label: "Escape", def: true },
      ],
      build: (p) => "^" + (p.escape ? esc(p.text) : (p.text || "")),
      explain: (p) => ({
        code: "^" + (p.escape ? esc(p.text) : (p.text || "")),
        desc: "Match at the start, then your text.",
        sub: "^ = start of string (or line with m).",
      }),
    },
    {
      type: "exact_text",
      label: "Exact text",
      params: [
        { key: "text", kind: "text", label: "Text", placeholder: "world", def: "" },
        { key: "escape", kind: "toggle", label: "Escape", def: true },
      ],
      build: (p) => (p.escape ? esc(p.text) : (p.text || "")),
      explain: (p) => ({
        code: (p.escape ? esc(p.text) : (p.text || "")),
        desc: "Match this exact text.",
        sub: "Matches sequentially.",
      }),
    },
    {
      type: "ends_with",
      label: "Ends with",
      params: [
        { key: "text", kind: "text", label: "Text", placeholder: ".com", def: "" },
        { key: "escape", kind: "toggle", label: "Escape", def: true },
      ],
      build: (p) => (p.escape ? esc(p.text) : (p.text || "")) + "$",
      explain: (p) => ({
        code: (p.escape ? esc(p.text) : (p.text || "")) + "$",
        desc: "Match your text right before the end.",
        sub: "$ = end of string (or line with m).",
      }),
    },
    {
      type: "anything",
      label: "Anything",
      params: [
        {
          key: "quant",
          kind: "select",
          label: "Amount",
          def: "zero_or_more",
          options: [
            ["zero_or_more", "Zero or more (.*)"],
            ["one_or_more", "One or more (.+)"],
            ["zero_or_more_lazy", "Zero or more, lazy (.*?)"],
            ["one_or_more_lazy", "One or more, lazy (.+?)"],
            ["one", "Exactly one (.)"],
          ],
        },
      ],
      build: (p) => {
        if (p.quant === "one") return ".";
        if (p.quant === "one_or_more") return ".+";
        if (p.quant === "zero_or_more_lazy") return ".*?";
        if (p.quant === "one_or_more_lazy") return ".+?";
        return ".*";
      },
      explain: (p, map) => ({
        code: map.anything.build(p),
        desc: "Match any character sequence.",
        sub: ". = anychar (except newline without s flag).",
      }),
    },
    {
      type: "any_digit",
      label: "Any digit",
      params: [
        {
          key: "quant",
          kind: "select",
          label: "Qty",
          def: "one_or_more",
          options: [
            ["one", "one (\\d)"],
            ["one_or_more", "one+ (\\d+)"],
            ["zero_or_more", "zero+ (\\d*)"],
            ["exact", "exact N (\\d{N})"],
            ["range", "A..B (\\d{A,B})"],
          ],
        },
        { key: "n", kind: "number", label: "N", def: 1, min: 0, max: 999, showIf: (p) => p.quant === "exact" },
        { key: "a", kind: "number", label: "A", def: 1, min: 0, max: 999, showIf: (p) => p.quant === "range" },
        { key: "b", kind: "number", label: "B", def: 3, min: 0, max: 999, showIf: (p) => p.quant === "range" },
      ],
      build: (p) => {
        if (p.quant === "one") return "\\d";
        if (p.quant === "one_or_more") return "\\d+";
        if (p.quant === "zero_or_more") return "\\d*";
        if (p.quant === "exact") return `\\d{${clamp(+p.n || 0, 0, 999)}}`;
        if (p.quant === "range") {
          const a = clamp(+p.a || 0, 0, 999);
          const b = clamp(+p.b || 0, 0, 999);
          return `\\d{${Math.min(a, b)},${Math.max(a, b)}}`;
        }
        return "\\d";
      },
      explain: (p, map) => ({ code: map.any_digit.build(p), desc: "Digits.", sub: "\\d = 0–9." }),
    },
    {
      type: "any_word",
      label: "Word chars",
      params: [
        {
          key: "quant",
          kind: "select",
          label: "Qty",
          def: "one_or_more",
          options: [
            ["one", "one (\\w)"],
            ["one_or_more", "one+ (\\w+)"],
            ["zero_or_more", "zero+ (\\w*)"],
          ],
        },
      ],
      build: (p) => (p.quant === "one" ? "\\w" : p.quant === "zero_or_more" ? "\\w*" : "\\w+"),
      explain: (p, map) => ({ code: map.any_word.build(p), desc: "Word characters.", sub: "\\w = [A-Za-z0-9_]." }),
    },
    {
      type: "whitespace",
      label: "Whitespace",
      params: [
        {
          key: "quant",
          kind: "select",
          label: "Qty",
          def: "one_or_more",
          options: [
            ["one", "one (\\s)"],
            ["one_or_more", "one+ (\\s+)"],
            ["zero_or_more", "zero+ (\\s*)"],
          ],
        },
      ],
      build: (p) => (p.quant === "one" ? "\\s" : p.quant === "zero_or_more" ? "\\s*" : "\\s+"),
      explain: (p, map) => ({ code: map.whitespace.build(p), desc: "Whitespace.", sub: "\\s = space/tab/newline." }),
    },
    {
      type: "any_of",
      label: "Any of (char class)",
      params: [
        { key: "chars", kind: "text", label: "Chars", placeholder: "abc-_.", def: "" },
        { key: "negate", kind: "toggle", label: "Negate", def: false },
      ],
      build: (p) => {
        const raw = String(p.chars || "");
        const escaped = raw.replace(/([\\\]\\^\-])/g, "\\$1");
        return `[${p.negate ? "^" : ""}${escaped}]`;
      },
      explain: (p, map) => ({
        code: map.any_of.build(p),
        desc: p.negate ? "One char NOT in the set." : "One char from the set.",
        sub: "[ ... ] matches one character.",
      }),
    },
    {
      type: "either_or",
      label: "Either / Or",
      params: [
        { key: "a", kind: "text", label: "A", placeholder: "cat", def: "" },
        { key: "b", kind: "text", label: "B", placeholder: "dog", def: "" },
        { key: "escape", kind: "toggle", label: "Escape", def: true },
      ],
      build: (p) => {
        const A = p.escape ? esc(p.a) : (p.a || "");
        const B = p.escape ? esc(p.b) : (p.b || "");
        return `(?:${A}|${B})`;
      },
      explain: (p, map) => ({
        code: map.either_or.build(p),
        desc: "Match option A or option B.",
        sub: "(?: ) = non-capturing group; | = OR.",
      }),
    },
    {
      type: "raw_snippet",
      label: "Raw snippet",
      params: [{ key: "pattern", kind: "text", label: "Snippet", placeholder: "(?:foo|bar)\\s+\\d+", def: "" }],
      build: (p) => (p.pattern || ""),
      explain: (p) => ({ code: (p.pattern || ""), desc: "Insert raw regex.", sub: "Advanced." }),
    },
  ];

  const RULE_MAP = Object.fromEntries(RULES_DEF.map((r) => [r.type, r]));

  const mkRule = (type, params = {}) => {
    const def = RULE_MAP[type] || RULES_DEF[0];
    const p = {};
    for (const f of def.params) p[f.key] = (params[f.key] !== undefined) ? params[f.key] : structuredClone(f.def);
    return { id: uid(), type: def.type, params: p };
  };

  const PRESETS = [
    {
      id: "email",
      name: "Email (basic)",
      mode: "raw",
      flags: { g: true, i: true, m: false, s: false, u: true },
      raw: "^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$",
      sample: "Emails:\n- test@example.com\n- hello+tag@sub.domain.co\n- not: test@@example\n",
    },
    {
      id: "url",
      name: "URL (basic)",
      mode: "raw",
      flags: { g: true, i: true, m: false, s: false, u: true },
      raw: "\\bhttps?:\\/\\/[\\w.-]+(?:\\/[\\w\\-._~%!$&'()*+,;=:@\\/]*)?\\b",
      sample: "Links:\nhttps://example.com\nhttp://sub.example.com/a/b?x=1#z\nnot: htp://wrong\n",
    },
    {
      id: "date",
      name: "Date (YYYY-MM-DD)",
      mode: "build",
      flags: { g: true, i: false, m: false, s: false, u: true },
      rules: [
        mkRule("starts_with", { text: "", escape: true }),
        mkRule("any_digit", { quant: "exact", n: 4 }),
        mkRule("exact_text", { text: "-", escape: true }),
        mkRule("any_digit", { quant: "exact", n: 2 }),
        mkRule("exact_text", { text: "-", escape: true }),
        mkRule("any_digit", { quant: "exact", n: 2 }),
        mkRule("ends_with", { text: "", escape: true }),
      ],
      sample: "Dates:\n2026-06-03\n1999-12-31\nbad: 2026-6-3\n",
    },
  ];

  const DEFAULT = {
    v: 1,
    mode: "build",
    flags: { g: true, i: false, m: false, s: false, u: true },
    raw: "",
    rules: [
      mkRule("starts_with", { text: "", escape: true }),
      mkRule("exact_text", { text: "", escape: true }),
      mkRule("ends_with", { text: "", escape: true }),
    ],
    text: "Hello world 123\nHello there 456\nEmail: test@example.com\n",
  };

  let state = structuredClone(DEFAULT);

  const flagsStr = () => ["g", "i", "m", "s", "u"].filter((f) => !!state.flags[f]).join("");

  const updateURL = () => {
    const url = new URL(location.href);
    url.searchParams.set("s", encodeState({
      v: 1,
      mode: state.mode,
      flags: state.flags,
      raw: state.raw,
      rules: state.rules,
      text: state.text,
    }));
    history.replaceState(null, "", url.toString());
  };

  const apply = (obj) => {
    if (!obj || typeof obj !== "object") return;

    if (obj.mode === "raw" || obj.mode === "build") state.mode = obj.mode;

    if (obj.flags && typeof obj.flags === "object") {
      state.flags = {
        g: !!obj.flags.g,
        i: !!obj.flags.i,
        m: !!obj.flags.m,
        s: !!obj.flags.s,
        u: ("u" in obj.flags) ? !!obj.flags.u : true,
      };
    }

    if (typeof obj.raw === "string") state.raw = obj.raw;
    if (Array.isArray(obj.rules)) state.rules = obj.rules;
    if (typeof obj.text === "string") state.text = obj.text;
  };

  const loadFromURL = () => {
    const url = new URL(location.href);
    const s = url.searchParams.get("s");
    if (!s) return false;
    const obj = decodeState(s);
    if (!obj) return false;
    apply(obj);
    return true;
  };

  const findClassEnd = (s, start) => {
    for (let i = start + 1; i < s.length; i++) {
      if (s[i] === "\\") { i++; continue; }
      if (s[i] === "]") return i;
    }
    return -1;
  };

  const explainRaw = (pattern) => {
    const out = [];
    const push = (code, desc, sub = "") => out.push({ label: "Raw", code, desc, sub });
    const isSpecial = (c) => "\\^$.*+?()[]{}|".includes(c);

    let i = 0;
    while (i < pattern.length) {
      const ch = pattern[i];

      if (ch === "\\") {
        const n = pattern[i + 1] || "";
        const code = "\\" + n;
        if (n === "d") push(code, "A digit.", "\\d");
        else if (n === "w") push(code, "A word char.", "\\w");
        else if (n === "s") push(code, "Whitespace.", "\\s");
        else if (n === "b") push(code, "Word boundary.", "\\b");
        else push(code, "Escaped token / literal.");
        i += 2;
        continue;
      }

      if (ch === "^") { push("^", "Start of string/line."); i++; continue; }
      if (ch === "$") { push("$", "End of string/line."); i++; continue; }
      if (ch === ".") { push(".", "Any char (except newlines unless s)."); i++; continue; }
      if (ch === "+") { push("+", "One or more of previous."); i++; continue; }
      if (ch === "*") { push("*", "Zero or more of previous."); i++; continue; }
      if (ch === "?") { push("?", "Optional (0 or 1)."); i++; continue; }
      if (ch === "|") { push("|", "OR (alternation)."); i++; continue; }

      if (ch === "[") {
        const end = findClassEnd(pattern, i);
        if (end !== -1) {
          push(pattern.slice(i, end + 1), "Character class (one char).");
          i = end + 1;
          continue;
        }
      }

      if (ch === "{") {
        const end = pattern.indexOf("}", i + 1);
        if (end !== -1) {
          push(pattern.slice(i, end + 1), "Exact/range repetition.");
          i = end + 1;
          continue;
        }
      }

      let j = i;
      while (j < pattern.length && !isSpecial(pattern[j])) j++;
      const lit = pattern.slice(i, j);
      if (lit) push(lit, `Literal "${lit}".`);
      i = j;

      if (out.length > 60) break;
    }

    if (out.length > 60) out.push({ label: "Raw", code: "…", desc: "Explanation truncated.", sub: "" });
    return out;
  };

  const current = () => {
    if (state.mode === "raw") {
      return { pattern: state.raw || "", explain: explainRaw(state.raw || "") };
    }
    let pat = "";
    const expl = [];
    for (const r of state.rules) {
      const def = RULE_MAP[r.type];
      if (!def) continue;
      const piece = def.build(r.params || {});
      pat += piece;
      const ex = def.explain ? def.explain(r.params || {}, RULE_MAP) : { code: piece, desc: def.label, sub: "" };
      expl.push({ label: def.label, ...ex });
    }
    return { pattern: pat, explain: expl };
  };

  const compile = () => {
    const { pattern } = current();
    const f = flagsStr();
    try { return { re: new RegExp(pattern, f), err: "" }; }
    catch (e) { return { re: null, err: (e && e.message) ? e.message : String(e) }; }
  };

  const highlight = (text, re, showGroups) => {
    if (!re) return { html: h(text), count: 0, truncated: false };

    const global = re.global;
    let flags = re.flags;
    if (!flags.includes("g")) flags += "g";
    if (!flags.includes("d")) flags += "d";

    let rr;
    try {
      rr = new RegExp(re.source, flags);
    } catch {
      rr = new RegExp(re.source, flags.replace("d", ""));
    }

    let out = [];
    let last = 0;
    let count = 0;
    let truncated = false;
    const MAX = 5000;

    while (true) {
      const m = rr.exec(text);
      if (!m) break;

      const start = m.index;
      const mt = m[0] ?? "";
      const end = start + mt.length;

      if (start > last) out.push(h(text.slice(last, start)));

      if (mt.length === 0) {
        out.push('<mark class="m z">&#8203;</mark>');
        last = start;
        rr.lastIndex = start + 1;
      } else if (!showGroups || m.length <= 1 || !m.indices) {
        out.push(`<mark class="m">${h(mt)}</mark>`);
        last = end;
      } else {
        let charClasses = new Array(mt.length).fill("");
        for (let i = 1; i < m.length; i++) {
          const arr = m.indices[i];
          if (!arr) continue;
          const gs = arr[0] - start;
          const ge = arr[1] - start;
          const groupClass = ` g g${(i - 1) % 6 + 1}`;
          for (let c = gs; c < ge; c++) {
            charClasses[c] += groupClass;
          }
        }

        let inner = "";
        let currentClass = charClasses[0];
        let chunkStart = 0;

        for (let c = 1; c <= mt.length; c++) {
          if (c === mt.length || charClasses[c] !== currentClass) {
            const chunkText = mt.slice(chunkStart, c);
            const cls = currentClass ? currentClass.trim() : "";
            if (cls) {
              inner += `<mark class="${cls}">${h(chunkText)}</mark>`;
            } else {
              inner += h(chunkText);
            }
            if (c < mt.length) {
              currentClass = charClasses[c];
              chunkStart = c;
            }
          }
        }

        out.push(`<mark class="m">${inner}</mark>`);
        last = end;
      }

      count++;
      if (!global) break;
      if (count >= MAX) { truncated = true; break; }
      if (rr.lastIndex === start) rr.lastIndex = start + 1;
      if (rr.lastIndex > text.length) break;
    }

    if (last < text.length) out.push(h(text.slice(last)));
    return { html: out.join(""), count, truncated };
  };

  let hlTimer = null;

  const runHighlightSoon = () => {
    clearTimeout(hlTimer);
    hlTimer = setTimeout(runHighlight, 80);
  };

  const runHighlight = () => {
    const { re, err } = compile();
    const text = state.text || "";

    if (err) {
      els.preview.textContent = text;
      els.matchInfo.innerHTML = `<span class="pill bad">Regex error</span> <span class="pill">${h(err)}</span>`;
      return;
    }

    if (!re) {
      els.preview.textContent = text;
      els.matchInfo.innerHTML = `<span class="pill">No regex</span>`;
      return;
    }

    const res = highlight(text, re, els.groups.checked);
    els.preview.innerHTML = res.html;

    els.matchInfo.innerHTML =
      `<span class="pill good">Matches: ${res.count}</span>` +
      (!re.global ? ` <span class="pill">g off (first match)</span>` : "") +
      (res.truncated ? ` <span class="pill">truncated</span>` : "");
  };

  const strEsc = (s) =>
    String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "\\r").replace(/\n/g, "\\n");

  const renderExport = () => {
    const { pattern } = current();
    const f = flagsStr();
    const lang = els.lang.value;

    if (lang === "js") {
      const canLiteral = !pattern.includes("/") && !pattern.includes("\n") && !pattern.includes("\r");
      els.export.textContent = canLiteral
        ? `// JavaScript\nconst re = /${pattern}/${f};\nconst matches = [..."your text".matchAll(re)];\nconsole.log(matches.map(m => m[0]));`
        : `// JavaScript\nconst re = new RegExp("${strEsc(pattern)}", "${f}");\nconst matches = [..."your text".matchAll(re)];\nconsole.log(matches.map(m => m[0]));`;
      return;
    }

    if (lang === "python") {
      els.export.textContent =
`# Python
import re

pattern = "${strEsc(pattern)}"
flags = 0
${state.flags.i ? "flags |= re.IGNORECASE" : "# flags |= re.IGNORECASE"}
${state.flags.m ? "flags |= re.MULTILINE" : "# flags |= re.MULTILINE"}
${state.flags.s ? "flags |= re.DOTALL" : "# flags |= re.DOTALL"}

rx = re.compile(pattern, flags)
matches = [m.group(0) for m in rx.finditer("your text")]
print(matches)`;
      return;
    }

    const jflags = [];
    if (state.flags.i) jflags.push("Pattern.CASE_INSENSITIVE");
    if (state.flags.m) jflags.push("Pattern.MULTILINE");
    if (state.flags.s) jflags.push("Pattern.DOTALL");
    const suffix = jflags.length ? ", " + jflags.join(" | ") : "";

    els.export.textContent =
`// Java
import java.util.regex.*;
import java.util.*;

Pattern p = Pattern.compile("${strEsc(pattern)}"${suffix});
Matcher m = p.matcher("your text");
List<String> matches = new ArrayList<>();
while (m.find()) matches.add(m.group());
System.out.println(matches);`;
  };

  const renderExplain = () => {
    const { explain } = current();
    els.explain.innerHTML = "";

    const list = explain && explain.length ? explain.slice(0, 60) : [];
    if (!list.length) {
      els.explain.innerHTML = `<div class="small">No explanation yet.</div>`;
      return;
    }

    for (const it of list) {
      const d = document.createElement("div");
      d.className = "exItem";

      const code = document.createElement("div");
      code.className = "mono";
      code.textContent = it.code || "";

      const desc = document.createElement("div");
      desc.textContent = it.desc || "";

      const sub = document.createElement("div");
      sub.className = "small";
      sub.textContent = it.sub || "";

      d.appendChild(code);
      d.appendChild(desc);
      if (it.sub) d.appendChild(sub);

      els.explain.appendChild(d);
    }
  };

  const renderTop = () => {
    els.mode.value = state.mode;
    els.rawWrap.style.display = state.mode === "raw" ? "block" : "none";
    els.raw.value = state.raw || "";

    els.fg.checked = !!state.flags.g;
    els.fi.checked = !!state.flags.i;
    els.fm.checked = !!state.flags.m;
    els.fs.checked = !!state.flags.s;
    els.fu.checked = !!state.flags.u;

    const { pattern } = current();
    const f = flagsStr();

    els.regexOut.textContent = `/${pattern}/${f}`;
    els.flagsOut.textContent = `flags: ${f.split("").join(" ") || "(none)"}`;

    const { err } = compile();
    if (err) {
      els.status.className = "pill bad";
      els.status.textContent = "Invalid";
    } else {
      els.status.className = "pill good";
      els.status.textContent = "Valid";
    }
  };

  let dragId = null;

  const ruleEl = (id) => els.rules.querySelector(`.rule[data-id="${CSS.escape(id)}"]`);

  const dragStart = (e, id) => {
    dragId = id;
    const el = ruleEl(id);
    if (el) el.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const dragOver = (e, overId) => {
    if (!dragId || dragId === overId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const dragDrop = (e, overId) => {
    e.preventDefault();
    const fromId = dragId || e.dataTransfer.getData("text/plain");
    if (!fromId || fromId === overId) return;

    const from = state.rules.findIndex((x) => x.id === fromId);
    const to = state.rules.findIndex((x) => x.id === overId);
    if (from < 0 || to < 0) return;

    const [m] = state.rules.splice(from, 1);
    state.rules.splice(to, 0, m);

    dragId = null;
    sync(true);
  };

  const dragEnd = () => {
    dragId = null;
    $$(".rule").forEach((el) => el.classList.remove("dragging"));
  };

  const renderRules = () => {
    els.rules.innerHTML = "";

    if (state.mode !== "build") {
      els.rules.style.display = "none";
      return;
    }

    els.rules.style.display = "grid";

    for (let idx = 0; idx < state.rules.length; idx++) {
      const r = state.rules[idx];
      const def = RULE_MAP[r.type] || RULES_DEF[0];

      const box = document.createElement("div");
      box.className = "rule";
      box.draggable = true;
      box.dataset.id = r.id;

      box.addEventListener("dragstart", (e) => dragStart(e, r.id));
      box.addEventListener("dragover", (e) => dragOver(e, r.id));
      box.addEventListener("drop", (e) => dragDrop(e, r.id));
      box.addEventListener("dragend", () => dragEnd());

      const rt = document.createElement("div");
      rt.className = "rt";

      const left = document.createElement("div");
      left.className = "left";

      const handle = document.createElement("div");
      handle.className = "handle mono";
      handle.textContent = "";

      const sel = document.createElement("select");
      for (const t of RULES_DEF) {
        const o = document.createElement("option");
        o.value = t.type;
        o.textContent = t.label;
        if (t.type === r.type) o.selected = true;
        sel.appendChild(o);
      }
      sel.addEventListener("change", () => {
        const nr = mkRule(sel.value);
        nr.id = r.id;
        state.rules[idx] = nr;
        sync(true);
      });

      left.appendChild(handle);
      left.appendChild(sel);

      const right = document.createElement("div");
      right.className = "row";

      const dup = document.createElement("button");
      dup.className = "btn";
      dup.textContent = "Dup";
      dup.addEventListener("click", () => {
        const c = structuredClone(r);
        c.id = uid();
        state.rules.splice(idx + 1, 0, c);
        sync(true);
      });

      const del = document.createElement("button");
      del.className = "btn danger";
      del.textContent = "Del";
      del.addEventListener("click", () => {
        state.rules.splice(idx, 1);
        sync(true);
      });

      right.appendChild(dup);
      right.appendChild(del);

      rt.appendChild(left);
      rt.appendChild(right);

      const rb = document.createElement("div");
      rb.className = "rb";

      const fields = document.createElement("div");
      fields.className = "fields";

      for (const p of def.params) {
        const show = p.showIf ? !!p.showIf(r.params || {}) : true;
        if (!show) continue;

        const cell = document.createElement("div");

        if (p.kind === "toggle") {
          const w = document.createElement("label");
          w.className = "inlineCheck";
          w.style.justifyContent = "space-between";
          w.style.width = "100%";

          const sp = document.createElement("span");
          sp.textContent = p.label;

          const input = document.createElement("input");
          input.type = "checkbox";
          input.checked = !!r.params[p.key];
          input.addEventListener("change", () => {
            r.params[p.key] = !!input.checked;
            sync(true);
          });

          w.appendChild(sp);
          w.appendChild(input);
          cell.appendChild(w);
        } else {
          const label = document.createElement("div");
          label.className = "small";
          label.textContent = p.label;
          cell.appendChild(label);

          if (p.kind === "select") {
            const s = document.createElement("select");
            for (const [v, t] of p.options) {
              const o = document.createElement("option");
              o.value = v;
              o.textContent = t;
              if (String(r.params[p.key]) === String(v)) o.selected = true;
              s.appendChild(o);
            }
            s.addEventListener("change", () => {
              r.params[p.key] = s.value;
              sync(true);
            });
            cell.appendChild(s);
          } else if (p.kind === "number") {
            const input = document.createElement("input");
            input.type = "number";
            input.className = "mono";
            input.min = p.min ?? 0;
            input.max = p.max ?? 999;
            input.value = (r.params[p.key] ?? p.def ?? 0);
            input.addEventListener("input", () => {
              r.params[p.key] = input.value === "" ? "" : Number(input.value);
              sync(true);
            });
            cell.appendChild(input);
          } else {
            const input = document.createElement("input");
            input.type = "text";
            input.className = "mono";
            input.placeholder = p.placeholder || "";
            input.value = (r.params[p.key] ?? "");
            input.addEventListener("input", () => {
              r.params[p.key] = input.value;
              sync(false, { skipRuleRender: true });
            });
            cell.appendChild(input);
          }
        }

        fields.appendChild(cell);
      }

      rb.appendChild(fields);
      box.appendChild(rt);
      box.appendChild(rb);
      els.rules.appendChild(box);
    }
  };

  const sync = (full = true, opt = {}) => {
    renderTop();
    if (full && !opt.skipRuleRender) renderRules();
    renderExplain();
    renderExport();
    runHighlightSoon();
    updateURL();
  };

  const bindEvents = () => {
    els.mode.addEventListener("change", () => {
      const next = els.mode.value;
      if (next === "raw" && state.mode === "build") {
        const { pattern } = current();
        if (pattern) state.raw = pattern;
      }
      state.mode = next;
      if (state.mode === "raw") setTimeout(() => { els.raw.select(); }, 0);
      sync(true);
    });

    els.raw.addEventListener("input", () => {
      state.raw = els.raw.value;
      sync(false, { skipRuleRender: true });
    });

    const bindFlag = (el, key) => {
      el.addEventListener("change", () => {
        state.flags[key] = !!el.checked;
        sync(false, { skipRuleRender: true });
      });
    };

    bindFlag(els.fg, "g");
    bindFlag(els.fi, "i");
    bindFlag(els.fm, "m");
    bindFlag(els.fs, "s");
    bindFlag(els.fu, "u");

    els.text.addEventListener("input", () => {
      state.text = els.text.value;
      runHighlightSoon();
      updateURL();
    });

    els.text.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        runHighlight();
      }
    });

    els.groups.addEventListener("change", () => runHighlight());

    els.lang.addEventListener("change", () => renderExport());

    els.addBtn.addEventListener("click", () => {
      if (state.mode !== "build") {
        state.mode = "build";
        els.mode.value = "build";
      }
      state.rules.push(mkRule("exact_text", { text: "", escape: true }));
      sync(true);
      setTimeout(() => {
        const allRules = els.rules.querySelectorAll(".rule");
        const last = allRules[allRules.length - 1];
        if (last) {
          const input = last.querySelector('input[type="text"]');
          if (input) { last.scrollIntoView({ block: "nearest" }); input.focus(); }
        }
      }, 0);
    });

    let _resetPending = false;
    let _resetTimer = null;
    els.resetBtn.addEventListener("click", () => {
      if (_resetPending) {
        clearTimeout(_resetTimer);
        _resetPending = false;
        els.resetBtn.textContent = "Reset";
        state = structuredClone(DEFAULT);
        sync(true);
        toast("Reset to defaults");
      } else {
        _resetPending = true;
        els.resetBtn.textContent = "Sure?";
        _resetTimer = setTimeout(() => {
          _resetPending = false;
          els.resetBtn.textContent = "Reset";
        }, 2500);
      }
    });

    els.exampleBtn.addEventListener("click", () => {
      state.text =
`Example text:

User: alice_01
User: Bob42
Order #12345 total $67.89
Email: test@example.com
Link: https://example.com/a/b?x=1
Date: 2026-06-03
`;
      sync(false, { skipRuleRender: true });
    });

    const presetWrap = document.createElement("div");
    presetWrap.className = "presetWrap";
    els.presetBtn.parentNode.insertBefore(presetWrap, els.presetBtn);
    presetWrap.appendChild(els.presetBtn);

    const presetMenu = document.createElement("div");
    presetMenu.className = "presetMenu";

    for (const p of PRESETS) {
      const item = document.createElement("div");
      item.className = "presetItem";
      item.textContent = p.name;
      item.addEventListener("click", () => {
        state.flags = structuredClone(p.flags);
        state.mode = p.mode;
        if (p.mode === "raw") state.raw = p.raw || "";
        else state.rules = structuredClone(p.rules || []);
        if (p.sample) state.text = p.sample;
        sync(true);
        presetMenu.classList.remove("open");
        toast(`Loaded: ${p.name}`);
      });
      presetMenu.appendChild(item);
    }

    presetWrap.appendChild(presetMenu);

    els.presetBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      presetMenu.classList.toggle("open");
    });

    document.addEventListener("click", () => presetMenu.classList.remove("open"));
    presetMenu.addEventListener("click", (e) => e.stopPropagation());

    els.shareBtn.addEventListener("click", async () => {
      updateURL();
      const ok = await copy(location.href);
      toast(ok ? "Share link copied!" : "Could not copy — URL updated.");
    });

    els.copyRegexBtn.addEventListener("click", () => {
      const { pattern } = current();
      copyWithFeedback(els.copyRegexBtn, () => `/${pattern}/${flagsStr()}`);
    });

    els.copyPatBtn.addEventListener("click", () => {
      const { pattern } = current();
      copyWithFeedback(els.copyPatBtn, () => pattern);
    });

    els.copyExportBtn.addEventListener("click", () => {
      copyWithFeedback(els.copyExportBtn, () => els.export.textContent);
    });
  };

  const boot = () => {
    const loaded = loadFromURL();
    if (!loaded) updateURL();

    els.text.value = state.text;
    bindEvents();
    sync(true);
  };

  boot();
})();
