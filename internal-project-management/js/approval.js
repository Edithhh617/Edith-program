/**
 * 审批工作流：状态展示、流程图、二次确认
 */
(function (global) {
  const IPM = global.IPM;

  const APPROVAL_DETAIL_BTN = "审批详情";

  const STATUS_LABEL = {
    draft: { text: "待提交", class: "wf-draft" },
    pending: { text: "待我审批", class: "wf-pending" },
    reviewing: { text: "审核中", class: "wf-reviewing" },
    done: { text: "已通过", class: "wf-done" },
    rejected: { text: "已驳回", class: "wf-rejected" },
  };

  function esc(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getRoleId() {
    return IPM.getRoleId();
  }

  /** 当前角色是否可处理该审批节点 */
  function canActOnStep(roleId, step, project) {
    if (!step || step.status !== "active") return false;
    if (roleId === "superAdmin") return true;
    if (step.key === "executive" && roleId === "executive") return true;
    if (step.key === "buLead" && roleId === "superAdmin") return true;
    if (step.key === "applicant" && roleId === "productOwner" && project.productOwner === "张三") return true;
    return false;
  }

  function isSubmitter(roleId, approval, project) {
    if (roleId === "superAdmin") return true;
    if (roleId === "productOwner" && approval.submitter === project.productOwner) return true;
    return approval.submitter === "张三" && roleId === "productOwner";
  }

  /** 列表/详情用的审批展示状态 */
  function getDisplayStatus(approval, project) {
    const roleId = getRoleId();
    if (approval.phase === "draft" || !approval.submitted) {
      if (isSubmitter(roleId, approval, project)) {
        const hint =
          approval.missingFields?.length ? "尚有必填项未填写，请完善后提交" : "已保存草稿，请确认信息后提交审批";
        return { code: "draft", ...STATUS_LABEL.draft, hint, canSubmit: true, canApprove: false };
      }
      return null;
    }
    if (approval.phase === "rejected") {
      return {
        code: "rejected",
        ...STATUS_LABEL.rejected,
        hint: approval.finishedAt ? `已于 ${approval.finishedAt} 驳回` : "流程已结束",
        canApprove: false,
      };
    }
    if (approval.phase === "approved") {
      return {
        code: "done",
        ...STATUS_LABEL.done,
        hint: approval.finishedAt ? `已于 ${approval.finishedAt} 通过` : "流程已完成",
        canApprove: false,
      };
    }

    const step = approval.steps[approval.currentStepIndex];
    if (canActOnStep(roleId, step, project)) {
      return { code: "pending", ...STATUS_LABEL.pending, hint: `当前节点：${step.label}（${step.assignee}）`, canApprove: true };
    }
    return {
      code: "reviewing",
      ...STATUS_LABEL.reviewing,
      hint: step ? `流程进行中 · ${step.label}处理中` : "流程审核中",
      canApprove: false,
    };
  }

  function getProjectApprovals(p) {
    return p.approvals || [];
  }

  /** 进行中的审批（不含已通过/已驳回） */
  function getActiveApprovals(p) {
    return getProjectApprovals(p).filter((a) => a.phase === "draft" || a.phase === "reviewing");
  }

  function canSeeApprovalRecord(approval, project) {
    const roleId = getRoleId();
    if (roleId === "superAdmin" || roleId === "executive") return true;
    if (roleId === "productOwner") {
      return approval.submitter === project.productOwner || approval.submitter === "张三";
    }
    return getDisplayStatus(approval, project) !== null;
  }

  /** 内部项目审批 Tab 列表：不含待填写；默认仅当前节点可审批人可见 */
  function matchesApprovalFilter(approval, project, filters) {
    const st = getDisplayStatus(approval, project);
    if (!st) return false;
    if (approval.phase === "draft" || !approval.submitted || st.code === "draft") return false;

    const { wfStatus, type, name } = filters;
    if (name && !project.name.includes(name) && !project.projectId.includes(name)) return false;
    if (type && approval.type !== type) return false;

    const roleId = getRoleId();
    const canViewHistory = roleId === "superAdmin" || roleId === "executive";

    if (wfStatus === "default" || wfStatus === "pending") return st.canApprove;
    if (wfStatus === "reviewing" || wfStatus === "draft") return false;
    if (wfStatus === "done") return st.code === "done" && canViewHistory;
    if (wfStatus === "rejected") return st.code === "rejected" && canViewHistory;
    if (wfStatus === "all") return canViewHistory;
    return false;
  }

  function getVisibleApprovals(p) {
    return getActiveApprovals(p);
  }

  function hasActiveApproval(p) {
    return getActiveApprovals(p).some((a) => {
      const st = getDisplayStatus(a, p);
      return st && (st.canApprove || st.code === "draft" || st.code === "reviewing" || st.code === "pending");
    });
  }

  function countPendingApprovals() {
    let n = 0;
    IPM.PROJECTS.forEach((p) => {
      getActiveApprovals(p).forEach((a) => {
        if (getDisplayStatus(a, p)?.canApprove) n++;
      });
    });
    return n;
  }

  function getEstablishApproval(p) {
    return (p.approvals || []).find((a) => a.type === "establish");
  }

  function renderFlowChart(approval, project) {
    const steps = (approval.steps || []).map((s) => ({ ...s }));
    if (approval.phase === "approved") {
      steps.forEach((s) => {
        if (s.status !== "rejected") s.status = "done";
      });
    }
    return `
      <div class="wf-chart">
        <div class="wf-chart-title">${esc(approval.typeLabel)} · ${esc(project.name)}</div>
        <div class="wf-chart-meta">
          <span>申请人：${esc(approval.submitter)}</span>
          ${approval.submittedAt ? `<span>提交时间：${esc(approval.submittedAt)}</span>` : "<span>尚未提交</span>"}
          ${approval.finishedAt ? `<span>完成时间：${esc(approval.finishedAt)}</span>` : ""}
        </div>
        <div class="wf-steps wf-steps-horizontal">
          ${steps
            .map((step, i) => {
              let stClass = "wf-step";
              let badge = "等待中";
              if (step.status === "done") {
                stClass += " done";
                badge = "已完成";
              } else if (step.status === "active") {
                stClass += " active";
                badge = "进行中";
              } else if (step.status === "rejected") {
                stClass += " rejected";
                badge = "已驳回";
              }
              const roleId = getRoleId();
              let roleHint = "";
              if (step.status === "active" && approval.phase === "reviewing") {
                roleHint = canActOnStep(roleId, step, project)
                  ? '<span class="wf-step-tag pending">待审批</span>'
                  : '<span class="wf-step-tag reviewing">审批中</span>';
              }
              if (approval.phase === "approved" || approval.phase === "rejected") {
                roleHint = "";
              }
              return `<div class="${stClass}">
                <div class="wf-step-icon">${step.status === "done" ? "✓" : i + 1}</div>
                <div class="wf-step-body">
                  <div class="wf-step-label">${esc(step.label)}</div>
                  <div class="wf-step-assignee">${esc(step.assignee)}</div>
                  <div class="wf-step-status">${badge} ${roleHint}</div>
                  ${step.actedAt ? `<div class="wf-step-time">${esc(step.actedAt)}</div>` : ""}
                </div>
              </div>`;
            })
            .join("")}
        </div>
        ${renderAttachmentsBlock(approval)}
      </div>`;
  }

  function renderAttachmentsBlock(approval) {
    const files = approval.attachments || [];
    if (!files.length) return "";
    return `<div class="wf-files">
      <div class="wf-files-title">相关文件 ${approval.requireFiles ? '<span class="req">（审批前请查阅）</span>' : ""}</div>
      ${files
        .map(
          (f) => `<div class="wf-file-item">
          <span>📎 ${esc(f.name)}</span>
          <span class="wf-file-size">${esc(f.size || "")}</span>
          <button type="button" class="link btn-view-file" data-file="${esc(f.name)}">查看</button>
        </div>`
        )
        .join("")}
    </div>`;
  }

  /** 列表内嵌审批进度（横向步骤条） */
  function renderInlineProgress(approval, project) {
    const steps = approval.steps || [];
    const parts = [];

    if (approval.phase === "draft" || !approval.submitted) {
      parts.push(stepChip("填写申请", "wait", "待提交申请"));
      parts.push(arrow());
      parts.push(stepChip("事业部负责人", "wait", steps[0]?.assignee));
      parts.push(arrow());
      parts.push(stepChip("超级管理层", "wait", steps[1]?.assignee));
      return wrapInline(parts, approval);
    }

    parts.push(stepChip("已提交", "done", approval.submittedAt || ""));

    steps.forEach((step) => {
      parts.push(arrow());
      let cls = "wait";
      if (step.status === "done") cls = "done";
      else if (step.status === "rejected") cls = "rejected";
      else if (step.status === "active") cls = approval.phase === "rejected" ? "rejected" : "active";

      const shortLabel = step.label.replace("事业部负责人", "事业部").replace("超级管理层", "管理层");
      let tag = "";
      if (step.status === "active" && approval.phase === "reviewing") {
        tag = canActOnStep(getRoleId(), step, project) ? "待审批" : "审批中";
      }
      parts.push(stepChip(shortLabel, cls, step.assignee, tag, step.label));
    });

    return wrapInline(parts, approval);
  }

  function arrow() {
    return '<span class="wf-inline-arrow" aria-hidden="true"></span>';
  }

  function stepChip(label, state, sub, tag, title) {
    const subHtml = sub ? `<span class="wf-inline-sub">${esc(sub)}</span>` : "";
    const tagHtml = tag ? `<em class="wf-inline-tag">${esc(tag)}</em>` : "";
    const t = title ? ` title="${esc(title)}${sub ? " · " + esc(sub) : ""}"` : "";
    return `<span class="wf-inline-step ${state}"${t}><span class="wf-inline-label">${esc(label)}</span>${subHtml}${tagHtml}</span>`;
  }

  function wrapInline(parts, approval) {
    const files =
      approval.attachments?.length ?
        `<button type="button" class="link btn-view-file-inline" data-file="${esc(approval.attachments[0].name)}" title="查看附件">📎 ${approval.attachments.length} 个文件</button>`
      : "";
    return `<div class="wf-inline">${parts.join("")}${files ? `<div class="wf-inline-files">${files}</div>` : ""}</div>`;
  }

  function statusBadgeHtml(approval, project, clickable = false) {
    const st = getDisplayStatus(approval, project);
    if (!st) return "—";
    const tag = `<span class="wf-status ${st.class}" title="${esc(st.hint || "")}">${st.text}</span>`;
    if (clickable) {
      const action = approval.phase === "approved" || approval.phase === "rejected" ? "view-approval" : "approve";
      return `<button type="button" class="link" data-action="${action}" data-id="${project.id}" data-approval="${esc(approval.id)}">${APPROVAL_DETAIL_BTN}</button>`;
    }
    return tag;
  }

  /** 列表操作列：进入审批详情（action 可覆盖，如申请列表用 apply-detail） */
  function approvalDetailBtnHtml(project, approval, actionOverride) {
    const action =
      actionOverride ||
      (approval.phase === "approved" || approval.phase === "rejected" ? "view-approval" : "approve");
    return `<button type="button" class="link" data-action="${action}" data-id="${project.id}" data-approval="${esc(approval.id)}">${APPROVAL_DETAIL_BTN}</button>`;
  }

  /** 二次确认 */
  function confirmAction({ title, message, confirmText = "确认", danger = false, onConfirm }) {
    const overlay = document.getElementById("confirmModal");
    if (!overlay) {
      if (window.confirm(message)) onConfirm?.();
      return;
    }
    document.getElementById("confirmTitle").textContent = title || "请确认";
    document.getElementById("confirmMessage").innerHTML = message;
    const btn = document.getElementById("confirmOk");
    btn.textContent = confirmText;
    btn.className = danger ? "btn btn-danger" : "btn btn-primary";
    overlay.classList.add("show");
    const cleanup = () => {
      overlay.classList.remove("show");
      btn.onclick = null;
      document.getElementById("confirmCancel").onclick = null;
    };
    document.getElementById("confirmCancel").onclick = cleanup;
    btn.onclick = () => {
      cleanup();
      onConfirm?.();
    };
  }

  function showFlowModal(approval, project) {
    const overlay = document.getElementById("flowModal");
    if (!overlay) return;
    document.getElementById("flowModalTitle").textContent = "审批流程";
    document.getElementById("flowModalBody").innerHTML = renderFlowChart(approval, project);
    overlay.classList.add("show");
    overlay.querySelectorAll(".btn-view-file").forEach((btn) => {
      btn.addEventListener("click", () => {
        IPMApproval.showFilePreview(btn.dataset.file);
      });
    });
  }

  function showFilePreview(fileName) {
    const overlay = document.getElementById("flowModal") || document.getElementById("modal");
    confirmAction({
      title: "查看文件",
      message: `<p>正在打开文件：<strong>${esc(fileName)}</strong></p><p style="font-size:12px;color:#8c8c8c;margin-top:8px">原型演示：实际环境将打开 PDF/文档预览。</p>`,
      confirmText: "知道了",
      onConfirm: () => {},
    });
  }

  function findApproval(project, approvalId) {
    return getProjectApprovals(project).find((a) => a.id === approvalId);
  }

  function advanceApproval(project, approval, pass) {
    const now = new Date().toLocaleString("zh-CN", { hour12: false });
    if (!pass) {
      approval.phase = "rejected";
      approval.finishedAt = now;
      approval.steps[approval.currentStepIndex].status = "rejected";
      syncLegacyFromApprovals(project);
      return;
    }
    const step = approval.steps[approval.currentStepIndex];
    step.status = "done";
    step.actedAt = now;
    if (approval.currentStepIndex < approval.steps.length - 1) {
      approval.currentStepIndex += 1;
      approval.steps[approval.currentStepIndex].status = "active";
    } else {
      approval.phase = "approved";
      approval.finishedAt = now;
      approval.steps.forEach((s) => {
        if (s.status !== "rejected") s.status = "done";
      });
      applyApprovalPayload(project, approval);
    }
    syncLegacyFromApprovals(project);
  }

  function applyApprovalPayload(project, approval) {
    const p = approval.payload || {};
    if (approval.type === "ownerChange") {
      if (p.role === "product") {
        project.productOwner = p.to;
        project.members.productOwner = p.to;
      } else {
        project.techLead = p.to;
        project.members.techLead = p.to;
      }
    }
    if (approval.type === "status") {
      const today = new Date().toISOString().slice(0, 10);
      if (p.targetStatus === "上线") {
        project.status = "上线";
        project.online = today;
      } else {
        project.status = "下线";
        project.offline = today;
      }
    }
    if (approval.type === "delete") {
      project.pendingApproval = false;
    }
    if (approval.type === "establish") {
      const g = global.IPM || window.IPM;
      if (g?.finishEstablishApproval) g.finishEstablishApproval(project);
    }
    if (approval.type === "buChange") {
      const g = global.IPM || window.IPM;
      project.bu = p.toBu;
      project.buLead = p.toBuLead;
      if (p.name) project.name = p.name;
      if (p.desc != null) project.desc = p.desc;
      if (p.establish) project.establish = p.establish;
      if (g?.genProjectId) project.projectId = g.genProjectId(project);
      if (project.members) {
        project.members.buLead = p.toBuLead;
      }
    }
  }

  function syncLegacyFromApprovals(project) {
    project.pendingOwnerChange = null;
    project.statusApproval = null;
    project.pendingApproval = false;
    for (const a of getProjectApprovals(project)) {
      if (a.phase !== "reviewing" && a.phase !== "draft") continue;
      if (a.type === "ownerChange" && a.submitted) {
        project.pendingOwnerChange = { ...a.payload, roleLabel: a.payload?.roleLabel };
      }
      if (a.type === "status" && a.submitted) {
        project.statusApproval = {
          type: a.payload?.type,
          typeLabel: a.typeLabel,
          targetStatus: a.payload?.targetStatus,
          applyTime: a.submittedAt,
          reason: a.formData?.reason,
        };
      }
      if (a.type === "delete" && a.submitted) project.pendingApproval = true;
    }
  }

  function submitApproval(project, approval) {
    if (approval.missingFields?.length) {
      return { ok: false, message: `请先完善：${approval.missingFields.join("、")}` };
    }
    approval.submitted = true;
    approval.phase = "reviewing";
    approval.submittedAt = new Date().toLocaleString("zh-CN", { hour12: false });
    approval.currentStepIndex = 0;
    approval.steps.forEach((s, i) => {
      s.status = i === 0 ? "active" : "waiting";
    });
    syncLegacyFromApprovals(project);
    return { ok: true };
  }

  function saveApprovalDraft(project, approval, formData) {
    approval.formData = { ...approval.formData, ...formData };
    approval.missingFields = [];
    if (!approval.formData.reason?.trim()) approval.missingFields.push("申请说明");
    if (approval.requireFiles && !approval.attachments?.length) approval.missingFields.push("必要附件");
    syncLegacyFromApprovals(project);
  }

  global.IPMApproval = {
    STATUS_LABEL,
    getDisplayStatus,
    getProjectApprovals,
    getVisibleApprovals,
    getActiveApprovals,
    canSeeApprovalRecord,
    matchesApprovalFilter,
    countPendingApprovals,
    hasActiveApproval,
    renderFlowChart,
    renderInlineProgress,
    statusBadgeHtml,
    approvalDetailBtnHtml,
    APPROVAL_DETAIL_BTN,
    confirmAction,
    showFlowModal,
    showFilePreview,
    findApproval,
    getEstablishApproval,
    advanceApproval,
    submitApproval,
    saveApprovalDraft,
    canActOnStep,
    syncLegacyFromApprovals,
  };
})(typeof window !== "undefined" ? window : globalThis);
