try {
(() => {
  // fnos/web/bridge.js
  (() => {
    const base = "/app/qingye", listeners = /* @__PURE__ */ new Set();
    let current = null, timer;
    const request = async (route, body) => {
      const r = await fetch(base + "/api/" + route, { method: body === void 0 ? "GET" : "POST", headers: body === void 0 ? {} : { "Content-Type": "application/json", "X-Qingye-Request": "1" }, body: body === void 0 ? void 0 : JSON.stringify(body) });
      const v = await r.json();
      if (!r.ok) throw Error(v.error || "请求失败");
      return v;
    };
    function dialog(title) {
      const d = document.createElement("dialog");
      d.className = "nas-dialog";
      const h = document.createElement("h2");
      h.textContent = title;
      const content = document.createElement("div");
      content.className = "nas-dialog-content";
      const bar = document.createElement("div");
      bar.className = "nas-dialog-actions";
      const cancel = document.createElement("button");
      cancel.textContent = "关闭";
      cancel.className = "secondary";
      cancel.onclick = () => d.close();
      bar.append(cancel);
      d.append(h, content, bar);
      document.body.append(d);
      d.addEventListener("close", () => d.remove(), { once: true });
      d.showModal();
      return { d, content, bar };
    }
    function choose(folderOnly = false) {
      return new Promise((resolve) => {
        const { d, content, bar } = dialog(folderOnly ? "选择 NAS 保存文件夹" : "选择 NAS 文件"), selected = /* @__PURE__ */ new Set();
        let listing;
        const note = document.createElement("p");
        note.className = "note";
        note.textContent = "仅显示飞牛已授权的目录。更改目录授权后，请重启应用。";
        const address = document.createElement("input");
        address.placeholder = "输入授权目录内的完整路径";
        address.setAttribute("aria-label", "NAS 目录路径");
        const go = document.createElement("button");
        go.textContent = "打开目录";
        go.className = "secondary";
        const home = document.createElement("button");
        home.textContent = "授权目录";
        home.className = "link";
        const up = document.createElement("button");
        up.textContent = "上一级";
        up.className = "link";
        const list = document.createElement("div");
        list.className = "nas-browser";
        const error = document.createElement("p");
        error.className = "error";
        content.append(note, address, go, home, up, list, error);
        const confirm = document.createElement("button");
        confirm.className = "primary";
        confirm.textContent = folderOnly ? "保存到此文件夹" : "添加所选文件";
        bar.append(confirm);
        const load = async (p) => {
          try {
            listing = await request("list" + (p ? "?path=" + encodeURIComponent(p) : ""));
            address.value = listing.path || "";
            up.disabled = !listing.parent;
            confirm.disabled = folderOnly && !listing.path;
            list.replaceChildren();
            error.textContent = "";
            for (const item of listing.entries) {
              const row = document.createElement("label");
              row.className = "nas-entry";
              if (item.directory) {
                const button = document.createElement("button");
                button.className = "link";
                button.textContent = "📁 " + item.name;
                button.setAttribute("aria-label", "打开文件夹 " + item.name);
                button.onclick = () => load(item.path);
                row.append(button);
              } else if (!folderOnly) {
                const check = document.createElement("input");
                check.type = "checkbox";
                check.checked = selected.has(item.path);
                check.onchange = () => {
                  if (check.checked) selected.add(item.path);
                  else selected.delete(item.path);
                };
                const name = document.createElement("span");
                name.textContent = item.name;
                row.append(check, name);
              } else continue;
              list.append(row);
            }
            if (!list.children.length) list.textContent = "此目录没有可选择的项目";
          } catch (e) {
            error.textContent = e.message;
          }
        };
        go.onclick = () => load(address.value);
        address.onkeydown = (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            load(address.value);
          }
        };
        home.onclick = () => load(null);
        up.onclick = () => load(listing?.parent);
        confirm.onclick = () => {
          const result = folderOnly ? listing?.path : [...selected];
          if (folderOnly && !result) return;
          resolve(result);
          d.close();
        };
        d.addEventListener("close", () => resolve(folderOnly ? null : []), { once: true });
        load(null);
      });
    }
    async function uploadOne(file, operation) {
      const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2), message = document.getElementById("message");
      let started = false;
      const call = async (route, body, raw = false) => {
        const controller = new AbortController(), timer2 = setTimeout(() => controller.abort(), 6e4);
        try {
          const r = await fetch(base + "/api/" + route, { method: "POST", headers: raw ? { "Content-Type": "application/octet-stream", "X-Qingye-Request": "1" } : { "Content-Type": "application/json", "X-Qingye-Request": "1" }, body: raw ? body : JSON.stringify(body), signal: controller.signal });
          const data = await r.json();
          if (!r.ok) throw Error(data.error || "上传失败 (" + r.status + ")");
          return data;
        } finally {
          clearTimeout(timer2);
        }
      };
      try {
        const startedUpload = await call("upload-start", { id, operation, name: file.name, size: file.size });
        started = true;
        const chunkSize = startedUpload.chunkSize;
        for (let offset = 0; offset < file.size; offset += chunkSize) {
          const chunk = file.slice(offset, Math.min(offset + chunkSize, file.size)), data = await call("upload-chunk?id=" + encodeURIComponent(id), chunk, true);
          const percent = Math.floor(data.received / file.size * 100);
          message.textContent = "正在上传 " + file.name + "… " + percent + "%";
        }
        message.textContent = "文件已收到，正在保存到共享目录…";
        return await call("upload-finish", { id });
      } catch (e) {
        if (started) request("upload-cancel", { id }).catch(() => {
        });
        if (e.name === "AbortError") throw Error("某个上传分块超过 60 秒未收到 NAS 确认，请检查应用状态后重试");
        throw e;
      }
    }
    async function upload(files2, operation) {
      if (files2.length > 100) throw Error("每批最多上传 100 个文件");
      const added2 = [], errors = [];
      for (const file of files2) {
        try {
          const data = await uploadOne(file, operation);
          added2.push(...data.added);
        } catch (e) {
          errors.push(file.name + "：" + e.message);
        }
      }
      return { added: added2, errors };
    }
    async function poll() {
      if (!current) return;
      try {
        const j = await request("job?id=" + encodeURIComponent(current.id));
        current = j;
        for (const cb of listeners) cb(j);
        if (j.status === "running") timer = setTimeout(poll, 700);
      } catch (e) {
        document.getElementById("message").textContent = e.message;
        timer = setTimeout(poll, 3e3);
      }
    }
    window.qingye = {
      pickFiles: async (operation) => request("select", { paths: await choose(), operation }),
      dropFiles: upload,
      pickFolder: () => choose(true),
      start: async (r) => {
        clearTimeout(timer);
        const started = await request("jobs", r);
        current = { id: started.jobId };
        timer = setTimeout(poll, 200);
        return started;
      },
      status: (id) => request("job?id=" + encodeURIComponent(id)),
      cancel: (id) => request("cancel", { id }),
      onEvent: (cb) => listeners.add(cb),
      reveal: async (p) => {
        if (!current) return;
        const j = await request("job?id=" + encodeURIComponent(current.id));
        const result = j.results.find((r) => r.outputs.includes(p));
        if (!result) throw Error("任务输出不存在");
        const { content } = dialog("处理结果");
        for (const file of result.outputs) {
          const row = document.createElement("div");
          row.className = "nas-result";
          const label = document.createElement("p");
          label.textContent = file;
          const link = document.createElement("a");
          link.className = "link";
          link.textContent = "下载到电脑";
          link.href = base + "/api/download?id=" + encodeURIComponent(j.id) + "&path=" + encodeURIComponent(file);
          link.download = "";
          row.append(label, link);
          content.append(row);
        }
      },
      settings: async () => {
        const s = await request("settings");
        document.querySelector(".roots-heading strong").textContent = "应用可访问的 NAS 目录";
        return s;
      },
      addRoot: async () => {
        throw Error("请在飞牛应用设置中授权目录，然后重启轻页");
      },
      removeRoot: async () => {
        throw Error("请在飞牛应用设置中管理授权");
      },
      copyConfig: async () => {
      },
      installComponent: async () => {
      },
      selectComponent: async () => {
      },
      cancelDownload: async () => {
      },
      onComponent: () => {
      }
    };
    const uploadButton = document.createElement("button");
    uploadButton.className = "secondary";
    uploadButton.textContent = "上传电脑文件";
    uploadButton.id = "nas-upload";
    const picker = document.createElement("input");
    picker.type = "file";
    picker.multiple = true;
    picker.hidden = true;
    const stop = (e) => e.stopPropagation();
    for (const type of ["pointerdown", "mousedown", "click"]) {
      uploadButton.addEventListener(type, stop);
      picker.addEventListener(type, stop);
    }
    uploadButton.onclick = () => {
      if (!document.getElementById("cancel").hidden) return;
      picker.click();
    };
    picker.onchange = async () => {
      try {
        const dt = new DataTransfer();
        for (const f of picker.files) dt.items.add(f);
        document.getElementById("dropzone").dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
      } finally {
        picker.value = "";
      }
    };
    document.getElementById("dropzone").append(uploadButton, picker);
    document.querySelector("[data-group=settings]").textContent = "⚙　组件与目录";
  })();

  // src/catalog.mjs
  var OPERATIONS = {
    pdf_compress: { label: "PDF 压缩", group: "pdf", extensions: ["pdf"] },
    pdf_merge: { label: "合并 PDF", group: "pdf", extensions: ["pdf"], combined: true },
    pdf_split: { label: "提取 PDF 页面", group: "pdf", extensions: ["pdf"] },
    pdf_to_images: { label: "PDF 转图片", group: "pdf", extensions: ["pdf"] },
    images_to_pdf: { label: "图片合并为 PDF", group: "pdf", extensions: ["jpg", "jpeg", "png", "webp"], combined: true },
    image_convert: { label: "图片转换 / 压缩", group: "image", extensions: ["jpg", "jpeg", "png", "webp"] },
    office_to_pdf: { label: "Word / Excel / PPT 转 PDF", group: "office", extensions: ["doc", "docx", "xls", "xlsx", "ppt", "pptx"], component: "office" },
    audio_convert: { label: "音频转换 / 提取音频", group: "audio", extensions: ["mp3", "wav", "flac", "m4a", "aac", "ogg", "opus", "mp4", "mov", "mkv", "avi", "webm"], component: "media" },
    video_convert: { label: "视频转 MP4 / 压缩", group: "video", extensions: ["mp4", "mov", "mkv", "avi", "webm", "m4v"], component: "media" }
  };

  // src/toolbox-ui.mjs
  var $ = (id) => document.getElementById(id);
  var api = window.qingye;
  var files = [];
  var folder = null;
  var busy = false;
  var job = null;
  var downloading = false;
  var size = (n) => n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 ** 2).toFixed(2)} MB`;
  var op = () => $("operation").value;
  var safe = (fn) => async () => {
    try {
      await fn();
    } catch (e) {
      $($("settings-panel").hidden ? "message" : "settings-message").textContent = e.message;
    }
  };
  function render() {
    $("files").replaceChildren();
    $("empty").hidden = files.length > 0;
    $("count").textContent = `${files.length} 个文件`;
    for (const id of ["pick", "clear", "folder-pick", "folder-reset", "operation"]) $(id).disabled = busy;
    $("clear").disabled = busy || !files.length;
    $("start").disabled = busy || !files.length || downloading;
    $("cancel").hidden = !busy;
    document.querySelectorAll("input[name=preset],#options input,#options select,nav button").forEach((e) => e.disabled = busy);
    for (let i = 0; i < files.length; i++) {
      const f = files[i], row = document.createElement("div");
      row.className = "file";
      const icon = document.createElement("span");
      icon.className = "pdf-icon";
      icon.textContent = f.name.split(".").pop().toUpperCase().slice(0, 5);
      const info = document.createElement("div");
      info.className = "file-info";
      const name = document.createElement("div");
      name.className = "filename";
      name.textContent = f.name;
      name.title = f.path;
      const detail = document.createElement("div");
      detail.className = "file-detail";
      const r = job?.results.find((r2) => r2.inputs.includes(f.path));
      detail.textContent = r ? r.status === "done" ? `${r.inputs.length > 1 ? "合并任务合计：" : ""}${size(r.before)} → ${size(r.after)} · ${r.outputs.length} 个输出文件` : r.status === "failed" ? r.error : r.status === "cancelled" ? "已取消" : job.stage : `${size(f.size)} · 等待处理`;
      if (r?.status === "failed") detail.classList.add("error");
      info.append(name, detail);
      if (r?.status === "running") {
        const progress = document.createElement("progress");
        progress.max = 100;
        progress.value = job.percent;
        info.append(progress);
      }
      const actions = document.createElement("div");
      actions.className = "actions";
      if (r?.outputs.length) {
        const b = document.createElement("button");
        b.className = "link";
        b.textContent = "打开位置";
        b.onclick = safe(() => api.reveal(r.outputs[0]));
        actions.append(b);
      }
      if (!busy) {
        for (const [label, change] of [["↑", -1], ["↓", 1], ["×", 0]]) {
          const b = document.createElement("button");
          b.className = "link remove";
          b.textContent = label;
          b.setAttribute("aria-label", `${label === "×" ? "移除" : label === "↑" ? "上移" : "下移"} ${f.name}`);
          b.disabled = change === -1 && i === 0 || change === 1 && i === files.length - 1;
          b.onclick = () => {
            if (change) {
              [files[i], files[i + change]] = [files[i + change], files[i]];
            } else files.splice(i, 1);
            job = null;
            render();
          };
          actions.append(b);
        }
      }
      row.append(icon, info, actions);
      $("files").append(row);
    }
  }
  function controls() {
    $("options").replaceChildren();
    const operation = op();
    $("formats").textContent = `${OPERATIONS[operation].extensions.join(" / ").toUpperCase()} · 每批最多 100 个文件`;
    $("operation-note").textContent = OPERATIONS[operation].combined ? "按列表顺序合并，可用箭头调整顺序" : "";
    function field(label, id, values, value, type = "select") {
      const l = document.createElement("label");
      l.textContent = label;
      const e = document.createElement(type === "select" ? "select" : "input");
      e.id = id;
      if (type === "select") {
        for (const v of values) {
          const o = document.createElement("option");
          o.value = v;
          o.textContent = String(v).toUpperCase();
          e.append(o);
        }
      } else e.type = type;
      e.value = value;
      l.append(e);
      $("options").append(l);
    }
    if (operation === "image_convert") field("输出格式", "format", ["jpg", "png", "webp"], "jpg");
    if (operation === "pdf_to_images") field("输出格式", "format", ["png", "jpg"], "png");
    if (["image_convert", "pdf_to_images"].includes(operation)) field("最长边（像素）", "dimension", [], 2600, "number");
    if (operation === "pdf_split") field("提取页码", "pages", [], "1-3", "text");
    if (operation === "audio_convert") field("输出格式", "format", ["mp3", "wav", "flac", "m4a"], "mp3");
    if (operation === "video_convert") field("最大高度", "height", [480, 720, 1080, 2160], 1080);
    if (operation === "office_to_pdf") {
      const p = document.createElement("span");
      p.className = "note";
      p.textContent = "输出 PDF；排版可能受本机字体影响。首次使用需安装办公组件。";
      $("options").append(p);
    }
    document.querySelector(".presets").hidden = ["pdf_merge", "pdf_split", "images_to_pdf", "office_to_pdf"].includes(operation);
  }
  function switchGroup(group) {
    const labels = { pdf: "PDF 工具", office: "办公文档", image: "图片处理", audio: "音频转换", video: "视频转换", settings: "组件与 AI" };
    $("title").textContent = labels[group];
    document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("active", b.dataset.group === group));
    $("work-panel").hidden = group === "settings";
    $("settings-panel").hidden = group !== "settings";
    if (group === "settings") {
      safe(loadSettings)();
      return;
    }
    $("operation").replaceChildren();
    for (const [key, value] of Object.entries(OPERATIONS)) {
      if (value.group === group) {
        const e = document.createElement("option");
        e.value = key;
        e.textContent = value.label;
        $("operation").append(e);
      }
    }
    files = [];
    job = null;
    $("message").textContent = "";
    $("summary").textContent = "准备好，开始处理文件";
    controls();
    render();
  }
  document.querySelectorAll("nav button").forEach((b) => b.onclick = () => switchGroup(b.dataset.group));
  $("operation").onchange = () => {
    files = [];
    job = null;
    controls();
    render();
  };
  function added(r) {
    for (const f of r.added) if (!files.some((v) => v.path === f.path) && files.length < 100) files.push(f);
    job = null;
    $("message").textContent = r.errors.join("\n");
    render();
  }
  $("pick").onclick = (e) => {
    e.stopPropagation();
    safe(async () => added(await api.pickFiles(op())))();
  };
  $("dropzone").onclick = (e) => {
    if (e.target.closest("button,input,label,a")) return;
    if (!busy) safe(async () => added(await api.pickFiles(op())))();
  };
  $("dropzone").onkeydown = (e) => {
    if (e.target === $("dropzone") && ["Enter", " "].includes(e.key)) {
      e.preventDefault();
      $("dropzone").click();
    }
  };
  for (const event of ["dragover", "drop"]) document.addEventListener(event, (e) => e.preventDefault());
  $("dropzone").ondragover = () => {
    if (!busy) $("dropzone").classList.add("drag");
  };
  $("dropzone").ondragleave = () => $("dropzone").classList.remove("drag");
  $("dropzone").ondrop = (e) => {
    $("dropzone").classList.remove("drag");
    if (!busy) safe(async () => added(await api.dropFiles(Array.from(e.dataTransfer.files), op())))();
  };
  document.querySelectorAll("input[name=preset]").forEach((e) => e.onchange = () => document.querySelectorAll(".preset").forEach((l) => l.classList.toggle("selected", l.querySelector("input").checked)));
  $("clear").onclick = () => {
    files = [];
    job = null;
    $("message").textContent = "";
    render();
  };
  $("folder-pick").onclick = safe(async () => {
    const p = await api.pickFolder();
    if (p) {
      folder = p;
      $("folder").textContent = p;
      $("folder").title = p;
      $("folder-reset").hidden = false;
    }
  });
  $("folder-reset").onclick = () => {
    folder = null;
    $("folder").textContent = "第一个文件所在文件夹";
    $("folder-reset").hidden = true;
  };
  $("start").onclick = safe(async () => {
    busy = true;
    job = null;
    $("message").textContent = "";
    $("summary").textContent = "正在处理…";
    render();
    const options = { preset: document.querySelector("input[name=preset]:checked").value };
    if ($("format")) options.format = $("format").value;
    if ($("dimension")) options.maxDimension = Number($("dimension").value);
    if ($("height")) options.maxHeight = Number($("height").value);
    if ($("pages")) options.pages = $("pages").value.replace(/\s/g, "");
    const first = files[0].path, outputDir = folder || first.slice(0, Math.max(first.lastIndexOf("/"), first.lastIndexOf("\\")) + 1);
    try {
      const { jobId } = await api.start({ operation: op(), inputs: files.map((f) => f.path), outputDir, options });
      job = await api.status(jobId);
      updateJob(job);
    } catch (e) {
      busy = false;
      render();
      throw e;
    }
  });
  function updateJob(j) {
    job = j;
    busy = j.status === "running";
    if (!busy) {
      const done = j.results.filter((r) => r.status === "done"), failed = j.results.filter((r) => r.status === "failed");
      $("summary").textContent = `${j.status === "cancelled" ? "任务已停止" : "处理完成"} · ${done.length} 个成功${failed.length ? `，${failed.length} 个失败` : ""}`;
      $("hint").textContent = `已生成 ${j.results.reduce((n, r) => n + r.outputs.length, 0)} 个文件 · 原文件保留`;
      if (j.error) $("message").textContent = j.error;
    } else {
      $("summary").textContent = `${j.stage} ${j.percent}%`;
    }
    render();
  }
  api.onEvent(updateJob);
  $("cancel").onclick = safe(async () => {
    if (job) await api.cancel(job.id);
  });
  async function loadSettings() {
    const s = await api.settings();
    for (const kind of ["media", "office"]) {
      $(`${kind}-status`).textContent = s.components[kind] ? "已就绪：" + s.components[kind] : "未安装";
      document.querySelector(`[data-install=${kind}]`).disabled = downloading || Boolean(s.components[kind]);
    }
    $("roots").replaceChildren();
    if (!s.roots.length) $("roots").textContent = "尚未授权，AI 无法读写任何文件。";
    for (const root of s.roots) {
      const row = document.createElement("div");
      row.className = "root-row";
      const name = document.createElement("span");
      name.textContent = root;
      const b = document.createElement("button");
      b.className = "link";
      b.textContent = "撤销";
      b.onclick = safe(async () => {
        await api.removeRoot(root);
        await loadSettings();
      });
      row.append(name, b);
      $("roots").append(row);
    }
    $("mcp-config").value = s.config.json;
  }
  $("refresh").onclick = safe(loadSettings);
  $("add-root").onclick = safe(async () => {
    await api.addRoot();
    await loadSettings();
  });
  for (const kind of ["json", "toml"]) $(`copy-${kind}`).onclick = safe(async () => {
    await api.copyConfig(kind);
    $("settings-message").textContent = "配置已复制，请在 AI 客户端添加本地 MCP 服务。";
  });
  document.querySelectorAll("[data-select]").forEach((b) => b.onclick = safe(async () => {
    await api.selectComponent(b.dataset.select);
    await loadSettings();
  }));
  document.querySelectorAll("[data-install]").forEach((b) => b.onclick = safe(async () => {
    downloading = true;
    document.querySelectorAll("[data-install],[data-select]").forEach((e) => e.disabled = true);
    $("cancel-download").hidden = false;
    try {
      const r = await api.installComponent(b.dataset.install);
      $("download-status").textContent = r.message;
    } finally {
      downloading = false;
      $("cancel-download").hidden = true;
      document.querySelectorAll("[data-select]").forEach((e) => e.disabled = false);
      await loadSettings();
      render();
    }
  }));
  $("cancel-download").onclick = safe(() => api.cancelDownload());
  api.onComponent((p) => $("download-status").textContent = p.stage);
  switchGroup("pdf");
})();

window.qingyeReady=true;
document.getElementById('message').textContent='';
} catch (error) {
document.getElementById('message').textContent='界面启动失败：'+error.message+'。请刷新页面；如仍失败，请反馈这段提示。';
console.error(error);
}
