/**
 * 项目基础信息 / 人员编辑弹窗（列表页、详情页共用）
 */
(function () {
  const { PEOPLE_POOL, BU_CODES, BU_LEADS, genProjectId, getPersonBu, getRole, addActivity } = window.IPM;

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
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2400);
  }

  function openModal(title, bodyHtml, footerHtml, sizeClass = "") {
    const overlay = document.getElementById("modal");
    if (!overlay) {
      showToast("弹窗未就绪，请刷新页面");
      return false;
    }
    document.getElementById("modalTitle").textContent = title;
    document.getElementById("modalBody").innerHTML = bodyHtml;
    const foot = document.getElementById("modalFooter");
    foot.innerHTML = footerHtml || "";
    foot.classList.toggle("hidden", !footerHtml);
    overlay.className = "modal-overlay show" + (sizeClass ? " " + sizeClass : "");
    return true;
  }

  function closeModal() {
    document.getElementById("modal")?.classList.remove("show");
  }

  function bindModalClose() {
    document.querySelectorAll("#modal [data-close]").forEach((b) => (b.onclick = closeModal));
  }

  function initModalShell() {
    const overlay = document.getElementById("modal");
    if (!overlay || overlay.dataset.bound) return;
    overlay.dataset.bound = "1";
    document.getElementById("modalClose")?.addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => {
      if (e.target.id === "modal") closeModal();
    });
  }

  function renderPersonPicker(id, label, value, hint) {
    return `
      <div class="form-field people-picker-field">
        <label for="${id}Input">${label}</label>
        ${hint ? `<span class="field-hint">${hint}</span>` : ""}
        <div class="people-picker" data-picker="${id}">
          <input type="text" class="people-picker-input" id="${id}Input" value="${esc(value)}" placeholder="输入姓名搜索…" autocomplete="off" />
          <input type="hidden" id="${id}Value" value="${esc(value)}" />
          <ul class="people-picker-list" id="${id}List" role="listbox"></ul>
        </div>
      </div>`;
  }

  function filterPeoplePool(query, exclude) {
    const q = (query || "").trim().toLowerCase();
    const ex = new Set(exclude.filter(Boolean));
    return PEOPLE_POOL.filter((n) => {
      if (ex.has(n)) return false;
      if (!q) return true;
      return n.toLowerCase().includes(q);
    });
  }

  function bindPersonPicker(id, excludeFn) {
    const input = document.getElementById(`${id}Input`);
    const hidden = document.getElementById(`${id}Value`);
    const list = document.getElementById(`${id}List`);
    if (!input || !hidden || !list) return;

    const render = () => {
      const exclude = excludeFn();
      const items = filterPeoplePool(input.value, exclude).slice(0, 12);
      if (!items.length) {
        list.innerHTML = `<li class="people-picker-empty">无匹配人员</li>`;
      } else {
        list.innerHTML = items
          .map((n) => `<li role="option" data-name="${esc(n)}" tabindex="-1">${esc(n)}</li>`)
          .join("");
      }
      list.classList.add("open");
    };

    const pick = (name) => {
      hidden.value = name;
      input.value = name;
      list.classList.remove("open");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };

    input.addEventListener("focus", render);
    input.addEventListener("input", render);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") list.classList.remove("open");
      if (e.key === "Enter") {
        const first = list.querySelector("li[data-name]");
        if (first) {
          e.preventDefault();
          pick(first.dataset.name);
        }
      }
    });
    list.addEventListener("mousedown", (e) => {
      const li = e.target.closest("li[data-name]");
      if (li) {
        e.preventDefault();
        pick(li.dataset.name);
      }
    });
    input.addEventListener("blur", () => {
      setTimeout(() => list.classList.remove("open"), 120);
    });
  }

  function collectUnifiedMembers(p) {
    const m = p.members || {};
    const list = [];
    const seen = new Set();
    (m.buMembers || []).forEach((name) => {
      if (!name || seen.has(name)) return;
      seen.add(name);
      list.push({ name, bu: p.bu || getPersonBu(name) });
    });
    (m.crossBuMembers || []).forEach((x) => {
      const name = typeof x === "string" ? x : x?.name;
      if (!name || seen.has(name)) return;
      seen.add(name);
      list.push({ name, bu: (typeof x === "object" && x.bu) || getPersonBu(name) });
    });
    return list;
  }

  function renderPeopleEditBody(p) {
    return `
      <div class="people-edit-form">
        <p class="form-section-title">项目负责人</p>
        <div class="edit-form-grid" style="margin-bottom:16px">
          ${renderPersonPicker("peProduct", "项目产品负责人", p.productOwner)}
          ${renderPersonPicker("peTech", "项目技术负责人", p.techLead)}
          <div class="form-field full change-approval-reason hidden" id="peChangeReasonWrap">
            <label>变更说明 <span class="req">*</span></label>
            <textarea id="peChangeReason" placeholder="变更产品/技术负责人时须填写说明"></textarea>
          </div>
        </div>
        <p class="field-hint" style="margin-bottom:12px">变更<strong>产品/技术负责人</strong>须提交审批（与列表「编辑」逻辑一致）；项目成员可直接保存。保存后详情页仍按本事业部 / 跨事业部分开展示。</p>
        <p class="form-section-title">项目成员</p>
        <p class="field-hint" style="margin-bottom:8px">下方搜索姓名可添加成员（不区分事业部）；已添加成员点击 × 可移除</p>
        <div class="member-chip-list" id="peMemberChips"></div>
        <div class="people-picker people-picker-add" data-picker="peAdd">
          <input type="text" class="people-picker-input" id="peAddInput" placeholder="搜索姓名添加成员…" autocomplete="off" />
          <ul class="people-picker-list" id="peAddList" role="listbox"></ul>
        </div>
      </div>`;
  }

  function readPeopleEditOwners(p) {
    const productOwner = document.getElementById("peProductValue")?.value.trim() || p.productOwner;
    const techLead = document.getElementById("peTechValue")?.value.trim() || p.techLead;
    const reason = document.getElementById("peChangeReason")?.value.trim() || "";
    return {
      productOwner,
      techLead,
      reason,
      productChanged: productOwner !== p.productOwner,
      techChanged: techLead !== p.techLead,
      ownerChanged: productOwner !== p.productOwner || techLead !== p.techLead,
    };
  }

  function bindPeopleEditOwners(p) {
    if (hasActiveOwnerChange(p, "product")) {
      document.getElementById("peProductInput")?.setAttribute("disabled", "disabled");
    }
    if (hasActiveOwnerChange(p, "tech")) {
      document.getElementById("peTechInput")?.setAttribute("disabled", "disabled");
    }
    bindPersonPicker("peProduct", () => [document.getElementById("peTechValue")?.value]);
    bindPersonPicker("peTech", () => [document.getElementById("peProductValue")?.value]);

    const wrap = document.getElementById("peChangeReasonWrap");
    const btnApproval = document.getElementById("peSubmitApproval");
    const sync = () => {
      const o = readPeopleEditOwners(p);
      const need = o.productChanged || o.techChanged;
      wrap?.classList.toggle("hidden", !need);
      btnApproval?.classList.toggle("hidden", !need);
    };
    document.getElementById("peProductInput")?.addEventListener("input", sync);
    document.getElementById("peTechInput")?.addEventListener("input", sync);
    document.getElementById("peProductInput")?.addEventListener("change", sync);
    document.getElementById("peTechInput")?.addEventListener("change", sync);
    sync();
  }

  function bindPeopleEditForm(p) {
    const chipsEl = document.getElementById("peMemberChips");
    let members = collectUnifiedMembers(p);

    const getOwners = () => {
      const o = readPeopleEditOwners(p);
      return [o.productOwner, o.techLead];
    };

    const memberNames = () => members.map((m) => m.name);

    const renderChips = () => {
      if (!members.length) {
        chipsEl.innerHTML = '<span class="member-chips-empty">暂无成员，请下方搜索添加</span>';
        return;
      }
      chipsEl.innerHTML = members
        .map(
          (m) =>
            `<span class="member-chip">${esc(m.name)}<span class="member-chip-bu">${esc(m.bu)}</span><button type="button" class="member-chip-remove" data-name="${esc(m.name)}" aria-label="移除">×</button></span>`
        )
        .join("");
      chipsEl.querySelectorAll(".member-chip-remove").forEach((btn) => {
        btn.addEventListener("click", () => {
          members = members.filter((x) => x.name !== btn.dataset.name);
          renderChips();
        });
      });
    };

    const addInput = document.getElementById("peAddInput");
    const addList = document.getElementById("peAddList");

    const renderAddList = () => {
      const exclude = [...getOwners(), ...memberNames()];
      const items = filterPeoplePool(addInput.value, exclude).slice(0, 12);
      if (!items.length) {
        addList.innerHTML = `<li class="people-picker-empty">无匹配人员</li>`;
      } else {
        addList.innerHTML = items
          .map((n) => {
            const bu = getPersonBu(n);
            return `<li role="option" data-name="${esc(n)}" data-bu="${esc(bu)}">+ ${esc(n)}<span class="people-picker-bu">${esc(bu)}</span></li>`;
          })
          .join("");
      }
      addList.classList.add("open");
    };

    addInput.addEventListener("focus", renderAddList);
    addInput.addEventListener("input", renderAddList);
    addList.addEventListener("mousedown", (e) => {
      const li = e.target.closest("li[data-name]");
      if (!li) return;
      e.preventDefault();
      const name = li.dataset.name;
      if (!memberNames().includes(name)) {
        members.push({ name, bu: li.dataset.bu || getPersonBu(name) });
        renderChips();
      }
      addInput.value = "";
      addList.classList.remove("open");
    });
    addInput.addEventListener("blur", () => {
      setTimeout(() => addList.classList.remove("open"), 120);
    });

    renderChips();
    bindPeopleEditOwners(p);

    return () => ({
      members: members.map((m) => ({ name: m.name, bu: m.bu })),
      ...readPeopleEditOwners(p),
    });
  }

  function formatMembersLabel(buNames, crossList) {
    const parts = [...(buNames || [])];
    (crossList || []).forEach((x) => {
      const name = typeof x === "string" ? x : x?.name;
      const bu = typeof x === "object" ? x?.bu : "";
      if (name) parts.push(bu ? `${name}（${bu}）` : name);
    });
    return parts.join("、") || "—";
  }

  function applyPeopleToProject(p, data) {
    const oldBu = [...(p.members?.buMembers || [])];
    const oldCross = [...(p.members?.crossBuMembers || [])];
    const productOwner = data.productOwner ?? p.productOwner;
    const techLead = data.techLead ?? p.techLead;
    if (!p.members) {
      p.members = { buLead: p.buLead, productOwner, techLead, buMembers: [], crossBuMembers: [] };
    }
    const buMembers = [];
    const crossBuMembers = [];
    const seen = new Set();
    (data.members || []).forEach((m) => {
      const name = typeof m === "string" ? m : m?.name;
      if (!name || name === productOwner || name === techLead || seen.has(name)) return;
      seen.add(name);
      const bu = (typeof m === "object" && m.bu) || getPersonBu(name);
      if (bu === p.bu) buMembers.push(name);
      else crossBuMembers.push({ name, bu });
    });
    p.members.buMembers = buMembers;
    p.members.crossBuMembers = crossBuMembers;
    p.members.productOwner = productOwner;
    p.members.techLead = techLead;
    return { oldBu, oldCross };
  }

  function renderBasicEditBody(p) {
    const buOpts = Object.keys(BU_CODES)
      .map((b) => `<option value="${esc(b)}" ${b === p.bu ? "selected" : ""}>${esc(b)}</option>`)
      .join("");
    return `
      <div class="edit-form-grid">
        <div class="form-field"><label>项目名称</label><input id="editName" value="${esc(p.name)}" /></div>
        <div class="form-field"><label>负责事业部</label><select id="editBu">${buOpts}</select></div>
        <div class="form-field"><label>事业部负责人</label><input id="editBuLead" disabled value="${esc(p.buLead)}" /></div>
        <div class="form-field"><label>立项年月</label><input id="editEstablish" type="month" value="${esc(p.establish)}" /></div>
        <div class="form-field"><label>项目ID</label><input id="editProjectId" disabled value="${esc(p.projectId)}" /></div>
        ${renderPersonPicker("editProduct", "项目产品负责人", p.productOwner)}
        ${renderPersonPicker("editTech", "项目技术负责人", p.techLead)}
        <div class="form-field full"><label>项目简介</label><textarea id="editDesc">${esc(p.desc || "")}</textarea></div>
        <div class="form-field full change-approval-reason hidden" id="changeReasonWrap">
          <label>变更说明 <span class="req">*</span></label>
          <textarea id="changeReason" placeholder="变更事业部或负责人时须填写说明"></textarea>
        </div>
      </div>
      <p class="field-hint">变更<strong>负责事业部、产品/技术负责人</strong>须提交审批；项目名称、立项年月、简介可直接保存。成员与负责人也可在「编辑人员」中维护（负责人变更同样须审批）。</p>`;
  }

  function readBasicEditForm(p) {
    const bu = document.getElementById("editBu").value;
    const productOwner = document.getElementById("editProductValue")?.value.trim() || p.productOwner;
    const techLead = document.getElementById("editTechValue")?.value.trim() || p.techLead;
    return {
      name: document.getElementById("editName").value.trim() || p.name,
      bu,
      buLead: BU_LEADS[bu] || p.buLead,
      establish: document.getElementById("editEstablish").value || p.establish,
      desc: document.getElementById("editDesc").value.trim(),
      productOwner,
      techLead,
      reason: document.getElementById("changeReason")?.value.trim() || "",
      buChanged: bu !== p.bu,
      productChanged: productOwner !== p.productOwner,
      techChanged: techLead !== p.techLead,
      ownerChanged: productOwner !== p.productOwner || techLead !== p.techLead,
    };
  }

  function hasActiveBuChange(p) {
    return (p.approvals || []).some((a) => a.type === "buChange" && (a.phase === "reviewing" || a.phase === "draft"));
  }

  function hasActiveOwnerChange(p, role) {
    return (p.approvals || []).some(
      (a) => a.type === "ownerChange" && a.payload?.role === role && (a.phase === "reviewing" || a.phase === "draft")
    );
  }

  function bindBasicEditForm(p) {
    const editBu = document.getElementById("editBu");
    const editBuLead = document.getElementById("editBuLead");
    const wrap = document.getElementById("changeReasonWrap");
    const btnSubmit = document.getElementById("btnSubmitApproval");

    if (hasActiveBuChange(p)) editBu.disabled = true;
    if (hasActiveOwnerChange(p, "product")) {
      document.getElementById("editProductInput")?.setAttribute("disabled", "disabled");
    }
    if (hasActiveOwnerChange(p, "tech")) {
      document.getElementById("editTechInput")?.setAttribute("disabled", "disabled");
    }

    bindPersonPicker("editProduct", () => [document.getElementById("editTechValue")?.value]);
    bindPersonPicker("editTech", () => [document.getElementById("editProductValue")?.value]);

    const syncApprovalUi = () => {
      const data = readBasicEditForm(p);
      editBuLead.value = BU_LEADS[data.bu] || "—";
      const needApproval =
        (data.buChanged && !editBu.disabled) || data.productChanged || data.techChanged;
      wrap?.classList.toggle("hidden", !needApproval);
      btnSubmit?.classList.toggle("hidden", !needApproval);
    };
    editBu.addEventListener("change", syncApprovalUi);
    document.getElementById("editProductInput")?.addEventListener("change", syncApprovalUi);
    document.getElementById("editTechInput")?.addEventListener("change", syncApprovalUi);
    document.getElementById("editProductInput")?.addEventListener("input", syncApprovalUi);
    document.getElementById("editTechInput")?.addEventListener("input", syncApprovalUi);
    syncApprovalUi();
  }

  function submitOwnerChangeApproval(p, role, to, reason) {
    const label = role === "product" ? "项目产品负责人" : "项目技术负责人";
    const current = role === "product" ? p.productOwner : p.techLead;
    if (to === current) return null;
    const ap = {
      id: `ap-${p.id}-owner-${role}-${Date.now()}`,
      type: "ownerChange",
      typeLabel: `${label}变更`,
      phase: "reviewing",
      submitted: true,
      submitter: p.productOwner,
      submittedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
      formData: { reason },
      missingFields: [],
      attachments: [{ name: "负责人变更说明.docx", size: "128KB" }],
      steps: [
        { key: "buLead", label: "事业部负责人", assignee: p.buLead, status: "active" },
        { key: "executive", label: "超级管理层", assignee: "轮值VP", status: "waiting" },
      ],
      currentStepIndex: 0,
      payload: { role, roleLabel: label, from: current, to, reason },
    };
    p.approvals = (p.approvals || []).filter(
      (a) => !(a.type === "ownerChange" && a.payload?.role === role && (a.phase === "reviewing" || a.phase === "draft"))
    );
    p.approvals.push(ap);
    window.IPMApproval.submitApproval(p, ap);
    window.IPMApproval.syncLegacyFromApprovals(p);
    addActivity(p, {
      type: "approval",
      operator: getRole().label.split("（")[0],
      time: ap.submittedAt,
      summary: `${label}变更申请`,
      changes: [{ field: label, old: current, new: to + "（待审批）" }],
    });
    return ap;
  }

  function saveBasicFieldsDirect(p, data) {
    const changes = [];
    const old = { name: p.name, establish: p.establish, desc: p.desc || "" };
    p.name = data.name;
    p.establish = data.establish;
    p.desc = data.desc;
    if (p.pendingInfo && p.desc) p.pendingInfo = false;
    const newPid = genProjectId(p);
    if (newPid !== p.projectId) {
      changes.push({ field: "项目ID", old: p.projectId, new: newPid });
      p.projectId = newPid;
    }
    if (old.name !== p.name) changes.push({ field: "项目名称", old: old.name, new: p.name });
    if (old.establish !== p.establish) changes.push({ field: "立项年月", old: old.establish, new: p.establish });
    if (old.desc !== p.desc) changes.push({ field: "项目简介", old: old.desc || "—", new: p.desc || "—" });
    if (changes.length) {
      addActivity(p, {
        type: "sync",
        operator: getRole().label.split("（")[0],
        time: new Date().toLocaleString("zh-CN", { hour12: false }),
        summary: "更新基础信息",
        changes,
      });
    }
    return changes.length > 0;
  }

  function submitBuChangeApproval(p, data) {
    if (!data.reason) {
      showToast("请填写变更说明");
      return null;
    }
    const ap = {
      id: `ap-${p.id}-bu-${Date.now()}`,
      type: "buChange",
      typeLabel: "事业部变更",
      phase: "reviewing",
      submitted: true,
      submitter: p.productOwner,
      submittedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
      formData: { reason: data.reason },
      missingFields: [],
      attachments: [{ name: "事业部变更说明.docx", size: "96KB" }],
      steps: [
        { key: "buLead", label: "事业部负责人", assignee: BU_LEADS[data.bu] || p.buLead, status: "active" },
        { key: "executive", label: "超级管理层", assignee: "轮值VP", status: "waiting" },
      ],
      currentStepIndex: 0,
      payload: {
        fromBu: p.bu,
        toBu: data.bu,
        fromLead: p.buLead,
        toBuLead: data.buLead,
        name: data.name,
        desc: data.desc,
        establish: data.establish,
      },
    };
    p.approvals = (p.approvals || []).filter((a) => a.type !== "buChange" || a.phase === "approved" || a.phase === "rejected");
    p.approvals.push(ap);
    window.IPMApproval.submitApproval(p, ap);
    addActivity(p, {
      type: "approval",
      operator: getRole().label.split("（")[0],
      time: ap.submittedAt,
      summary: "事业部变更申请",
      changes: [
        { field: "负责事业部", old: p.bu, new: data.bu + "（待审批）" },
        { field: "项目名称", old: p.name, new: data.name },
      ],
    });
    return ap;
  }

  function openEditBasicModal(p, onSaved) {
    initModalShell();
    if (
      !openModal(
        "编辑基础信息",
        renderBasicEditBody(p),
        `<button type="button" class="btn" data-close>取消</button>
         <button type="button" class="btn" id="saveBasic">保存</button>
         <button type="button" class="btn btn-primary hidden" id="btnSubmitApproval">提交审批</button>`,
        "large"
      )
    )
      return;
    bindBasicEditForm(p);

    document.getElementById("saveBasic").onclick = () => {
      const data = readBasicEditForm(p);
      if (data.buChanged || data.ownerChanged) {
        showToast("事业部或负责人已变更，请填写说明后点击「提交审批」");
        return;
      }
      window.IPMApproval.confirmAction({
        title: "确认保存",
        message: "确定保存基础信息修改吗？",
        confirmText: "确认保存",
        onConfirm: () => {
          saveBasicFieldsDirect(p, data);
          closeModal();
          showToast("基础信息已保存");
          onSaved?.();
        },
      });
    };

    document.getElementById("btnSubmitApproval").onclick = () => {
      const data = readBasicEditForm(p);
      if (!data.buChanged && !data.ownerChanged) {
        showToast("未变更事业部或负责人，无需提交审批");
        return;
      }
      if (!data.reason) {
        showToast("请填写变更说明");
        return;
      }
      let msg = "确定提交以下变更审批吗？";
      if (data.buChanged) msg += `<p>负责事业部：<strong>${esc(p.bu)}</strong> → <strong>${esc(data.bu)}</strong></p>`;
      if (data.productChanged) msg += `<p>产品负责人：<strong>${esc(p.productOwner)}</strong> → <strong>${esc(data.productOwner)}</strong></p>`;
      if (data.techChanged) msg += `<p>技术负责人：<strong>${esc(p.techLead)}</strong> → <strong>${esc(data.techLead)}</strong></p>`;
      window.IPMApproval.confirmAction({
        title: "确认提交审批",
        message: msg,
        confirmText: "确认提交",
        onConfirm: () => {
          if (data.buChanged) submitBuChangeApproval(p, data);
          if (data.productChanged) submitOwnerChangeApproval(p, "product", data.productOwner, data.reason);
          if (data.techChanged) submitOwnerChangeApproval(p, "tech", data.techLead, data.reason);
          if (data.name !== p.name || data.desc !== (p.desc || "") || data.establish !== p.establish) {
            saveBasicFieldsDirect(p, { ...data, bu: p.bu, buLead: p.buLead, buChanged: false });
          }
          closeModal();
          showToast("已提交审批");
          onSaved?.();
        },
      });
    };
    bindModalClose();
  }

  function savePeopleMembersOnly(p, data) {
    const { oldBu, oldCross } = applyPeopleToProject(p, data);
    const oldLabel = formatMembersLabel(oldBu, oldCross);
    const newLabel = formatMembersLabel(p.members.buMembers, p.members.crossBuMembers);
    if (oldLabel !== newLabel) {
      addActivity(p, {
        type: "member",
        operator: getRole().label.split("（")[0],
        time: new Date().toLocaleString("zh-CN", { hour12: false }),
        summary: "更新项目成员",
        changes: [{ field: "项目成员", old: oldLabel, new: newLabel }],
      });
    }
  }

  function openPeopleEditModal(p, onSaved) {
    initModalShell();
    if (
      !openModal(
        "编辑人员",
        renderPeopleEditBody(p),
        `<button type="button" class="btn" data-close>取消</button>
         <button type="button" class="btn" id="savePeople">保存</button>
         <button type="button" class="btn btn-primary hidden" id="peSubmitApproval">提交审批</button>`,
        "large"
      )
    )
      return;
    const readForm = bindPeopleEditForm(p);

    document.getElementById("savePeople").onclick = () => {
      const data = readForm();
      if (data.ownerChanged) {
        showToast("负责人已变更，请填写说明后点击「提交审批」");
        return;
      }
      window.IPMApproval.confirmAction({
        title: "确认保存",
        message: "确定保存项目成员吗？",
        confirmText: "确认保存",
        onConfirm: () => {
          savePeopleMembersOnly(p, data);
          closeModal();
          showToast("成员已保存");
          onSaved?.();
        },
      });
    };

    document.getElementById("peSubmitApproval").onclick = () => {
      const data = readForm();
      if (!data.ownerChanged) {
        showToast("未变更负责人，无需提交审批");
        return;
      }
      if (!data.reason) {
        showToast("请填写变更说明");
        return;
      }
      let msg = "确定提交以下负责人变更审批吗？";
      if (data.productChanged) {
        msg += `<p>产品负责人：<strong>${esc(p.productOwner)}</strong> → <strong>${esc(data.productOwner)}</strong></p>`;
      }
      if (data.techChanged) {
        msg += `<p>技术负责人：<strong>${esc(p.techLead)}</strong> → <strong>${esc(data.techLead)}</strong></p>`;
      }
      window.IPMApproval.confirmAction({
        title: "确认提交审批",
        message: msg,
        confirmText: "确认提交",
        onConfirm: () => {
          if (data.productChanged) submitOwnerChangeApproval(p, "product", data.productOwner, data.reason);
          if (data.techChanged) submitOwnerChangeApproval(p, "tech", data.techLead, data.reason);
          savePeopleMembersOnly(p, data);
          closeModal();
          showToast("已提交审批");
          onSaved?.();
        },
      });
    };
    bindModalClose();
  }

  function renderApplyFormBody(p) {
    const buOpts = Object.keys(BU_CODES)
      .map((b) => `<option value="${esc(b)}" ${p && p.bu === b ? "selected" : ""}>${esc(b)}</option>`)
      .join("");
    const bu = p?.bu || Object.keys(BU_CODES)[0];
    const buLead = p?.buLead || BU_LEADS[bu] || "";
    return `
      <div class="edit-form-grid">
        <div class="form-field"><label>项目名称 <span class="req">*</span></label>
          <input id="applyName" value="${esc(p?.name || "")}" placeholder="产品/项目名称" /></div>
        <div class="form-field"><label>负责事业部 <span class="req">*</span></label>
          <select id="applyBu">${buOpts}</select></div>
        <div class="form-field"><label>事业部负责人</label>
          <input id="applyBuLead" disabled value="${esc(buLead)}" /></div>
        <div class="form-field"><label>立项年月 <span class="req">*</span></label>
          <input id="applyEstablish" type="month" value="${esc(p?.establish || "")}" /></div>
        ${renderPersonPicker("applyProduct", "项目产品负责人", p?.productOwner || "")}
        ${renderPersonPicker("applyTech", "项目技术负责人", p?.techLead || "")}
        <div class="form-field full"><label>项目简介</label>
          <textarea id="applyDesc" placeholder="简要描述项目目标与范围">${esc(p?.desc || "")}</textarea></div>
      </div>
      <p class="field-hint">可先「仅保存」草稿，补全简介后「提交申请」进入立项审批流程；审批通过后生成项目ID并进入项目管理列表。</p>`;
  }

  function readApplyForm(p) {
    const bu = document.getElementById("applyBu").value;
    return {
      name: document.getElementById("applyName").value.trim(),
      bu,
      buLead: BU_LEADS[bu] || "",
      establish: document.getElementById("applyEstablish").value,
      productOwner: document.getElementById("applyProductValue").value.trim(),
      techLead: document.getElementById("applyTechValue").value.trim(),
      desc: document.getElementById("applyDesc").value.trim(),
    };
  }

  function bindApplyForm(p) {
    const applyBu = document.getElementById("applyBu");
    const applyBuLead = document.getElementById("applyBuLead");
    applyBu.addEventListener("change", () => {
      applyBuLead.value = BU_LEADS[applyBu.value] || "—";
    });
    bindPersonPicker("applyProduct", () => [document.getElementById("applyTechValue")?.value]);
    bindPersonPicker("applyTech", () => [document.getElementById("applyProductValue")?.value]);
  }

  function upsertApplyProject(existing, data, asDraft) {
    let proj = existing;
    if (!proj) {
      const newId = Math.max(0, ...window.IPM.PROJECTS.map((x) => x.id)) + 1;
      proj = {
        id: newId,
        applyStatus: asDraft ? "draft" : "reviewing",
        status: "开发中",
        online: "-",
        offline: "-",
        pendingInfo: !data.desc,
        pendingApproval: false,
        createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
        attachments: [],
        activities: [],
      };
      window.IPM.PROJECTS.push(proj);
    }
    Object.assign(proj, data);
    proj.applyStatus = asDraft ? "draft" : "reviewing";
    proj.pendingInfo = !data.desc?.trim();
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
    proj.approvals = [window.IPM.buildEstablishApproval(proj)];
    const ap = proj.approvals[0];
    ap.formData = { reason: data.desc };
    ap.missingFields = !data.desc?.trim() ? ["项目简介"] : [];
    if (!asDraft) {
      window.IPMApproval.submitApproval(proj, ap);
      addActivity(proj, {
        type: "create",
        operator: getRole().label.split("（")[0],
        time: ap.submittedAt,
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

  function openApplyFormModal(p, onSaved) {
    initModalShell();
    if (
      !openModal(
        p ? "编辑立项申请" : "新建立项申请",
        renderApplyFormBody(p),
        `<button type="button" class="btn" data-close>取消</button>
         <button type="button" class="btn" id="saveApplyDraft">仅保存</button>
         <button type="button" class="btn btn-primary" id="submitApply">提交申请</button>`,
        "large"
      )
    )
      return;
    bindApplyForm(p);

    document.getElementById("saveApplyDraft").onclick = () => {
      const data = readApplyForm(p);
      if (!data.name || !data.bu || !data.establish || !data.productOwner || !data.techLead) {
        showToast("请填写必填项");
        return;
      }
      upsertApplyProject(p, data, true);
      closeModal();
      showToast("已保存草稿");
      onSaved?.();
    };

    document.getElementById("submitApply").onclick = () => {
      const data = readApplyForm(p);
      if (!data.name || !data.bu || !data.establish || !data.productOwner || !data.techLead) {
        showToast("请填写必填项");
        return;
      }
      if (!data.desc) {
        showToast("请填写项目简介");
        return;
      }
      window.IPMApproval.confirmAction({
        title: "确认提交申请",
        message: "确定提交内部项目立项申请吗？提交后将进入审批流程。",
        confirmText: "确认提交",
        onConfirm: () => {
          const proj = upsertApplyProject(p, data, false);
          closeModal();
          showToast("立项申请已提交");
          onSaved?.();
        },
      });
    };
    bindModalClose();
  }

  window.IPMEdit = {
    esc,
    showToast,
    openModal,
    closeModal,
    bindModalClose,
    openEditBasicModal,
    openPeopleEditModal,
    openApplyFormModal,
    initModalShell,
    renderPersonPicker,
    bindPersonPicker,
  };

  document.addEventListener("DOMContentLoaded", initModalShell);
})(window);
