/**
 * 立项申请 — 新建/编辑/查看（独立页面，非项目管理详情 Tab）
 */
(function () {
  const { BU_CODES, BU_LEADS, PEOPLE_POOL, PROJECTS, getRole, getRoleId, setRoleId, getProject, genProjectId, addActivity, buildEstablishApproval, isApplyProject } =
    window.IPM;
  const A = window.IPMApproval;
  const E = window.IPMEdit;

  const params = new URLSearchParams(location.search);
  const isViewPage =
    /apply-view\.html$/i.test(location.pathname) || document.body.classList.contains("apply-view");
  const mode = isViewPage ? "view" : params.get("mode") === "view" ? "view" : "edit";
  const projectId = params.get("id") ? Number(params.get("id")) : null;

  const APPLY_STATUS_TEXT = {
    draft: "待提交",
    reviewing: "审核中",
    pending: "待我审批",
    done: "已通过",
    rejected: "已驳回",
  };

  function esc(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showToast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2400);
  }

  function defaultApplyForm(p) {
    return {
      applyReason: p?.applyReason || "",
      preProjectId: p?.preProjectId || "",
      scopeType: p?.scopeType || "内部",
      initiateDate: p?.initiateDate || p?.establish?.slice(0, 7) || "",
      startDate: p?.startDate || "",
      files: p?.applyFiles || { application: "", approval: "", supplement: "" },
      materialNote: p?.materialNote || "",
    };
  }

  function renderFormHtml(p, readonly) {
    const f = defaultApplyForm(p);
    const buOpts = Object.keys(BU_CODES)
      .map((b) => `<option value="${esc(b)}" ${p?.bu === b ? "selected" : ""}>${esc(b)}</option>`)
      .join("");
    const scopeOpts = ["内部", "外部"]
      .map((s) => `<option value="${esc(s)}" ${f.scopeType === s ? "selected" : ""}>${esc(s)}</option>`)
      .join("");
    const dis = readonly ? "disabled" : "";
    const picker = (id, label, val) =>
      readonly ?
        `<div class="apply-field"><label>${label}</label><div>${esc(val || "—")}</div></div>`
      : E.renderPersonPicker(id, label, val);

    return `
      <div class="apply-alert warn">
        <strong>说明：</strong>立项申请须填写完整后提交审批；<strong>审批通过前不会进入「内部项目管理」列表</strong>。本原型上传为占位，仅记录文件名。
      </div>
      <section class="apply-section">
        <div class="apply-section-title">申请说明</div>
        <div class="apply-section-body">
          <div class="apply-field full">
            <label>申请原因 <span class="req">*</span></label>
            <textarea id="applyReason" ${dis} placeholder="请说明立项背景、业务目的与预期目标">${esc(f.applyReason)}</textarea>
          </div>
        </div>
      </section>
      <section class="apply-section">
        <div class="apply-section-title">基础信息</div>
        <div class="apply-section-body apply-grid">
          <div class="apply-field">
            <label>负责事业部 <span class="req">*</span></label>
            <select id="applyBu" ${dis}>${buOpts}</select>
          </div>
          <div class="apply-field">
            <label>事业部负责人</label>
            <input id="applyBuLead" disabled value="${esc(p?.buLead || BU_LEADS[p?.bu] || "")}" />
            <p class="hint">与组织架构/主数据同步，不可手改</p>
          </div>
          <div class="apply-field">
            <label>项目名称 <span class="req">*</span></label>
            <input id="applyName" ${dis} value="${esc(p?.name || "")}" placeholder="产品/项目名称" />
          </div>
          <div class="apply-field">
            <label>关联预立项 ID</label>
            <input id="applyPreId" ${dis} value="${esc(f.preProjectId)}" placeholder="外部项目必填" />
          </div>
          <div class="apply-field">
            <label>内/外部 <span class="req">*</span></label>
            <select id="applyScope" ${dis}>${scopeOpts}</select>
          </div>
          <div class="apply-field">
            <label>立项时间 <span class="req">*</span></label>
            <input id="applyInitiate" type="date" ${dis} value="${esc(f.initiateDate ? f.initiateDate + (f.initiateDate.length === 7 ? "-01" : "") : "")}" />
          </div>
          <div class="apply-field">
            <label>项目起始时间</label>
            <input id="applyStart" type="date" ${dis} value="${esc(f.startDate || "")}" />
          </div>
          <div class="apply-field full">
            <label>项目简介</label>
            <textarea id="applyDesc" ${dis} placeholder="简要描述项目目标与范围">${esc(p?.desc || "")}</textarea>
          </div>
        </div>
      </section>
      <section class="apply-section">
        <div class="apply-section-title">人员与组织</div>
        <div class="apply-section-body apply-grid">
          ${picker("applyProduct", "项目产品负责人", p?.productOwner)}
          ${picker("applyTech", "项目技术负责人", p?.techLead)}
          <div class="apply-field full">
            <p class="hint">须先选择负责事业部，再从人员库点选（与主站同步，不可手填姓名）。跨事业部协作将在立项后单独标注。</p>
          </div>
        </div>
      </section>
      <section class="apply-section">
        <div class="apply-section-title">立项材料</div>
        <div class="apply-section-body">
          ${readonly ? renderFilesReadonly(f) : renderFilesEdit(f)}
          <div class="apply-field full" style="margin-top:12px">
            <label>材料说明</label>
            <textarea id="applyMaterialNote" ${dis} placeholder="可补充材料清单说明">${esc(f.materialNote)}</textarea>
          </div>
        </div>
      </section>`;
  }

  function renderFilesEdit(f) {
    return `
      <div class="apply-field">
        <label>立项申请书 <span class="req">*</span></label>
        <div class="file-row">
          <input type="file" id="fileApplication" accept=".pdf,.doc,.docx,.png,.jpg" />
          <span class="file-name" id="fileApplicationName">${f.files.application ? "📎 " + esc(f.files.application) : "未选择"}</span>
        </div>
      </div>
      <div class="apply-field">
        <label>立项审批单 / 会议纪要 <span class="req">*</span></label>
        <div class="file-row">
          <input type="file" id="fileApproval" />
          <span class="file-name" id="fileApprovalName">${f.files.approval ? "📎 " + esc(f.files.approval) : "未选择"}</span>
        </div>
      </div>
      <div class="apply-field">
        <label>补充材料（可选）</label>
        <div class="file-row">
          <input type="file" id="fileSupplement" />
          <span class="file-name" id="fileSupplementName">${f.files.supplement ? "📎 " + esc(f.files.supplement) : "未选择"}</span>
        </div>
      </div>`;
  }

  function renderFilesReadonly(f) {
    const row = (label, name) =>
      `<div class="apply-field"><label>${label}</label><div>${name ? "📎 " + esc(name) : "—"}</div></div>`;
    return row("立项申请书", f.files.application) + row("立项审批单 / 会议纪要", f.files.approval) + row("补充材料", f.files.supplement);
  }

  function bindFiles() {
    const bind = (inputId, nameId) => {
      document.getElementById(inputId)?.addEventListener("change", (e) => {
        const f = e.target.files?.[0];
        document.getElementById(nameId).textContent = f ? "📎 " + f.name : "未选择";
      });
    };
    bind("fileApplication", "fileApplicationName");
    bind("fileApproval", "fileApprovalName");
    bind("fileSupplement", "fileSupplementName");
  }

  function readForm() {
    const bu = document.getElementById("applyBu").value;
    const initiate = document.getElementById("applyInitiate").value;
    return {
      applyReason: document.getElementById("applyReason").value.trim(),
      bu,
      buLead: BU_LEADS[bu] || "",
      name: document.getElementById("applyName").value.trim(),
      preProjectId: document.getElementById("applyPreId").value.trim(),
      scopeType: document.getElementById("applyScope").value,
      initiateDate: initiate ? initiate.slice(0, 7) : "",
      startDate: document.getElementById("applyStart").value,
      establish: initiate ? initiate.slice(0, 7) : "",
      desc: document.getElementById("applyDesc").value.trim(),
      productOwner: document.getElementById("applyProductValue")?.value.trim() || "",
      techLead: document.getElementById("applyTechValue")?.value.trim() || "",
      materialNote: document.getElementById("applyMaterialNote").value.trim(),
      files: {
        application: document.getElementById("fileApplicationName")?.textContent.replace(/^📎\s*/, "").trim(),
        approval: document.getElementById("fileApprovalName")?.textContent.replace(/^📎\s*/, "").trim(),
        supplement: document.getElementById("fileSupplementName")?.textContent.replace(/^📎\s*/, "").trim(),
      },
    };
  }

  function validateForm(data, forSubmit) {
    const missing = [];
    if (!data.applyReason) missing.push("申请原因");
    if (!data.bu) missing.push("负责事业部");
    if (!data.name) missing.push("项目名称");
    if (!data.scopeType) missing.push("内/外部");
    if (!data.initiateDate) missing.push("立项时间");
    if (data.scopeType === "外部" && !data.preProjectId) missing.push("关联预立项 ID");
    if (!data.productOwner) missing.push("项目产品负责人");
    if (!data.techLead) missing.push("项目技术负责人");
    if (forSubmit) {
      if (!data.files.application || data.files.application === "未选择") missing.push("立项申请书");
      if (!data.files.approval || data.files.approval === "未选择") missing.push("立项审批单");
    }
    return missing;
  }

  function saveToProject(existing, data, asDraft) {
    let proj = existing;
    if (!proj) {
      const newId = Math.max(0, ...PROJECTS.map((x) => x.id)) + 1;
      proj = {
        id: newId,
        status: "开发中",
        online: "-",
        offline: "-",
        pendingApproval: false,
        createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
        attachments: [],
        activities: [],
        members: { buMembers: [], crossBuMembers: [] },
      };
      PROJECTS.push(proj);
    }
    Object.assign(proj, {
      applyStatus: asDraft ? "draft" : "reviewing",
      bu: data.bu,
      buLead: data.buLead,
      name: data.name,
      establish: data.establish,
      productOwner: data.productOwner,
      techLead: data.techLead,
      desc: data.desc,
      applyReason: data.applyReason,
      preProjectId: data.preProjectId,
      scopeType: data.scopeType,
      initiateDate: data.initiateDate,
      startDate: data.startDate,
      applyFiles: data.files,
      materialNote: data.materialNote,
      pendingInfo: validateForm(data, false).length > 0,
    });
    proj.projectId = genProjectId(proj);
    proj.members = {
      buLead: proj.buLead,
      productOwner: proj.productOwner,
      techLead: proj.techLead,
      buMembers: proj.members?.buMembers || [],
      crossBuMembers: [],
    };
    proj.timeline = proj.timeline || [
      { key: "establish", label: "立项", date: (proj.establish || "") + "-01", done: false, desc: asDraft ? "草稿" : "待审批" },
      { key: "dev", label: "开发", date: "-", done: false, desc: "—" },
      { key: "online", label: "上线", date: "-", done: false, desc: "—" },
      { key: "offline", label: "下线", date: "-", done: false, desc: "—" },
    ];
    proj.approvals = [buildEstablishApproval(proj)];
    const ap = proj.approvals[0];
    ap.formData = { reason: data.applyReason, materialNote: data.materialNote };
    ap.missingFields = validateForm(data, false);
    const fileList = [];
    if (data.files.application && data.files.application !== "未选择") fileList.push({ name: data.files.application, size: "—" });
    if (data.files.approval && data.files.approval !== "未选择") fileList.push({ name: data.files.approval, size: "—" });
    ap.attachments = fileList;
    if (!asDraft) {
      addActivity(proj, {
        type: "create",
        operator: getRole().label.split("（")[0],
        time: new Date().toLocaleString("zh-CN", { hour12: false }),
        summary: "提交内部项目立项申请",
        changes: [{ field: "项目名称", old: "—", new: proj.name }],
      });
    } else {
      ap.phase = "draft";
      ap.submitted = false;
      proj.applyStatus = "draft";
    }
    return proj;
  }

  function bindForm(p) {
    const applyBu = document.getElementById("applyBu");
    const applyBuLead = document.getElementById("applyBuLead");
    applyBu?.addEventListener("change", () => {
      applyBuLead.value = BU_LEADS[applyBu.value] || "—";
    });
    E.bindPersonPicker("applyProduct", () => [document.getElementById("applyTechValue")?.value]);
    E.bindPersonPicker("applyTech", () => [document.getElementById("applyProductValue")?.value]);
    bindFiles();
    if (p?.applyFiles?.application) document.getElementById("fileApplicationName").textContent = "📎 " + p.applyFiles.application;
    if (p?.applyFiles?.approval) document.getElementById("fileApprovalName").textContent = "📎 " + p.applyFiles.approval;
    if (p?.applyFiles?.supplement) document.getElementById("fileSupplementName").textContent = "📎 " + p.applyFiles.supplement;
  }

  function initView(p) {
    const ap = A.getEstablishApproval(p);
    const st = ap ? A.getDisplayStatus(ap, p) : null;
    const code = st?.code || p.applyStatus || "draft";
    const text = APPLY_STATUS_TEXT[code] || code;
    document.getElementById("viewStatusBadge").innerHTML = `<span class="apply-status-text apply-status-${code}">${text}</span>`;
    document.getElementById("pageTitle").textContent = p.name || "立项申请";
    document.getElementById("applyFormMain").innerHTML = renderFormHtml(p, true);
    const footer = document.getElementById("applyFormFooter");
    let actions = `<a class="btn" href="index.html#apply">返回列表</a>`;
    if (getRole().edit(p) && st?.code === "draft") {
      actions += `<a class="btn" href="apply-form.html?id=${p.id}">编辑</a>`;
    }
    if (st?.canApprove || st?.code === "reviewing" || st?.code === "pending" || st?.code === "done" || st?.code === "rejected") {
      actions += `<a class="btn btn-primary" href="detail.html?id=${p.id}&view=approval&approval=${ap.id}&from=apply">${A.APPROVAL_DETAIL_BTN || "审批详情"}</a>`;
    }
    footer.innerHTML = actions;
  }

  function initEdit(p) {
    const isNew = !p;
    document.getElementById("pageTitle").textContent = isNew ? "申请新建项目" : "编辑立项申请";
    document.getElementById("applyFormMain").innerHTML = renderFormHtml(p, false);
    bindForm(p);
    const footer = document.getElementById("applyFormFooter");
    footer.innerHTML = `
      <button type="button" class="btn" id="btnCancel">取消</button>
      <button type="button" class="btn" id="btnSaveDraft">保存草稿</button>
      <button type="button" class="btn btn-primary" id="btnSubmitApply">提交新建申请</button>`;
    document.getElementById("btnCancel").onclick = () => {
      location.href = "index.html#apply";
    };
    document.getElementById("btnSaveDraft").onclick = () => {
      const data = readForm();
      const missing = validateForm(data, false);
      if (!data.name || !data.bu) {
        showToast("请至少填写项目名称与负责事业部");
        return;
      }
      const proj = saveToProject(p, data, true);
      showToast(missing.length ? `已保存草稿，待补全：${missing.join("、")}` : "已保存草稿");
      setTimeout(() => (location.href = `apply-form.html?id=${proj.id}`), 400);
    };
    document.getElementById("btnSubmitApply").onclick = () => {
      const data = readForm();
      const missing = validateForm(data, true);
      if (missing.length) {
        showToast(`请先完善：${missing.join("、")}`);
        return;
      }
      A.confirmAction({
        title: "确认提交",
        message: "确定提交立项申请吗？提交后将进入审批，通过后方可进入项目管理列表。",
        confirmText: "确认提交",
        onConfirm: () => {
          const proj = saveToProject(p, data, false);
          const ap = A.getEstablishApproval(proj);
          const res = ap ? A.submitApproval(proj, ap) : { ok: true };
          if (!res.ok) {
            showToast(res.message || "提交失败");
            return;
          }
          showToast("已提交立项申请");
          setTimeout(() => (location.href = `apply-view.html?id=${proj.id}`), 500);
        },
      });
    };
  }

  function initRoleBar() {
    const sel = document.getElementById("roleSelect");
    if (!sel) return;
    Object.values(window.IPM.ROLES).forEach((r) => {
      const o = document.createElement("option");
      o.value = r.id;
      o.textContent = r.label;
      sel.appendChild(o);
    });
    sel.value = getRoleId();
    sel.addEventListener("change", (e) => setRoleId(e.target.value));
  }

  function init() {
    initRoleBar();
    const p = projectId ? getProject(projectId) : null;
    if (projectId && (!p || !isApplyProject(p))) {
      document.getElementById("applyFormMain").innerHTML =
        '<p class="empty-state">记录不存在或已进入项目管理，<a href="index.html#manage">前往项目管理</a></p>';
      return;
    }
    if (mode === "view") {
      if (!p) {
        location.href = "apply-form.html";
        return;
      }
      initView(p);
      return;
    }
    if (p && p.applyStatus !== "draft") {
      location.href = `apply-view.html?id=${p.id}`;
      return;
    }
    initEdit(p);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
