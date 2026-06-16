/**
 * 项目详情页 — 概览 / 人员与组织 / 状态与上下线 / 申请新建
 */
(function () {
  const { BU_CODES, ROLES, PEOPLE_POOL, getRole, getRoleId, setRoleId, getProject, statusClass, addActivity, genProjectId, PROJECTS, isApplyProject } = window.IPM;
  const A = window.IPMApproval;

  const params = new URLSearchParams(location.search);
  const mode = params.get("mode") === "apply" ? "apply" : "view";
  const pageView = params.get("view");
  let projectId = params.get("id") ? Number(params.get("id")) : null;
  let activeTab = params.get("tab") || "overview";
  const focusApprovalId = params.get("approval");

  const VALID_TABS = ["overview", "people", "status"];

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

  function openModal(title, bodyHtml, footerHtml, sizeClass = "") {
    document.getElementById("modalTitle").textContent = title;
    document.getElementById("modalBody").innerHTML = bodyHtml;
    const foot = document.getElementById("modalFooter");
    foot.innerHTML = footerHtml || "";
    foot.classList.toggle("hidden", !footerHtml);
    const overlay = document.getElementById("modal");
    overlay.className = "modal-overlay show" + (sizeClass ? " " + sizeClass : "");
    overlay.classList.add("show");
  }

  function closeModal() {
    document.getElementById("modal").classList.remove("show");
  }

  function updateUrl(tab) {
    if (mode === "apply") {
      history.replaceState(null, "", "detail.html?mode=apply");
      return;
    }
    if (pageView === "approval" && focusApprovalId) {
      const q = new URLSearchParams({
        id: String(projectId),
        view: "approval",
        approval: focusApprovalId,
        from: params.get("from") || "approve",
      });
      history.replaceState(null, "", `detail.html?${q}`);
      return;
    }
    const p = getProject(projectId);
    if (!p) return;
    const q = new URLSearchParams({ id: String(projectId), tab });
    history.replaceState(null, "", `detail.html?${q}`);
  }

  function goApprovalDetail(ap) {
    const q = new URLSearchParams({
      id: String(projectId),
      view: "approval",
      approval: ap.id,
      from: params.get("from") || "approve",
    });
    location.href = `detail.html?${q}`;
  }

  function tabForApproval(ap) {
    if (ap.type === "ownerChange") return "people";
    if (ap.type === "status") return "status";
    return "overview";
  }

  function goContinueDraftEdit(p, ap) {
    if (ap.type === "ownerChange") {
      location.href = `detail.html?id=${p.id}&tab=overview&openEdit=1&from=${params.get("from") || "approve"}`;
      return;
    }
    const q = new URLSearchParams({
      id: String(p.id),
      tab: tabForApproval(ap),
      draft: ap.id,
      from: params.get("from") || "approve",
    });
    location.href = `detail.html?${q}`;
  }

  function getStatusCfg(type) {
    const map = {
      online: { label: "上线申请", target: "上线" },
      offline: { label: "下线申请", target: "下线" },
      terminate: { label: "终止申请", target: "下线" },
    };
    return map[type] || map.online;
  }

  function canEdit() {
    const p = getProject(projectId);
    return p && !p.applyStatus && getRole().edit(p);
  }

  function canApproveProject(p) {
    if (!p) return false;
    return A.getVisibleApprovals(p).some((a) => A.getDisplayStatus(a, p)?.canApprove);
  }

  function findApprovalByType(p, type) {
    return (p.approvals || []).find((a) => a.type === type && (a.phase === "reviewing" || a.phase === "draft"));
  }

  function renderApprovalBanner(p, type) {
    const ap = findApprovalByType(p, type) || A.getActiveApprovals(p).find((a) => a.type === type);
    if (!ap) return "";
    const st = A.getDisplayStatus(ap, p);
    if (!st) return "";
    return `<div class="alert-banner ${st.code === "draft" ? "warn" : "info"}">
      <strong>${esc(ap.typeLabel)} · ${esc(st.text)}</strong>
      <div style="margin-top:6px;font-size:12px">${esc(st.hint || "")}</div>
      <div style="margin-top:10px">
        <button type="button" class="btn btn-primary" id="btnGoApprovalDetail" data-approval-id="${esc(ap.id)}">审批详情</button>
      </div>
    </div>`;
  }

  function tabBadgeCount(tab) {
    const p = getProject(projectId);
    if (!p) return 0;
    return A.getVisibleApprovals(p).filter((a) => {
      if (tab === "people" && a.type === "ownerChange") return true;
      if (tab === "status" && a.type === "status") return true;
      return false;
    }).length;
  }

  /* ─── 申请新建（无 Tab） ─── */
  function renderApplyMode() {
    document.title = "新建内部项目申请 — 内部项目管理原型图";
    document.getElementById("detailTabsWrap").classList.add("hidden");
    document.getElementById("pageheadActions").innerHTML = "";

    const buOpts = Object.keys(BU_CODES)
      .map((b) => `<option value="${esc(b)}">${esc(b)}</option>`)
      .join("");

    document.getElementById("detailContent").innerHTML = `
      <form class="apply-form" id="applyForm">
        <div class="form-section">
          <h3>基础信息</h3>
          <div class="form-grid">
            <div class="form-field">
              <label>项目名称 <span class="req">*</span></label>
              <input name="name" required placeholder="产品/项目名称" />
            </div>
            <div class="form-field">
              <label>负责事业部 <span class="req">*</span></label>
              <select name="bu" required>${buOpts}</select>
            </div>
            <div class="form-field">
              <label>立项年月 <span class="req">*</span></label>
              <input name="establish" type="month" required />
            </div>
            <div class="form-field">
              <label>项目产品负责人 <span class="req">*</span></label>
              <select name="productOwner" required>${peopleOptions()}</select>
            </div>
            <div class="form-field">
              <label>项目技术负责人 <span class="req">*</span></label>
              <select name="techLead" required>${peopleOptions()}</select>
            </div>
            <div class="form-field full">
              <label>项目简介</label>
              <textarea name="desc" placeholder="简要描述项目目标与范围"></textarea>
            </div>
          </div>
        </div>
        <div class="form-section">
          <h3>说明</h3>
          <p style="font-size:13px;color:var(--text-secondary);line-height:1.7">
            提交后将进入审批流程；项目ID 将在审批通过后根据<strong>事业部编号 + 立项年月</strong>自动生成。
            事业部负责人等字段将与预立项/主数据同步。
          </p>
        </div>
        <div class="form-actions">
          <button type="button" class="btn" id="btnApplyCancel">取消</button>
          <button type="submit" class="btn btn-primary">提交申请</button>
        </div>
      </form>`;

    document.getElementById("pageheadTitle").textContent = "新建内部项目申请";
    document.getElementById("pageheadMeta").innerHTML = `<span>单页表单 · 无 Tab 分栏</span>`;

    document.getElementById("applyForm").addEventListener("submit", (e) => {
      e.preventDefault();
      A.confirmAction({
        title: "确认提交申请",
        message: "确定提交内部项目立项申请吗？提交后将进入审批流程。",
        confirmText: "确认提交",
        onConfirm: () => submitApplyForm(e.target),
      });
    });

    document.getElementById("btnApplyCancel").addEventListener("click", () => {
      location.href = "index.html#apply";
    });
  }

  function submitApplyForm(form) {
      const fd = new FormData(form);
      const bu = fd.get("bu");
      const establish = fd.get("establish");
      const newId = Math.max(...PROJECTS.map((x) => x.id)) + 1;
      const buLeadMap = window.IPM.BU_LEADS;
      const draft = {
        id: newId,
        bu,
        buLead: buLeadMap[bu] || "—",
        name: fd.get("name"),
        establish,
        status: "开发中",
        online: "-",
        offline: "-",
        productOwner: fd.get("productOwner"),
        techLead: fd.get("techLead"),
        desc: fd.get("desc") || "",
        pendingInfo: true,
        pendingApproval: false,
      };
      draft.projectId = genProjectId(draft);
      draft.members = {
        buLead: draft.buLead,
        productOwner: draft.productOwner,
        techLead: draft.techLead,
        buMembers: [],
        crossBuMembers: [],
      };
      draft.timeline = [
        { key: "establish", label: "立项", date: establish + "-01", done: false, desc: "待审批" },
        { key: "dev", label: "开发", date: "-", done: false, desc: "—" },
        { key: "online", label: "上线", date: "-", done: false, desc: "—" },
        { key: "offline", label: "下线", date: "-", done: false, desc: "—" },
      ];
      draft.activities = [
        {
          id: `${newId}-new`,
          type: "create",
          operator: draft.productOwner,
          time: new Date().toLocaleString("zh-CN", { hour12: false }),
          summary: "提交内部项目立项申请",
          changes: [{ field: "项目名称", old: "—", new: draft.name }],
        },
      ];
      draft.attachments = [];
      draft.approvals = [];
      PROJECTS.push(draft);
      showToast("申请已提交（原型）");
      setTimeout(() => {
        location.href = `detail.html?id=${newId}&tab=overview`;
      }, 600);
  }

  function peopleOptions(selected) {
    return PEOPLE_POOL.map((n) => `<option value="${esc(n)}" ${n === selected ? "selected" : ""}>${esc(n)}</option>`).join("");
  }

  /* ─── 页头 ─── */
  function renderPagehead() {
    const p = getProject(projectId);
    if (!p) {
      document.getElementById("pageheadTitle").textContent = "项目不存在";
      return;
    }

    const tags = [];
    if (p.pendingInfo) tags.push('<span class="action-tag tag-warn">待完善资料</span>');
    if (p.pendingApproval) tags.push('<span class="action-tag tag-danger">待审批</span>');

    document.getElementById("pageheadTitle").textContent = p.name;
    document.getElementById("pageheadMeta").innerHTML = `
      <span>项目ID <code>${esc(p.projectId)}</code></span>
      <span>负责事业部 ${esc(p.bu)}</span>
      <span class="status-badge ${statusClass(p.status)}">${esc(p.status)}</span>
      ${tags.join(" ")}`;

    const actions = [];
    if (canApproveProject(p)) {
      actions.push('<button type="button" class="btn btn-primary" id="btnQuickApprove">审批详情</button>');
    }
    document.getElementById("pageheadActions").innerHTML = actions.join("");
    document.getElementById("btnQuickApprove")?.addEventListener("click", () => {
      const ap = A.getActiveApprovals(p).find((a) => A.getDisplayStatus(a, p)?.canApprove);
      if (ap) goApprovalDetail(ap);
    });
  }

  /* ─── 审批详情页（从列表点「审批」进入） ─── */
  function renderApprovalDetailView() {
    const p = getProject(projectId);
    const ap = focusApprovalId ? A.findApproval(p, focusApprovalId) : null;
    if (!p || !ap) {
      document.getElementById("pageheadTitle").textContent = "审批不存在";
      document.getElementById("detailContent").innerHTML =
        '<div class="empty-state"><a href="index.html#approve">返回审批列表</a></div>';
      return;
    }

    const st = A.getDisplayStatus(ap, p);
    document.getElementById("detailRoot").classList.add("approval-detail-page");
    document.getElementById("detailTabsWrap").classList.add("hidden");
    document.title = `审批详情 — ${ap.typeLabel} — 内部项目管理原型图`;

    const backBtn = document.getElementById("btnBack");
    const fromTab = params.get("from") || "approve";
    backBtn.textContent = fromTab === "apply" ? "← 返回申请列表" : "← 返回审批列表";
    backBtn.onclick = () => {
      location.href = fromTab === "apply" ? "index.html#apply" : `index.html#${fromTab === "manage" ? "manage" : "approve"}`;
    };

    document.getElementById("pageheadTitle").textContent = ap.typeLabel;
    document.getElementById("pageheadMeta").innerHTML = `
      <span>项目：<strong>${esc(p.name)}</strong></span>
      <span>${esc(p.projectId)}</span>
      ${st ? A.statusBadgeHtml(ap, p, false) : ""}
      ${st?.hint ? `<span style="color:var(--text-secondary);font-size:12px">${esc(st.hint)}</span>` : ""}`;
    document.getElementById("pageheadActions").innerHTML = "";

    const reason = ap.formData?.reason || ap.payload?.reason || "—";
    const payloadExtra =
      ap.type === "ownerChange" ?
        `<div class="item"><label>变更内容</label><div>${esc(ap.payload?.roleLabel)}：${esc(ap.payload?.from)} → ${esc(ap.payload?.to)}</div></div>`
      : ap.type === "status" ?
        `<div class="item"><label>目标状态</label><div>${esc(ap.payload?.targetStatus)}</div></div>`
      : ap.type === "buChange" ?
        `<div class="item"><label>负责事业部</label><div>${esc(ap.payload?.fromBu)} → ${esc(ap.payload?.toBu)}</div></div>
         <div class="item"><label>事业部负责人</label><div>${esc(ap.payload?.fromLead)} → ${esc(ap.payload?.toBuLead)}</div></div>`
      : "";

    let actionsHtml = `<a class="btn" href="detail.html?id=${p.id}&tab=overview">查看项目详情</a>`;
    if (st?.canApprove) {
      actionsHtml =
        `<button type="button" class="btn btn-primary" id="btnDetailPass">通过</button>
         <button type="button" class="btn" id="btnDetailReject">驳回</button>
         <span class="spacer"></span>` + actionsHtml;
    } else if (st?.code === "draft" && st.canSubmit) {
      actionsHtml =
        `<button type="button" class="btn btn-primary" id="btnDetailContinue">继续填写</button>
         <span class="spacer"></span>` + actionsHtml;
    }

    document.getElementById("detailContent").innerHTML = `
      <div class="approval-detail-summary">
        <div class="item"><label>申请类型</label><div>${esc(ap.typeLabel)}</div></div>
        <div class="item"><label>申请人</label><div>${esc(ap.submitter)}</div></div>
        <div class="item"><label>提交时间</label><div>${esc(ap.submittedAt || "尚未提交")}</div></div>
        ${ap.finishedAt ? `<div class="item"><label>完成时间</label><div>${esc(ap.finishedAt)}</div></div>` : ""}
        <div class="item"><label>申请说明</label><div>${esc(reason)}</div></div>
        ${payloadExtra}
      </div>
      <div class="approval-detail-flow">
        <h3>审批流程</h3>
        ${A.renderFlowChart(ap, p)}
      </div>
      <div class="approval-detail-actions">${actionsHtml}</div>`;

    document.getElementById("detailContent").querySelectorAll(".btn-view-file").forEach((btn) => {
      btn.addEventListener("click", () => A.showFilePreview(btn.dataset.file));
    });

    document.getElementById("btnDetailPass")?.addEventListener("click", () => {
      A.confirmAction({
        title: "确认通过",
        message: "请确认已查阅相关材料。确定通过该审批吗？",
        confirmText: "确认通过",
        onConfirm: () => {
          handleApprovalPass(p, ap);
        },
      });
    });
    document.getElementById("btnDetailReject")?.addEventListener("click", () => {
      A.confirmAction({
        title: "确认驳回",
        message: "确定驳回该审批吗？",
        confirmText: "确认驳回",
        danger: true,
        onConfirm: () => handleApprovalReject(p, ap),
      });
    });
    document.getElementById("btnDetailContinue")?.addEventListener("click", () => goContinueDraftEdit(p, ap));
  }

  function handleApprovalPass(p, ap) {
    if (ap.type === "establish") {
      A.advanceApproval(p, ap, true);
      addActivity(p, {
        type: "approval",
        operator: getRole().label.split("（")[0],
        time: new Date().toLocaleString("zh-CN", { hour12: false }),
        summary: "立项申请已通过",
        changes: [{ field: "项目", old: "立项中", new: "已纳入项目管理" }],
      });
    } else if (ap.type === "ownerChange") {
      const oc = ap.payload;
      A.advanceApproval(p, ap, true);
      addActivity(p, {
        type: "approval",
        operator: getRole().label.split("（")[0],
        time: new Date().toLocaleString("zh-CN", { hour12: false }),
        summary: `负责人变更已通过：${oc.roleLabel}`,
        changes: [{ field: oc.roleLabel, old: oc.from, new: oc.to }],
      });
    } else if (ap.type === "status") {
      A.advanceApproval(p, ap, true);
      const today = new Date().toISOString().slice(0, 10);
      if (ap.payload?.targetStatus === "上线") {
        p.timeline.find((n) => n.key === "online").done = true;
        p.timeline.find((n) => n.key === "online").date = today;
      } else {
        p.timeline.find((n) => n.key === "offline").done = true;
        p.timeline.find((n) => n.key === "offline").date = today;
      }
      addActivity(p, {
        type: "status",
        operator: getRole().label.split("（")[0],
        time: new Date().toLocaleString("zh-CN", { hour12: false }),
        summary: `${ap.typeLabel}已通过`,
        changes: [{ field: "状态", old: "—", new: p.status }],
      });
    } else if (ap.type === "delete") {
      A.advanceApproval(p, ap, true);
    } else {
      A.advanceApproval(p, ap, true);
    }
    showToast("审批已通过");
    renderApprovalDetailView();
  }

  function handleApprovalReject(p, ap) {
    A.advanceApproval(p, ap, false);
    showToast("已驳回");
    renderApprovalDetailView();
  }

  function renderTabs() {
    const tabs = [
      { id: "overview", label: "概览" },
      { id: "people", label: "人员与组织" },
      { id: "status", label: "状态与上下线" },
    ];
    document.getElementById("detailTabs").innerHTML = tabs
      .map((t) => {
        const badge = tabBadgeCount(t.id);
        return `<button type="button" data-tab="${t.id}" class="${t.id === activeTab ? "active" : ""}">
          ${t.label}${badge ? `<span class="tab-badge">${badge}</span>` : ""}
        </button>`;
      })
      .join("");
  }

  function switchDetailTab(tab) {
    if (!VALID_TABS.includes(tab)) tab = "overview";
    activeTab = tab;
    renderTabs();
    renderTabContent();
    updateUrl(tab);
  }

  /* ─── Tab: 概览 ─── */
  function renderOverview(p) {
    const actFilter = document.getElementById("activityTypeFilter")?.value || "all";
    const activities = p.activities.filter((a) => actFilter === "all" || a.type === actFilter);

    const buBanner = renderApprovalBanner(p, "buChange");
    const establishBanner = p.applyStatus ? renderApprovalBanner(p, "establish") : "";

    return `
      ${p.applyStatus ? `<div class="alert-banner info"><strong>立项申请中</strong>审批通过后将进入内部项目管理列表。</div>` : ""}
      ${p.pendingInfo && !p.applyStatus ? `<div class="alert-banner warn"><strong>待完善资料</strong>请补充项目简介或上传立项附件后提交复核。</div>` : ""}
      ${establishBanner}
      ${buBanner}
      <div class="detail-section">
        <div class="section-head">
          <h3>基础信息</h3>
          ${canEdit() ? '<button type="button" class="btn btn-primary" id="btnEditBasic">编辑基础信息</button>' : ""}
        </div>
        <div class="info-grid" id="basicInfoGrid">
          ${infoItem("项目名称", p.name)}
          ${infoItem("项目ID", `<code>${esc(p.projectId)}</code>`)}
          ${infoItem("负责事业部", p.bu)}
          ${infoItem("事业部负责人", p.buLead)}
          ${infoItem("立项年月", p.establish)}
          ${infoItem("当前状态", `<span class="status-badge ${statusClass(p.status)}">${esc(p.status)}</span>`)}
          ${infoItem("项目简介", p.desc || "—")}
          ${infoItem("上线时间", p.online)}
          ${infoItem("下线时间", p.offline)}
        </div>
      </div>

      <div class="detail-section">
        <div class="section-head"><h3>项目时间轴<span class="sub">4 个关键节点</span></h3></div>
        <div class="timeline">${renderTimeline(p)}</div>
      </div>

      <div class="detail-section">
        <div class="section-head"><h3>操作日志</h3></div>
        <div class="activity-toolbar">
          <select id="activityTypeFilter" class="btn" style="height:32px">
            <option value="all">全部类型</option>
            <option value="create">立项</option>
            <option value="sync">同步</option>
            <option value="status">状态</option>
            <option value="approval">审批</option>
            <option value="member">人员</option>
          </select>
        </div>
        <div class="activity-list" id="activityList">${renderActivities(activities)}</div>
      </div>`;
  }

  function infoItem(label, val) {
    return `<div class="info-item"><label>${esc(label)}</label><div class="val">${val}</div></div>`;
  }

  function renderTimeline(p) {
    const currentKey =
      p.status === "下线" ? "offline" : p.status === "上线" ? "online" : p.online !== "-" ? "online" : "dev";
    return p.timeline
      .map((node) => {
        let cls = "timeline-node";
        if (node.done) cls += " done";
        else if (node.key === currentKey || (!node.done && node.key === "dev" && p.status === "开发中")) cls += " current";
        return `<div class="${cls}">
          <div class="timeline-dot">${node.done ? "✓" : node.label.charAt(0)}</div>
          <div class="tl-label">${esc(node.label)}</div>
          <div class="tl-date">${esc(node.date)}</div>
          <div class="tl-desc">${esc(node.desc)}</div>
        </div>`;
      })
      .join("");
  }

  function renderActivities(list) {
    if (!list.length) return '<div class="empty-state" style="padding:24px">暂无操作日志</div>';
    const typeMap = { create: "立项", sync: "同步", status: "状态", approval: "审批", member: "人员" };
    return list
      .map((a) => {
        const changesHtml =
          a.changes?.length ?
            `<div class="activity-changes"><table class="change-table"><thead><tr><th>字段</th><th>变更前</th><th>变更后</th></tr></thead><tbody>
            ${a.changes.map((c) => `<tr><td>${esc(c.field)}</td><td>${esc(c.old)}</td><td>${esc(c.new)}</td></tr>`).join("")}
            </tbody></table></div>`
          : "";
        return `<details class="activity-item" ${a.changes?.length ? "open" : ""}>
          <summary>
            <span class="activity-type type-${a.type}">${typeMap[a.type] || a.type}</span>
            <span class="activity-summary"><strong>${esc(a.operator)}</strong> · ${esc(a.summary)}</span>
            <span class="activity-time">${esc(a.time)}</span>
          </summary>
          ${changesHtml}
        </details>`;
      })
      .join("");
  }

  function findDraftApproval(p, type, draftId) {
    const list = p.approvals || [];
    if (draftId) {
      const ap = list.find((a) => a.id === draftId && a.phase === "draft");
      if (!ap) return null;
      if (type && ap.type !== type) return null;
      return ap;
    }
    return list.find((a) => a.type === type && a.phase === "draft");
  }

  function renderOwnerDraftPanel(p, ap) {
    const oc = ap.payload || {};
    const role = oc.role || "product";
    const label = oc.roleLabel || (role === "product" ? "项目产品负责人" : "项目技术负责人");
    const current = oc.from || (role === "product" ? p.productOwner : p.techLead);
    const toVal = oc.to || "";
    const reason = ap.formData?.reason || oc.reason || "";
    return `
      <div class="detail-section draft-form-panel" id="draftFormPanel">
        <div class="section-head">
          <h3>${esc(ap.typeLabel || label + "变更")}<span class="sub">草稿 · 待提交</span></h3>
          <a class="link" href="detail.html?id=${p.id}&view=approval&approval=${esc(ap.id)}&from=approve">审批详情</a>
        </div>
        <div class="draft-form-body">
          <div class="form-field"><label>现任</label><input disabled value="${esc(current)}" /></div>
          ${IPMEdit.renderPersonPicker("ownerDraftTo", "变更为", toVal || current)}
          <div class="form-field"><label>变更原因 <span class="req">*</span></label>
            <textarea id="ownerDraftReason" placeholder="请说明变更原因">${esc(reason)}</textarea></div>
          <div class="draft-form-actions">
            <button type="button" class="btn" id="saveOwnerDraftInline">仅保存</button>
            <button type="button" class="btn btn-primary" id="submitOwnerDraftInline">提交审批</button>
          </div>
        </div>
      </div>`;
  }

  function renderStatusDraftPanel(p, ap) {
    const type = ap.payload?.type || "online";
    const cfg = getStatusCfg(type);
    const reason = ap.formData?.reason || "";
    return `
      <div class="detail-section draft-form-panel" id="draftFormPanel">
        <div class="section-head">
          <h3>${esc(ap.typeLabel || cfg.label)}<span class="sub">草稿 · 待提交</span></h3>
          <a class="link" href="detail.html?id=${p.id}&view=approval&approval=${esc(ap.id)}&from=approve">审批详情</a>
        </div>
        <div class="draft-form-body">
          <div class="form-field"><label>目标状态</label><input disabled value="${esc(cfg.target)}" /></div>
          <div class="form-field"><label>申请说明 <span class="req">*</span></label>
            <textarea id="statusDraftReason" placeholder="请说明申请原因与准备情况">${esc(reason)}</textarea></div>
          <div class="form-field"><label>附件（原型）</label>
            <input type="file" disabled />
            <span class="form-hint">演示环境不可上传；上线申请需上传验收材料</span></div>
          <div class="draft-form-actions">
            <button type="button" class="btn" id="saveStatusDraftInline">仅保存</button>
            <button type="button" class="btn btn-primary" id="submitStatusDraftInline">提交审批</button>
          </div>
        </div>
      </div>`;
  }

  function upsertStatusApproval(p, type, existingDraft, submit) {
    const cfg = getStatusCfg(type);
    const reason = document.getElementById("statusDraftReason")?.value.trim() ||
      document.getElementById("statusReason")?.value.trim() || "";
    let ap = existingDraft || findApprovalByType(p, "status");
    if (!ap) {
      ap = {
        id: `ap-${p.id}-status-${Date.now()}`,
        type: "status",
        typeLabel: cfg.label,
        phase: submit ? "reviewing" : "draft",
        submitted: !!submit,
        submitter: p.productOwner,
        steps: [
          { key: "buLead", label: "事业部负责人", assignee: p.buLead, status: "waiting" },
          { key: "executive", label: "超级管理层", assignee: "轮值VP", status: "waiting" },
        ],
        currentStepIndex: 0,
        payload: { type, targetStatus: cfg.target },
        requireFiles: true,
        attachments: [],
      };
      p.approvals = (p.approvals || []).filter((a) => a.id !== existingDraft?.id);
      p.approvals.push(ap);
    }
    ap.formData = { reason };
    ap.missingFields = [];
    if (!reason) ap.missingFields.push("申请说明");
    if (ap.requireFiles && !ap.attachments.length) ap.missingFields.push("上线验收附件");
    if (submit) {
      ap.attachments = [{ name: "联调测试报告.pdf", size: "2.1MB" }];
      ap.missingFields = ap.missingFields.filter((f) => f !== "上线验收附件");
      const res = A.submitApproval(p, ap);
      if (!res.ok) {
        showToast(res.message);
        return null;
      }
      p.statusApproval = { type, typeLabel: cfg.label, targetStatus: cfg.target, applyTime: ap.submittedAt, reason };
      A.syncLegacyFromApprovals(p);
    } else {
      ap.phase = "draft";
      ap.submitted = false;
      ap.typeLabel = cfg.label;
      ap.payload = { type, targetStatus: cfg.target };
    }
    return ap;
  }

  function bindStatusDraftForm(p, ap) {
    const type = ap.payload?.type || "online";
    document.getElementById("saveStatusDraftInline")?.addEventListener("click", () => {
      upsertStatusApproval(p, type, ap, false);
      showToast("已保存草稿（待提交），请补全必填项后提交");
      renderAll();
      scrollToDraftPanel();
    });
    document.getElementById("submitStatusDraftInline")?.addEventListener("click", () => {
      const reason = document.getElementById("statusDraftReason")?.value.trim();
      if (!reason) {
        showToast("请填写申请说明");
        return;
      }
      A.confirmAction({
        title: "确认提交审批",
        message: `<p>确定提交<strong>${esc(getStatusCfg(type).label)}</strong>吗？</p>`,
        confirmText: "确认提交",
        onConfirm: () => {
          const saved = upsertStatusApproval(p, type, ap, true);
          if (!saved) return;
          addActivity(p, {
            type: "approval",
            operator: getRole().label.split("（")[0],
            time: saved.submittedAt,
            summary: getStatusCfg(type).label,
            changes: [{ field: "目标状态", old: p.status, new: getStatusCfg(type).target + "（待审批）" }],
          });
          showToast("已提交审批");
          location.href = `detail.html?id=${p.id}&view=approval&approval=${saved.id}&from=approve`;
        },
      });
    });
  }

  function bindOwnerDraftForm(p, ap) {
    const role = ap.payload?.role || "product";
    const label = ap.payload?.roleLabel || (role === "product" ? "项目产品负责人" : "项目技术负责人");
    const current = ap.payload?.from || (role === "product" ? p.productOwner : p.techLead);
    IPMEdit.bindPersonPicker("ownerDraftTo", () => [current]);
    document.getElementById("saveOwnerDraftInline")?.addEventListener("click", () => {
      const to = document.getElementById("ownerDraftToValue").value;
      const reason = document.getElementById("ownerDraftReason").value.trim();
      updateOwnerDraft(p, ap, role, label, current, to, reason, false);
      showToast("已保存草稿，状态为「待提交」");
      renderAll();
      scrollToDraftPanel();
    });
    document.getElementById("submitOwnerDraftInline")?.addEventListener("click", () => {
      const to = document.getElementById("ownerDraftToValue").value;
      const reason = document.getElementById("ownerDraftReason").value.trim();
      if (!reason) {
        showToast("请填写变更原因");
        return;
      }
      A.confirmAction({
        title: "确认提交审批",
        message: `<p>确定提交<strong>${esc(label)}</strong>变更审批吗？</p>`,
        confirmText: "确认提交",
        onConfirm: () => {
          const saved = updateOwnerDraft(p, ap, role, label, current, to, reason, true);
          A.submitApproval(p, saved);
          addActivity(p, {
            type: "approval",
            operator: getRole().label.split("（")[0],
            time: saved.submittedAt,
            summary: `负责人变更申请：${label}`,
            changes: [{ field: label, old: current, new: to + "（待审批）" }],
          });
          showToast("已提交，进入审核流程");
          location.href = `detail.html?id=${p.id}&view=approval&approval=${saved.id}&from=approve`;
        },
      });
    });
  }

  function updateOwnerDraft(p, ap, role, label, current, to, reason, submit) {
    ap.phase = submit ? "reviewing" : "draft";
    ap.submitted = !!submit;
    ap.formData = { reason };
    ap.missingFields = !reason?.trim() ? ["变更原因"] : [];
    ap.attachments = reason ? [{ name: "负责人变更说明.docx", size: "128KB" }] : [];
    ap.payload = { role, roleLabel: label, from: current, to, reason };
    ap.typeLabel = `${label}变更`;
    if (submit) {
      ap.submittedAt = new Date().toLocaleString("zh-CN", { hour12: false });
      ap.steps = [
        { key: "buLead", label: "事业部负责人", assignee: p.buLead, status: "active" },
        { key: "executive", label: "超级管理层", assignee: "轮值VP", status: "waiting" },
      ];
      p.pendingOwnerChange = { ...ap.payload };
      A.syncLegacyFromApprovals(p);
    } else {
      p.pendingOwnerChange = null;
    }
    return ap;
  }

  function scrollToDraftPanel() {
    requestAnimationFrame(() => {
      document.getElementById("draftFormPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  /* ─── Tab: 人员与组织 ─── */
  function renderPeople(p) {
    const m = p.members;
    const crossHtml =
      m.crossBuMembers.length ?
        m.crossBuMembers.map((x) => `<span class="member-tag cross">${esc(x.name)}（${esc(x.bu)}）</span>`).join("")
      : '<span style="color:var(--text-secondary);font-size:12px">无</span>';

    const pendingHtml = renderApprovalBanner(p, "ownerChange");

    const canPeopleEdit = getRole().edit(p) && !p.applyStatus;
    const actions =
      canPeopleEdit ?
        `<button type="button" class="btn btn-primary" id="btnEditPeople">编辑人员</button>`
      : "";

    return `
      ${pendingHtml}
      <div class="detail-section">
        <div class="section-head">
          <h3>当前人员结构<span class="sub">5 类角色</span></h3>
          ${actions}
        </div>
        <div class="people-cards">
          <div class="people-card"><div class="card-role">事业部负责人</div><div class="card-name">${esc(m.buLead)}</div><div class="card-extra">与主数据同步</div></div>
          <div class="people-card"><div class="card-role">项目产品负责人</div><div class="card-name">${esc(m.productOwner)}</div></div>
          <div class="people-card"><div class="card-role">项目技术负责人</div><div class="card-name">${esc(m.techLead)}</div></div>
          <div class="people-card"><div class="card-role">本事业部项目成员</div><div class="member-tags">${m.buMembers.map((n) => `<span class="member-tag">${esc(n)}</span>`).join("") || "—"}</div></div>
          <div class="people-card"><div class="card-role">跨事业部协作成员</div><div class="member-tags">${crossHtml}</div></div>
        </div>
      </div>`;
  }

  /* ─── Tab: 状态与上下线 ─── */
  function renderStatusTab(p) {
    const draftId = params.get("draft");
    const statusDraft = findDraftApproval(p, "status", draftId);
    const approvalBanner = statusDraft ? "" : renderApprovalBanner(p, "status");
    const draftPanel = statusDraft ? renderStatusDraftPanel(p, statusDraft) : "";
    const hasStatusFlow = findApprovalByType(p, "status") || statusDraft;

    const canSt = getRole().changeStatus(p);
    let actionBtns = "";
    if (canSt && !hasStatusFlow) {
      if (p.status === "开发中")
        actionBtns += '<button type="button" class="btn btn-primary" id="btnGoOnline">上线申请</button>';
      if (p.status === "上线")
        actionBtns += '<button type="button" class="btn" id="btnGoOffline">下线申请</button>';
      if (p.status !== "下线")
        actionBtns += '<button type="button" class="btn btn-danger" id="btnTerminate">终止申请</button>';
    }

    const attach = (p.attachments || [])
      .map((f) => `<div class="attach-item">📎 <a>${esc(f.name)}</a> <span style="color:var(--text-secondary)">${esc(f.size)}</span></div>`)
      .join("") || '<div style="font-size:13px;color:var(--text-secondary)">暂无附件</div>';

    return `
      ${draftPanel}
      ${approvalBanner}
      <div class="detail-section">
        <div class="section-head">
          <h3>当前状态</h3>
          <div style="display:flex;gap:8px;flex-wrap:wrap">${actionBtns}</div>
        </div>
        <div class="status-panel">
          <div class="status-card highlight">
            <div style="font-size:12px;color:var(--text-secondary)">项目状态</div>
            <div class="big-status"><span class="status-badge ${statusClass(p.status)}" style="font-size:15px;padding:8px 16px">${esc(p.status)}</span></div>
          </div>
          <div class="status-card status-times">
            <dl>
              <dt>立项</dt><dd>${esc(p.establish)}</dd>
              <dt>上线时间</dt><dd>${esc(p.online)}</dd>
              <dt>下线时间</dt><dd>${esc(p.offline)}</dd>
            </dl>
            <div class="attach-list"><div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">相关附件</div>${attach}</div>
          </div>
        </div>
      </div>`;
  }

  function renderTabContent() {
    const p = getProject(projectId);
    const el = document.getElementById("detailContent");
    if (!p) {
      el.innerHTML = '<div class="empty-state">未找到项目，<a href="index.html">返回列表</a></div>';
      return;
    }

    if (activeTab === "overview") el.innerHTML = renderOverview(p);
    else if (activeTab === "people") el.innerHTML = renderPeople(p);
    else if (activeTab === "status") el.innerHTML = renderStatusTab(p);

    bindTabEvents(p);
  }

  function bindTabEvents(p) {
    document.getElementById("btnEditBasic")?.addEventListener("click", (e) => {
      e.preventDefault();
      if (!window.IPMEdit?.openEditBasicModal) {
        showToast("编辑模块未加载，请刷新页面");
        return;
      }
      IPMEdit.openEditBasicModal(p, () => renderAll());
    });
    document.getElementById("activityTypeFilter")?.addEventListener("change", () => {
      const filtered = p.activities.filter(
        (a) => document.getElementById("activityTypeFilter").value === "all" || a.type === document.getElementById("activityTypeFilter").value
      );
      document.getElementById("activityList").innerHTML = renderActivities(filtered);
    });

    document.getElementById("btnEditPeople")?.addEventListener("click", (e) => {
      e.preventDefault();
      if (!window.IPMEdit?.openPeopleEditModal) {
        showToast("编辑模块未加载，请刷新页面");
        return;
      }
      IPMEdit.openPeopleEditModal(p, () => renderAll());
    });
    bindApprovalBannerEvents(p);

    document.getElementById("btnGoOnline")?.addEventListener("click", () => openStatusApplyModal(p, "online"));
    document.getElementById("btnGoOffline")?.addEventListener("click", () => openStatusApplyModal(p, "offline"));
    document.getElementById("btnTerminate")?.addEventListener("click", () => openStatusApplyModal(p, "terminate"));

    const draftId = params.get("draft");
    const statusDraft = findDraftApproval(p, "status", draftId);
    if (statusDraft) bindStatusDraftForm(p, statusDraft);
  }

  function bindApprovalBannerEvents(p) {
    document.getElementById("btnGoApprovalDetail")?.addEventListener("click", (e) => {
      const id = e.currentTarget.dataset.approvalId;
      const ap = A.findApproval(p, id);
      if (ap) goApprovalDetail(ap);
    });
  }

  function approvalFilesHtml(ap) {
    if (!ap.attachments?.length) return "";
    return `<div class="wf-files" style="margin-top:12px">
      <div class="wf-files-title">相关文件 <span class="req">（审批前请查阅）</span></div>
      ${ap.attachments.map((f) => `<div class="wf-file-item"><span>📎 ${esc(f.name)}</span><button type="button" class="link btn-view-file" data-file="${esc(f.name)}">查看</button></div>`).join("")}
    </div>`;
  }

  function bindFileViewButtons(root) {
    root?.querySelectorAll(".btn-view-file").forEach((btn) => {
      btn.addEventListener("click", () => A.showFilePreview(btn.dataset.file));
    });
  }

  function openApprovalActionModal(p, ap) {
    if (ap.type === "ownerChange") openOwnerApprovalModal(p, ap);
    else if (ap.type === "status") openStatusApprovalModal(p, ap);
    else if (ap.type === "delete") openDeleteApprovalModal(p, ap);
  }

  /* ─── 弹窗 ─── */
  function createOwnerApproval(p, role, label, current, to, reason, submit) {
    const ap = {
      id: `ap-${p.id}-owner-${Date.now()}`,
      type: "ownerChange",
      typeLabel: `${label}变更`,
      submitted: !!submit,
      phase: submit ? "reviewing" : "draft",
      submitter: p.productOwner,
      submittedAt: submit ? new Date().toLocaleString("zh-CN", { hour12: false }) : null,
      missingFields: !reason?.trim() ? ["变更原因"] : [],
      formData: { reason },
      attachments: reason ? [{ name: "负责人变更说明.docx", size: "128KB" }] : [],
      steps: [
        { key: "buLead", label: "事业部负责人", assignee: p.buLead, status: submit ? "active" : "waiting" },
        { key: "executive", label: "超级管理层", assignee: "轮值VP", status: "waiting" },
      ],
      currentStepIndex: 0,
      payload: { role, roleLabel: label, from: current, to, reason },
    };
    if (submit) ap.steps[0].status = "active";
    p.approvals = (p.approvals || []).filter(
      (a) => !(a.type === "ownerChange" && a.payload?.role === role && (a.phase === "reviewing" || a.phase === "draft"))
    );
    p.approvals.push(ap);
    p.pendingOwnerChange = submit ? { ...ap.payload } : null;
    if (submit) A.syncLegacyFromApprovals(p);
    return ap;
  }

  function openOwnerChangeModal(p, role) {
    const isProduct = role === "product";
    const label = isProduct ? "项目产品负责人" : "项目技术负责人";
    const current = isProduct ? p.productOwner : p.techLead;
    openModal(
      `变更${label}`,
      `<p style="font-size:12px;color:#8c8c8c;margin-bottom:12px">可先「仅保存」草稿（待提交），完善后再提交审批。</p>
      <div class="form-field"><label>现任</label><input disabled value="${esc(current)}" /></div>
      ${IPMEdit.renderPersonPicker("newOwner", "变更为", current)}
      <div class="form-field"><label>变更原因 <span class="req">*</span></label><textarea id="ownerReason" placeholder="请说明变更原因"></textarea></div>`,
      `<button type="button" class="btn" data-close>取消</button>
       <button type="button" class="btn" id="saveOwnerDraft">仅保存</button>
       <button type="button" class="btn btn-primary" id="submitOwnerChange">提交审批</button>`,
      "large"
    );
    IPMEdit.bindPersonPicker("newOwner", () => [current]);
    document.getElementById("saveOwnerDraft").onclick = () => {
      const to = document.getElementById("newOwnerValue").value;
      const reason = document.getElementById("ownerReason").value.trim();
      createOwnerApproval(p, role, label, current, to, reason, false);
      closeModal();
      showToast("已保存草稿，状态为「待提交」");
      renderAll();
    };
    document.getElementById("submitOwnerChange").onclick = () => {
      const to = document.getElementById("newOwnerValue").value;
      const reason = document.getElementById("ownerReason").value.trim();
      if (!reason) {
        showToast("请填写变更原因");
        return;
      }
      A.confirmAction({
        title: "确认提交审批",
        message: `<p>确定提交<strong>${esc(label)}</strong>变更审批吗？</p><p style="font-size:12px;color:#8c8c8c;margin-top:8px">提交后将进入「审核中」，由事业部负责人 → 超级管理层依次审批。</p>`,
        confirmText: "确认提交",
        onConfirm: () => {
          const ap = createOwnerApproval(p, role, label, current, to, reason, true);
          A.submitApproval(p, ap);
          addActivity(p, {
            type: "approval",
            operator: getRole().label.split("（")[0],
            time: ap.submittedAt,
            summary: `负责人变更申请：${label}`,
            changes: [{ field: label, old: current, new: to + "（待审批）" }],
          });
          closeModal();
          showToast("已提交，进入审核流程");
          if (pageView === "approval") {
            location.href = `detail.html?id=${projectId}&view=approval&approval=${ap.id}&from=approve`;
          } else {
            refreshAfterApprovalChange();
            switchDetailTab("people");
          }
        },
      });
    };
    bindModalClose();
  }

  function openOwnerApprovalModal(p, ap) {
    ap = ap || findApprovalByType(p, "ownerChange");
    if (!ap) return;
    const oc = ap.payload;
    openModal(
      "审批 · 负责人变更",
      `<p style="margin-bottom:12px">${esc(oc.roleLabel)}：<strong>${esc(oc.from)}</strong> → <strong>${esc(oc.to)}</strong></p>
       ${oc.reason ? `<p style="font-size:13px;color:var(--text-secondary)">原因：${esc(oc.reason)}</p>` : ""}
       ${approvalFilesHtml(ap)}
       <p style="margin-top:12px"><button type="button" class="link" id="btnFlowInModal">查看审批流程图</button></p>`,
      `<button type="button" class="btn" data-close>取消</button>
       <button type="button" class="btn" id="rejectOwner">驳回</button>
       <button type="button" class="btn btn-primary" id="passOwner">通过</button>`,
      "wide"
    );
    bindFileViewButtons(document.getElementById("modalBody"));
    document.getElementById("btnFlowInModal")?.addEventListener("click", () => A.showFlowModal(ap, p));
    document.getElementById("passOwner").onclick = () => {
      A.confirmAction({
        title: "确认通过",
        message: "确定通过该负责人变更申请吗？此操作不可撤销。",
        confirmText: "确认通过",
        onConfirm: () => {
          A.advanceApproval(p, ap, true);
          addActivity(p, {
            type: "approval",
            operator: getRole().label.split("（")[0],
            time: new Date().toLocaleString("zh-CN", { hour12: false }),
            summary: `负责人变更已通过：${oc.roleLabel}`,
            changes: [{ field: oc.roleLabel, old: oc.from, new: oc.to }],
          });
          closeModal();
          showToast("审批已通过");
          refreshAfterApprovalChange();
        },
      });
    };
    document.getElementById("rejectOwner").onclick = () => {
      A.confirmAction({
        title: "确认驳回",
        message: "确定驳回该负责人变更申请吗？",
        confirmText: "确认驳回",
        danger: true,
        onConfirm: () => {
          A.advanceApproval(p, ap, false);
          closeModal();
          showToast("已驳回");
          refreshAfterApprovalChange();
        },
      });
    };
    bindModalClose();
  }

  function openStatusApplyModal(p, type, existingDraft) {
    const cfg = getStatusCfg(type);
    const draftReason = existingDraft?.formData?.reason || "";
    openModal(
      cfg.label,
      `<div class="form-field"><label>目标状态</label><input disabled value="${esc(cfg.target)}" /></div>
       <div class="form-field"><label>申请说明 <span class="req">*</span></label>
         <textarea id="statusReason" placeholder="请说明申请原因与准备情况">${esc(draftReason)}</textarea></div>
       <div class="form-field"><label>附件（原型）</label><input type="file" disabled /><span style="font-size:12px;color:var(--text-secondary)"> 演示环境不可上传；上线申请需上传验收材料</span></div>`,
      `<button type="button" class="btn" data-close>取消</button>
       <button type="button" class="btn" id="saveStatusDraft">仅保存</button>
       <button type="button" class="btn btn-primary" id="submitStatus">提交审批</button>`,
      "large"
    );
    document.getElementById("saveStatusDraft").onclick = () => {
      const ap = upsertStatusApproval(p, type, existingDraft, false);
      if (!ap) return;
      closeModal();
      showToast("已保存草稿（待提交），请补全必填项后提交");
      location.href = `detail.html?id=${p.id}&tab=status&draft=${ap.id}&from=${params.get("from") || "manage"}`;
    };
    document.getElementById("submitStatus").onclick = () => {
      const reason = document.getElementById("statusReason").value.trim();
      if (!reason) {
        showToast("请填写申请说明");
        return;
      }
      A.confirmAction({
        title: "确认提交审批",
        message: `<p>确定提交<strong>${esc(cfg.label)}</strong>吗？</p><p style="font-size:12px;color:#8c8c8c;margin-top:8px">提交后其他相关人员将看到「审核中」，轮到你审批时显示「待审批」。</p>`,
        confirmText: "确认提交",
        onConfirm: () => {
          const ap = upsertStatusApproval(p, type, existingDraft, true);
          if (!ap) return;
          addActivity(p, {
            type: "approval",
            operator: getRole().label.split("（")[0],
            time: ap.submittedAt,
            summary: cfg.label,
            changes: [{ field: "目标状态", old: p.status, new: cfg.target + "（待审批）" }],
          });
          closeModal();
          showToast("已提交审批");
          location.href = `detail.html?id=${p.id}&view=approval&approval=${ap.id}&from=approve`;
        },
      });
    };
    bindModalClose();
  }

  function openStatusApprovalModal(p, ap) {
    ap = ap || findApprovalByType(p, "status");
    if (!ap) return;
    const sa = ap.formData || {};
    openModal(
      "审批 · " + ap.typeLabel,
      `<p>${esc(ap.typeLabel)} → <strong>${esc(ap.payload?.targetStatus)}</strong></p>
       <p style="margin-top:8px;font-size:13px;color:var(--text-secondary)">${esc(sa.reason || "—")}</p>
       ${approvalFilesHtml(ap)}
       <p style="margin-top:12px"><button type="button" class="link" id="btnFlowInModal">查看审批流程图</button></p>`,
      `<button type="button" class="btn" data-close>取消</button>
       <button type="button" class="btn" id="rejectStatus">驳回</button>
       <button type="button" class="btn btn-primary" id="passStatus">通过</button>`,
      "wide"
    );
    bindFileViewButtons(document.getElementById("modalBody"));
    document.getElementById("btnFlowInModal")?.addEventListener("click", () => A.showFlowModal(ap, p));
    document.getElementById("passStatus").onclick = () => {
      A.confirmAction({
        title: "确认通过",
        message: "请确认已查阅相关文件。确定通过该状态变更申请吗？",
        confirmText: "确认通过",
        onConfirm: () => {
          A.advanceApproval(p, ap, true);
          const today = new Date().toISOString().slice(0, 10);
          if (ap.payload?.targetStatus === "上线") {
            p.timeline.find((n) => n.key === "online").done = true;
            p.timeline.find((n) => n.key === "online").date = today;
          } else {
            p.timeline.find((n) => n.key === "offline").done = true;
            p.timeline.find((n) => n.key === "offline").date = today;
          }
          addActivity(p, {
            type: "status",
            operator: getRole().label.split("（")[0],
            time: new Date().toLocaleString("zh-CN", { hour12: false }),
            summary: `状态变更：${ap.typeLabel}已通过`,
            changes: [{ field: "状态", old: "—", new: p.status }],
          });
          closeModal();
          showToast("状态审批已通过");
          refreshAfterApprovalChange();
        },
      });
    };
    document.getElementById("rejectStatus").onclick = () => {
      A.confirmAction({
        title: "确认驳回",
        message: "确定驳回该状态变更申请吗？",
        confirmText: "确认驳回",
        danger: true,
        onConfirm: () => {
          A.advanceApproval(p, ap, false);
          closeModal();
          showToast("已驳回");
          refreshAfterApprovalChange();
        },
      });
    };
    bindModalClose();
  }

  function openDeleteApprovalModal(p, ap) {
    ap = ap || (p.approvals || []).find((a) => a.type === "delete");
    if (!ap) return;
    openModal(
      "审批 · 删除申请",
      `<p>项目「${esc(p.name)}」申请删除。</p>
       ${approvalFilesHtml(ap)}
       <p style="margin-top:12px"><button type="button" class="link" id="btnFlowInModal">查看审批流程图</button></p>`,
      `<button type="button" class="btn" data-close>取消</button>
       <button type="button" class="btn" id="rejectDel">驳回</button>
       <button type="button" class="btn btn-primary" id="passDel">通过</button>`,
      "wide"
    );
    bindFileViewButtons(document.getElementById("modalBody"));
    document.getElementById("btnFlowInModal")?.addEventListener("click", () => A.showFlowModal(ap, p));
    document.getElementById("passDel").onclick = () => {
      A.confirmAction({
        title: "确认通过",
        message: "请确认已查阅删除说明文件。确定通过删除申请吗？",
        confirmText: "确认通过",
        onConfirm: () => {
          A.advanceApproval(p, ap, true);
          closeModal();
          showToast("删除申请已通过（原型未移除数据）");
          refreshAfterApprovalChange();
        },
      });
    };
    document.getElementById("rejectDel").onclick = () => {
      A.confirmAction({
        title: "确认驳回",
        message: "确定驳回删除申请吗？",
        confirmText: "确认驳回",
        danger: true,
        onConfirm: () => {
          A.advanceApproval(p, ap, false);
          closeModal();
          showToast("已驳回");
          refreshAfterApprovalChange();
        },
      });
    };
    bindModalClose();
  }

  function bindModalClose() {
    document.querySelectorAll("[data-close]").forEach((b) => (b.onclick = closeModal));
  }

  function renderAll() {
    renderPagehead();
    renderTabs();
    renderTabContent();
  }

  function refreshAfterApprovalChange() {
    if (pageView === "approval" && focusApprovalId) renderApprovalDetailView();
    else renderAll();
  }

  function initRoleBar() {
    const sel = document.getElementById("roleSelect");
    Object.values(ROLES).forEach((r) => {
      const o = document.createElement("option");
      o.value = r.id;
      o.textContent = r.label;
      sel.appendChild(o);
    });
    sel.value = getRoleId();
    sel.addEventListener("change", (e) => {
      setRoleId(e.target.value);
      renderAll();
    });
  }

  function init() {
    initRoleBar();

    if (mode === "apply") {
      location.replace("index.html#apply&new=1");
      return;
    }

    if (!projectId || !getProject(projectId)) {
      document.getElementById("pageheadTitle").textContent = "项目不存在";
      document.getElementById("detailContent").innerHTML =
        '<div style="padding:48px;text-align:center"><a href="index.html">返回列表</a></div>';
      return;
    }

    const proj0 = getProject(projectId);
    if (isApplyProject(proj0) && pageView !== "approval") {
      location.replace(`apply-view.html?id=${projectId}`);
      return;
    }

    if (!VALID_TABS.includes(activeTab)) activeTab = "overview";
    if (params.get("tab") && VALID_TABS.includes(params.get("tab"))) activeTab = params.get("tab");

    const draftParam = params.get("draft");
    if (draftParam) {
      const p0 = getProject(projectId);
      const ap0 = p0 ? A.findApproval(p0, draftParam) : null;
      if (ap0?.phase === "draft") activeTab = tabForApproval(ap0);
    }

    if (pageView === "approval" && focusApprovalId) {
      document.getElementById("modalClose").addEventListener("click", closeModal);
      document.getElementById("modal").addEventListener("click", (e) => {
        if (e.target.id === "modal") closeModal();
      });
      renderApprovalDetailView();
      return;
    }

    document.getElementById("detailTabs").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-tab]");
      if (btn) switchDetailTab(btn.dataset.tab);
    });

    document.getElementById("btnBack").onclick = () => {
      const from = params.get("from") || "manage";
      location.href = `index.html#${from === "apply" ? "apply" : from}`;
    };

    document.getElementById("modalClose").addEventListener("click", closeModal);
    document.getElementById("modal").addEventListener("click", (e) => {
      if (e.target.id === "modal") closeModal();
    });

    renderAll();
    if (params.get("draft")) scrollToDraftPanel();
    if (params.get("openEdit") === "1") {
      const p = getProject(projectId);
      if (p && canEdit() && window.IPMEdit?.openEditBasicModal) {
        requestAnimationFrame(() => IPMEdit.openEditBasicModal(p, () => renderAll()));
      }
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
