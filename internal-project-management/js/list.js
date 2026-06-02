(function () {
  const {
    BU_CODES,
    ROLES,
    PROJECTS,
    getRoleId,
    setRoleId,
    getRole,
    statusClass,
    sortProjects,
    sortApplyProjects,
    isApplyProject,
  } = window.IPM;
  const A = window.IPMApproval;

  let state = {
    tab: "manage",
    filters: { bu: "", projectId: "", name: "", status: "default" },
    applyFilters: { bu: "", name: "", wfStatus: "default" },
    approveFilters: { wfStatus: "default", type: "", name: "" },
    page: 1,
    applyPage: 1,
    pageSize: 10,
  };

  const WF_STATUS_ORDER = { pending: 0, reviewing: 1, draft: 2, done: 3, rejected: 4 };

  /** 与申请列表筛选项文案一致 */
  const APPLY_WF_LABEL = {
    draft: "待提交",
    reviewing: "审核中",
    pending: "待我审批",
    done: "已通过",
    rejected: "已驳回",
  };

  function joinActionLinks(parts) {
    const items = parts.filter(Boolean);
    if (!items.length) return "—";
    return `<div class="actions">${items.join('<span class="action-sep">|</span>')}</div>`;
  }

  function applyListStatusHtml(st) {
    if (!st) return "—";
    const text = APPLY_WF_LABEL[st.code] || st.text || "—";
    const cls = { draft: "wf-draft", reviewing: "wf-reviewing", pending: "wf-pending", done: "wf-done", rejected: "wf-rejected" }[st.code] || "";
    const hint = st.hint ? `<div class="wf-hint">${st.hint}</div>` : "";
    return `<span class="wf-status ${cls}">${text}</span>${hint}`;
  }

  function showToast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2200);
  }

  function filterProjects() {
    const { bu, projectId, name, status } = state.filters;
    const role = getRole();
    return PROJECTS.filter((p) => {
      if (isApplyProject(p)) return false;
      if (getRoleId() === "productOwner" && !role.view(p)) return false;
      if (bu && p.bu !== bu) return false;
      if (projectId && !p.projectId.toLowerCase().includes(projectId.toLowerCase())) return false;
      if (name && !p.name.includes(name)) return false;
      if (status === "default") {
        if (p.status === "下线") return false;
      } else if (status !== "all" && status) {
        if (p.status !== status) return false;
      }
      return true;
    });
  }

  function collectApprovalRows() {
    const rows = [];
    PROJECTS.forEach((p) => {
      (p.approvals || []).forEach((approval) => {
        if (!A.matchesApprovalFilter(approval, p, state.approveFilters)) return;
        const st = A.getDisplayStatus(approval, p);
        if (!st) return;
        rows.push({ project: p, approval, status: st });
      });
    });
    rows.sort((a, b) => {
      const oa = WF_STATUS_ORDER[a.status?.code] ?? 9;
      const ob = WF_STATUS_ORDER[b.status?.code] ?? 9;
      if (oa !== ob) return oa - ob;
      const ta = a.approval.finishedAt || a.approval.submittedAt || a.approval.createdAt || "";
      const tb = b.approval.finishedAt || b.approval.submittedAt || b.approval.createdAt || "";
      return tb.localeCompare(ta);
    });
    return rows;
  }

  function countPendingForRole() {
    return A.countPendingApprovals();
  }

  function tabForApproval(ap) {
    if (ap.type === "ownerChange") return "people";
    if (ap.type === "status") return "status";
    return "overview";
  }

  function goContinueDraftEdit(id, ap) {
    if (ap.type === "ownerChange") {
      location.href = `detail.html?id=${id}&tab=overview&openEdit=1&from=approve`;
      return;
    }
    const q = new URLSearchParams({ id: String(id), tab: tabForApproval(ap), draft: ap.id, from: "approve" });
    location.href = `detail.html?${q}`;
  }

  function goDetail(id, tab, from, approvalId) {
    const q = new URLSearchParams({ id: String(id), from: from || state.tab });
    if (approvalId) {
      q.set("view", "approval");
      q.set("approval", approvalId);
    } else {
      q.set("tab", tab || "overview");
    }
    location.href = `detail.html?${q}`;
  }

  /** 详情红点：仅「待填写/待完善」，不含「待我审批」 */
  function needsDetailAttention(p) {
    if (p.pendingInfo) return true;
    return A.getActiveApprovals(p).some((a) => {
      const st = A.getDisplayStatus(a, p);
      return st?.code === "draft" && st.canSubmit;
    });
  }

  function matchesApplyFilter(p, st) {
    const { bu, name, wfStatus } = state.applyFilters;
    if (bu && p.bu !== bu) return false;
    if (name && !p.name.includes(name)) return false;
    const code = st?.code;
    if (wfStatus === "default") return code === "draft" || code === "reviewing" || code === "pending";
    if (wfStatus === "pending") return code === "pending";
    if (wfStatus === "all") return true;
    return code === wfStatus;
  }

  function filterApplyProjects() {
    return PROJECTS.filter((p) => {
      if (!isApplyProject(p)) return false;
      if (getRoleId() === "productOwner" && p.productOwner !== "张三") return false;
      const ap = A.getEstablishApproval(p);
      const st = ap ? A.getDisplayStatus(ap, p) : null;
      if (!st) return state.applyFilters.wfStatus === "all";
      return matchesApplyFilter(p, st);
    });
  }

  function needsApplyDetailAttention(p) {
    const ap = A.getEstablishApproval(p);
    const st = ap ? A.getDisplayStatus(ap, p) : null;
    return st?.code === "draft" && st.canSubmit;
  }

  function renderApplyOps(p, ap, st) {
    const parts = [];
    const dot = needsApplyDetailAttention(p);
    parts.push(
      `<button type="button" class="link detail-entry${dot ? " has-dot" : ""}" data-action="view-apply" data-id="${p.id}" title="${dot ? "有待填写事项" : ""}">查看</button>`
    );
    if (getRole().edit(p) && st?.code === "draft") {
      parts.push(`<button type="button" class="link" data-action="edit-apply" data-id="${p.id}">编辑</button>`);
    }
    if (
      st?.canApprove ||
      st?.code === "reviewing" ||
      st?.code === "pending" ||
      st?.code === "done" ||
      st?.code === "rejected"
    ) {
      parts.push(A.approvalDetailBtnHtml(p, ap, "apply-detail"));
    }
    return joinActionLinks(parts);
  }

  function renderApplyTable() {
    const filtered = sortApplyProjects(filterApplyProjects());
    const total = filtered.length;
    document.getElementById("applyTotalCount").textContent = total;
    const pages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.applyPage > pages) state.applyPage = pages;
    const start = (state.applyPage - 1) * state.pageSize;
    const pageItems = filtered.slice(start, start + state.pageSize);
    const tbody = document.getElementById("applyTableBody");

    const pagEl = document.getElementById("applyPagination");
    if (pagEl) {
      let html = `<button type="button" data-apply-page="1" ${state.applyPage === 1 ? "disabled" : ""}>首页</button>`;
      html += `<button type="button" data-apply-page="${state.applyPage - 1}" ${state.applyPage === 1 ? "disabled" : ""}>上一页</button>`;
      for (let i = 1; i <= pages && i <= 5; i++) {
        html += `<button type="button" data-apply-page="${i}" class="${i === state.applyPage ? "active" : ""}">${i}</button>`;
      }
      html += `<button type="button" data-apply-page="${state.applyPage + 1}" ${state.applyPage >= pages ? "disabled" : ""}>下一页</button>`;
      pagEl.innerHTML = html;
    }

    if (!pageItems.length) {
      tbody.innerHTML = `<tr><td colspan="9" class="empty-state">暂无申请记录</td></tr>`;
      return;
    }
    tbody.innerHTML = pageItems
      .map((p, i) => {
        const ap = A.getEstablishApproval(p);
        const st = ap ? A.getDisplayStatus(ap, p) : null;
        return `<tr>
          <td>${start + i + 1}</td>
          <td>${p.bu}</td>
          <td>${p.buLead}</td>
          <td>${p.name}</td>
          <td>${p.establish}</td>
          <td>${p.productOwner}</td>
          <td>${p.techLead}</td>
          <td>
            ${ap && st ? applyListStatusHtml(st) : "—"}
          </td>
          <td>${ap ? renderApplyOps(p, ap, st) : "—"}</td>
        </tr>`;
      })
      .join("");
    bindApplyTableActions(tbody);
  }

  function bindApplyTableActions(root) {
    root.querySelectorAll("button[data-action]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleApplyAction(btn.dataset.action, btn.dataset.id, btn.dataset.approval);
      });
    });
  }

  function handleApplyAction(action, id, approvalId) {
    const p = PROJECTS.find((x) => x.id === Number(id));
    if (!p || !isApplyProject(p)) return;
    const ap = A.getEstablishApproval(p);
    if (action === "view-apply") location.href = `apply-view.html?id=${id}`;
    else if (action === "edit-apply" || action === "continue-apply") location.href = `apply-form.html?id=${id}`;
    else if (action === "apply-detail" && ap) goDetail(id, null, "apply", ap.id);
  }

  function renderActions(p) {
    const role = getRole();
    const parts = [];
    const active = A.getActiveApprovals(p);
    const needMine = active.some((a) => A.getDisplayStatus(a, p)?.canApprove);
    const detailDot = needsDetailAttention(p);

    if (role.view(p)) {
      parts.push(
        `<button type="button" class="link detail-entry${detailDot ? " has-dot" : ""}" data-action="view" data-id="${p.id}" title="${detailDot ? "有待填写事项，请进入详情完善" : ""}">详情</button>`
      );
    }
    if (role.edit(p) && !isApplyProject(p)) {
      parts.push(`<button type="button" class="link" data-action="edit" data-id="${p.id}">编辑</button>`);
      parts.push(`<button type="button" class="link" data-action="people" data-id="${p.id}">编辑人员</button>`);
    }
    if (needMine) {
      const ap = active.find((a) => A.getDisplayStatus(a, p)?.canApprove);
      if (ap) parts.push(A.approvalDetailBtnHtml(p, ap));
    }

    return joinActionLinks(parts);
  }

  function renderTable() {
    const filtered = sortProjects(filterProjects());
    const total = filtered.length;
    document.getElementById("totalCount").textContent = total;
    const start = (state.page - 1) * state.pageSize;
    const pageItems = filtered.slice(start, start + state.pageSize);
    const tbody = document.getElementById("tableBody");

    if (!pageItems.length) {
      tbody.innerHTML = `<tr><td colspan="11" class="empty-state">暂无数据</td></tr>`;
    } else {
      tbody.innerHTML = pageItems
        .map(
          (p, i) => `
        <tr data-project-id="${p.id}">
          <td>${start + i + 1}</td>
          <td>${p.bu}</td>
          <td>${p.buLead}</td>
          <td>${p.name}</td>
          <td><code style="font-size:12px">${p.projectId}</code></td>
          <td><span class="status-badge ${statusClass(p.status)}">${p.status}</span></td>
          <td>${p.online}</td>
          <td>${p.offline}</td>
          <td>${p.productOwner}</td>
          <td>${p.techLead}</td>
          <td>${renderActions(p)}</td>
        </tr>`
        )
        .join("");
      bindTableActions(tbody);
    }
    renderPagination(total);
    document.getElementById("pendingCount").textContent = countPendingForRole();
    if (state.tab === "approve") renderApproveTab();
  }

  function renderPagination(total) {
    const pages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page > pages) state.page = pages;
    const el = document.getElementById("pagination");
    let html = `<button type="button" data-page="1" ${state.page === 1 ? "disabled" : ""}>首页</button>`;
    html += `<button type="button" data-page="${state.page - 1}" ${state.page === 1 ? "disabled" : ""}>上一页</button>`;
    for (let i = 1; i <= pages && i <= 5; i++) {
      html += `<button type="button" data-page="${i}" class="${i === state.page ? "active" : ""}">${i}</button>`;
    }
    html += `<button type="button" data-page="${state.page + 1}" ${state.page >= pages ? "disabled" : ""}>下一页</button>`;
    el.innerHTML = html;
  }

  function renderApproveOps(p, approval) {
    return joinActionLinks([A.approvalDetailBtnHtml(p, approval)]);
  }

  function bindTableActions(root) {
    root.querySelectorAll("button[data-action]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleAction(btn.dataset.action, btn.dataset.id, btn.dataset.approval);
      });
    });
  }

  function bindApproveActions(root) {
    root.querySelectorAll("button[data-action]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleAction(btn.dataset.action, btn.dataset.id, btn.dataset.approval);
      });
    });
  }

  function renderApproveTab() {
    const rows = collectApprovalRows();
    const hint = document.getElementById("approveTotalHint");
    if (hint) hint.textContent = `共 ${rows.length} 条记录`;
    const tbody = document.getElementById("approveBody");
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state">暂无符合条件的审批记录</td></tr>`;
      return;
    }
    tbody.innerHTML = rows
      .map(({ project: p, approval, status: st }, i) => {
        return `<tr>
          <td>${i + 1}</td>
          <td>${p.name}</td>
          <td><code style="font-size:12px">${p.projectId}</code></td>
          <td>${approval.typeLabel}</td>
          <td>
            ${A.statusBadgeHtml(approval, p, false)}
            ${st?.hint ? `<div class="wf-hint">${st.hint}</div>` : ""}
          </td>
          <td>${renderApproveOps(p, approval)}</td>
        </tr>`;
      })
      .join("");
    bindApproveActions(tbody);
  }

  function fillBuSelect(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel || sel.dataset.filled) return;
    sel.dataset.filled = "1";
    Object.keys(BU_CODES).forEach((bu) => {
      const opt = document.createElement("option");
      opt.value = bu;
      opt.textContent = bu;
      sel.appendChild(opt);
    });
  }

  function initFilters() {
    fillBuSelect("fBu");
    fillBuSelect("afApplyBu");
  }

  function initRoleSelect() {
    const sel = document.getElementById("roleSelect");
    Object.values(ROLES).forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = r.label;
      sel.appendChild(opt);
    });
    sel.value = getRoleId();
    sel.addEventListener("change", (e) => {
      setRoleId(e.target.value);
      document.getElementById("applyRoleHint").textContent = ROLES[e.target.value].label;
      renderTable();
      if (state.tab === "apply") renderApplyTable();
    });
  }

  function switchTab(tab) {
    state.tab = tab;
    document.querySelectorAll(".sub-tabs button").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });
    document.getElementById("panelApply").classList.toggle("active", tab === "apply");
    document.getElementById("panelManage").classList.toggle("active", tab === "manage");
    document.getElementById("panelApprove").classList.toggle("active", tab === "approve");
    document.getElementById("applyRoleHint").textContent = ROLES[getRoleId()].label;
    if (tab === "manage") renderTable();
    if (tab === "apply") renderApplyTable();
    if (tab === "approve") renderApproveTab();
  }

  function applyFiltersFromForm() {
    state.filters = {
      bu: document.getElementById("fBu").value,
      projectId: document.getElementById("fProjectId").value.trim(),
      name: document.getElementById("fName").value.trim(),
      status: document.getElementById("fStatus").value,
    };
    state.page = 1;
    renderTable();
  }

  function resetFilters() {
    document.getElementById("fBu").value = "";
    document.getElementById("fProjectId").value = "";
    document.getElementById("fName").value = "";
    document.getElementById("fStatus").value = "default";
    state.filters = { bu: "", projectId: "", name: "", status: "default" };
    state.page = 1;
    renderTable();
  }

  function handleAction(action, id, approvalId) {
    const p = PROJECTS.find((x) => x.id === Number(id));
    if (!p) return;
    if (action === "view") goDetail(id, "overview");
    else if (action === "edit") {
      if (!window.IPMEdit) {
        showToast("编辑模块未加载，请刷新页面");
        return;
      }
      IPMEdit.openEditBasicModal(p, () => renderTable());
    } else if (action === "people") {
      if (!window.IPMEdit) {
        showToast("编辑模块未加载，请刷新页面");
        return;
      }
      IPMEdit.openPeopleEditModal(p, () => renderTable());
    }
    else if (action === "continue-draft") {
      const ap = approvalId ? A.findApproval(p, approvalId) : null;
      if (ap) goContinueDraftEdit(id, ap);
      else goDetail(id, "overview");
    } else if (action === "approve" || action === "view-approval") {
      const ap =
        approvalId ?
          A.findApproval(p, approvalId)
        : A.getActiveApprovals(p).find((a) => A.getDisplayStatus(a, p)?.canApprove);
      if (ap) goDetail(id, null, "approve", ap.id);
      else goDetail(id, "overview");
    }
  }

  function init() {
    initFilters();
    initRoleSelect();
    const hash = location.hash.replace("#", "");
    const hashBase = hash.split("&")[0];
    if (hashBase === "apply" || hashBase === "approve" || hashBase === "manage") switchTab(hashBase);
    else switchTab("manage");
    if (hash.includes("new=1")) {
      location.replace("apply-form.html");
    }

    document.getElementById("subTabs").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-tab]");
      if (btn) {
        switchTab(btn.dataset.tab);
        location.hash = btn.dataset.tab;
      }
    });
    document.getElementById("btnSearch").addEventListener("click", applyFiltersFromForm);
    document.getElementById("btnReset").addEventListener("click", resetFilters);
    document.getElementById("fStatus").addEventListener("change", applyFiltersFromForm);
    document.getElementById("fBu").addEventListener("change", applyFiltersFromForm);
    document.getElementById("pagination").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-page]");
      if (!btn || btn.disabled) return;
      state.page = Number(btn.dataset.page);
      renderTable();
    });
    const modal = document.getElementById("modal");
    if (modal) modal.classList.remove("show");
    document.getElementById("pendingBadge").addEventListener("click", () => {
      switchTab("approve");
      location.hash = "approve";
    });
    document.getElementById("btnNewApply").addEventListener("click", () => {
      location.href = "apply-form.html";
    });
    document.getElementById("btnApplySearch").addEventListener("click", applyApplyFiltersFromForm);
    document.getElementById("btnApplyReset").addEventListener("click", resetApplyFilters);
    document.getElementById("afApplyStatus").addEventListener("change", applyApplyFiltersFromForm);
    document.getElementById("afApplyBu").addEventListener("change", applyApplyFiltersFromForm);
    document.getElementById("applyPagination").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-apply-page]");
      if (!btn || btn.disabled) return;
      state.applyPage = Number(btn.dataset.applyPage);
      renderApplyTable();
    });

    document.getElementById("btnApproveSearch").addEventListener("click", applyApproveFilters);
    document.getElementById("btnApproveReset").addEventListener("click", resetApproveFilters);
    document.getElementById("afWfStatus").addEventListener("change", applyApproveFilters);
  }

  function applyApproveFilters() {
    state.approveFilters = {
      wfStatus: document.getElementById("afWfStatus").value,
      type: document.getElementById("afType").value,
      name: document.getElementById("afName").value.trim(),
    };
    renderApproveTab();
  }

  function applyApplyFiltersFromForm() {
    state.applyFilters = {
      bu: document.getElementById("afApplyBu").value,
      name: document.getElementById("afApplyName").value.trim(),
      wfStatus: document.getElementById("afApplyStatus").value,
    };
    state.applyPage = 1;
    renderApplyTable();
  }

  function resetApplyFilters() {
    document.getElementById("afApplyBu").value = "";
    document.getElementById("afApplyName").value = "";
    document.getElementById("afApplyStatus").value = "default";
    state.applyFilters = { bu: "", name: "", wfStatus: "default" };
    state.applyPage = 1;
    renderApplyTable();
  }

  function resetApproveFilters() {
    document.getElementById("afWfStatus").value = "default";
    document.getElementById("afType").value = "";
    document.getElementById("afName").value = "";
    state.approveFilters = { wfStatus: "default", type: "", name: "" };
    renderApproveTab();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
