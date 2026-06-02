/** 内部项目管理原型 — 共享数据与权限 */
(function (global) {
  const BU_CODES = {
    云能力: "YN",
    智能校对: "ZJ",
    综合项目部: "ZH",
    智能检索: "ZN",
  };

  const BU_LEADS = {
    云能力: "李明",
    智能校对: "陈华",
    综合项目部: "周强",
    智能检索: "吴敏",
  };

  const ROLES = {
    superAdmin: {
      id: "superAdmin",
      label: "超级管理员（查看/编辑全部）",
      view: () => true,
      edit: () => true,
      approve: (p) => !!p?.pendingApproval || !!p?.pendingOwnerChange || !!p?.statusApproval,
      manageMembers: () => true,
      changeStatus: () => true,
    },
    executive: {
      id: "executive",
      label: "超级管理层（CEO / 轮值VP）",
      view: () => true,
      edit: () => false,
      approve: (p) => !!(p?.pendingApproval || p?.statusApproval),
      manageMembers: () => false,
      changeStatus: () => false,
    },
    productOwner: {
      id: "productOwner",
      label: "项目产品负责人（张三）",
      view: (p) => p?.productOwner === "张三",
      edit: (p) => p?.productOwner === "张三",
      approve: (p) =>
        (p?.pendingApproval && p?.productOwner === "张三") ||
        (p?.pendingOwnerChange && p?.productOwner === "张三"),
      manageMembers: (p) => p?.productOwner === "张三",
      changeStatus: (p) => p?.productOwner === "张三" && p?.status === "开发中",
    },
  };

  const STATUS_ORDER = { 开发中: 0, 上线: 1, 下线: 2 };

  const PEOPLE_POOL = [
    "张三", "李四", "王五", "赵六", "钱七", "孙八", "周九", "吴敏", "郑伟", "林十一",
    "秦二", "尤十九", "许二十", "张二四", "孔二五", "韩十五", "杨十六",
    "陈华", "周强", "刘协作", "陈支援", "赵外援", "华二八", "金二九",
  ];

  function genProjectId(p) {
    const code = BU_CODES[p.bu] || "XX";
    const ym = p.establish.replace("-", "");
    const seq = String(p.id).padStart(3, "0");
    return `${code}-${ym}-${seq}`;
  }

  function buildMembers(p) {
    const buMembers = PEOPLE_POOL.filter((n) => n !== p.productOwner && n !== p.techLead).slice(0, 3 + (p.id % 3));
    const crossBuMembers = p.id % 3 === 0
      ? [{ name: "刘协作", bu: "智能校对" }, { name: "陈支援", bu: "云能力" }]
      : p.id % 3 === 1
        ? [{ name: "赵外援", bu: "综合项目部" }]
        : [];
    return {
      buLead: p.buLead,
      productOwner: p.productOwner,
      techLead: p.techLead,
      buMembers,
      crossBuMembers,
    };
  }

  function buildTimeline(p) {
    const [y, m] = p.establish.split("-");
    const establishDate = `${y}-${m}-01`;
    return [
      { key: "establish", label: "立项", date: establishDate, done: true, desc: "预立项审批通过" },
      { key: "dev", label: "开发", date: p.status !== "开发中" || p.online !== "-" ? `${y}-${String(Number(m) + 1).padStart(2, "0")}-15` : "-", done: p.status !== "开发中" || p.online !== "-", desc: "进入开发阶段" },
      { key: "online", label: "上线", date: p.online, done: p.status === "上线" || p.status === "下线", desc: p.online !== "-" ? "正式上线" : "待上线" },
      { key: "offline", label: "下线", date: p.offline, done: p.status === "下线", desc: p.status === "下线" ? "已下线" : "—" },
    ];
  }

  function seedActivities(p) {
    const base = [
      {
        id: `${p.id}-a1`,
        type: "create",
        operator: p.buLead,
        time: `${p.establish.replace("-", "/")}/01 10:00`,
        summary: "项目立项创建",
        changes: [],
      },
      {
        id: `${p.id}-a2`,
        type: "sync",
        operator: "系统",
        time: `${p.establish.replace("-", "/")}/05 02:00`,
        summary: "主数据同步：事业部、负责人",
        changes: [
          { field: "负责事业部", old: "—", new: p.bu },
          { field: "事业部负责人", old: "—", new: p.buLead },
        ],
      },
    ];
    if (p.online !== "-") {
      base.push({
        id: `${p.id}-a3`,
        type: "status",
        operator: p.productOwner,
        time: p.online + " 09:30",
        summary: "状态变更：开发中 → 上线",
        changes: [{ field: "状态", old: "开发中", new: "上线" }, { field: "上线时间", old: "-", new: p.online }],
      });
    }
    if (p.pendingOwnerChange) {
      base.push({
        id: `${p.id}-a4`,
        type: "approval",
        operator: p.productOwner,
        time: "2025-05-28 14:20",
        summary: `负责人变更申请：${p.pendingOwnerChange.roleLabel}`,
        changes: [
          { field: p.pendingOwnerChange.roleLabel, old: p.pendingOwnerChange.from, new: p.pendingOwnerChange.to + "（待审批）" },
        ],
      });
    }
    if (p.statusApproval) {
      base.push({
        id: `${p.id}-a5`,
        type: "approval",
        operator: p.productOwner,
        time: p.statusApproval.applyTime,
        summary: `状态申请：${p.statusApproval.typeLabel}`,
        changes: [{ field: "目标状态", old: p.status, new: p.statusApproval.targetStatus }],
      });
    }
    return base;
  }

  const RAW = [
    { id: 1, bu: "云能力", buLead: "李明", name: "雾信通", establish: "2024-06", status: "上线", online: "2024-06-01", offline: "-", productOwner: "王五", techLead: "赵六", desc: "企业级雾计算通信平台", pendingInfo: false, pendingApproval: false },
    { id: 2, bu: "智能校对", buLead: "陈华", name: "综测通", establish: "2024-03", status: "开发中", online: "-", offline: "-", productOwner: "张三", techLead: "李四", desc: "综合测试与校对工具链", pendingInfo: true, pendingApproval: false },
    { id: 3, bu: "综合项目部", buLead: "周强", name: "统一门户", establish: "2023-11", status: "上线", online: "2024-01-15", offline: "-", productOwner: "钱七", techLead: "孙八", desc: "集团统一门户入口", pendingInfo: false, pendingApproval: true, approvalType: "delete" },
    { id: 4, bu: "智能检索", buLead: "吴敏", name: "智析平台", establish: "2024-08", status: "开发中", online: "-", offline: "-", productOwner: "张三", techLead: "周九", desc: "智能检索与分析中台", pendingInfo: false, pendingApproval: false, pendingOwnerChange: { role: "product", roleLabel: "项目产品负责人", from: "张三", to: "林十一" } },
    { id: 5, bu: "综合项目部", buLead: "郑伟", name: "旧版工单", establish: "2022-05", status: "下线", online: "2022-08-01", offline: "2025-03-01", productOwner: "冯十", techLead: "褚十一", desc: "历史工单系统（已迁移）", pendingInfo: false, pendingApproval: false },
    { id: 6, bu: "云能力", buLead: "李明", name: "云监控", establish: "2025-01", status: "开发中", online: "-", offline: "-", productOwner: "王五", techLead: "卫十二", desc: "云资源监控告警", pendingInfo: false, pendingApproval: false },
    { id: 7, bu: "智能校对", buLead: "陈华", name: "语料库", establish: "2023-07", status: "下线", online: "2023-09-01", offline: "2024-12-01", productOwner: "蒋十三", techLead: "沈十四", desc: "语料管理与标注", pendingInfo: false, pendingApproval: false },
    { id: 8, bu: "综合项目部", buLead: "周强", name: "审批中心", establish: "2024-11", status: "上线", online: "2025-02-01", offline: "-", productOwner: "韩十五", techLead: "杨十六", desc: "统一审批流引擎", pendingInfo: true, pendingApproval: true, approvalType: "ownerChange", pendingOwnerChange: { role: "tech", roleLabel: "项目技术负责人", from: "杨十六", to: "秦二" } },
    { id: 9, bu: "智能检索", buLead: "吴敏", name: "标签引擎", establish: "2024-04", status: "上线", online: "2024-07-20", offline: "-", productOwner: "朱十七", techLead: "秦十八", desc: "标签体系与画像", pendingInfo: false, pendingApproval: false },
    { id: 10, bu: "智能检索", buLead: "郑伟", name: "API网关", establish: "2024-09", status: "开发中", online: "-", offline: "-", productOwner: "尤十九", techLead: "许二十", desc: "内部 API 统一网关", pendingInfo: false, pendingApproval: false, statusApproval: { type: "online", typeLabel: "上线申请", targetStatus: "上线", applyTime: "2025-05-30 11:00", reason: "完成联调，申请上线" } },
    { id: 11, bu: "云能力", buLead: "李明", name: "资源编排", establish: "2023-02", status: "下线", online: "2023-05-01", offline: "2024-08-01", productOwner: "何二一", techLead: "吕二二", desc: "资源编排（已下线）", pendingInfo: false, pendingApproval: true, approvalType: "delete" },
    { id: 12, bu: "智能校对", buLead: "陈华", name: "OCR增强", establish: "2025-03", status: "开发中", online: "-", offline: "-", productOwner: "张三", techLead: "施二三", desc: "OCR 识别增强模块", pendingInfo: false, pendingApproval: false },
    { id: 13, bu: "综合项目部", buLead: "周强", name: "消息总线", establish: "2024-02", status: "上线", online: "2024-05-10", offline: "-", productOwner: "张二四", techLead: "孔二五", desc: "消息中间件总线", pendingInfo: false, pendingApproval: false },
    { id: 14, bu: "智能检索", buLead: "吴敏", name: "报表中心", establish: "2022-11", status: "下线", online: "2023-01-01", offline: "2025-01-01", productOwner: "曹二六", techLead: "严二七", desc: "报表中心（已下线）", pendingInfo: false, pendingApproval: false },
    { id: 15, bu: "综合项目部", buLead: "郑伟", name: "配置中心", establish: "2024-10", status: "上线", online: "2025-01-08", offline: "-", productOwner: "华二八", techLead: "金二九", desc: "配置管理中心", pendingInfo: false, pendingApproval: false },
    {
      id: 16,
      applyStatus: "draft",
      bu: "云能力",
      buLead: "李明",
      name: "边缘计算试点",
      establish: "2025-06",
      status: "开发中",
      online: "-",
      offline: "-",
      productOwner: "张三",
      techLead: "王五",
      desc: "",
      applyReason: "边缘节点资源调度与离线自治能力验证",
      scopeType: "内部",
      preProjectId: "",
      initiateDate: "2025-06",
      applyFiles: { application: "", approval: "", supplement: "" },
      pendingInfo: true,
      pendingApproval: false,
      createdAt: "2025-05-31 10:00",
    },
    {
      id: 17,
      applyStatus: "reviewing",
      bu: "智能检索",
      buLead: "吴敏",
      name: "知识库二期",
      establish: "2025-05",
      status: "开发中",
      online: "-",
      offline: "-",
      productOwner: "尤十九",
      techLead: "许二十",
      desc: "企业知识库二期建设",
      applyReason: "统一检索与知识运营二期建设",
      scopeType: "内部",
      initiateDate: "2025-05",
      applyFiles: { application: "知识库二期立项申请.pdf", approval: "事业部立项纪要.pdf", supplement: "" },
      pendingInfo: false,
      pendingApproval: false,
      createdAt: "2025-05-28 09:30",
    },
  ];

  function defaultSteps(p, startAt = 0) {
    const steps = [
      { key: "buLead", label: "事业部负责人", assignee: p.buLead, status: "waiting" },
      { key: "executive", label: "超级管理层", assignee: "轮值VP", status: "waiting" },
    ];
    steps.forEach((s, i) => {
      if (i < startAt) s.status = "done";
      else if (i === startAt) s.status = "active";
      else s.status = "waiting";
    });
    return steps;
  }

  function computeEstablishMissing(p) {
    const m = [];
    if (!p.applyReason?.trim()) m.push("申请原因");
    if (!p.name?.trim()) m.push("项目名称");
    if (!p.bu) m.push("负责事业部");
    if (!p.desc?.trim()) m.push("项目简介");
    if (!p.productOwner) m.push("项目产品负责人");
    if (!p.techLead) m.push("项目技术负责人");
    if (p.scopeType === "外部" && !p.preProjectId?.trim()) m.push("关联预立项 ID");
    const files = p.applyFiles || {};
    if (!files.application) m.push("立项申请书");
    if (!files.approval) m.push("立项审批单");
    return m;
  }

  function buildEstablishApproval(p) {
    const phase = p.applyStatus === "draft" ? "draft" : p.applyStatus === "reviewing" ? "reviewing" : p.applyStatus === "rejected" ? "rejected" : "approved";
    const submitted = phase !== "draft";
    const steps = defaultSteps(p, submitted ? 0 : -1).map((s) => ({ ...s, status: submitted && s.status === "active" ? "active" : "waiting" }));
    if (phase === "approved") steps.forEach((s) => { if (s.status !== "rejected") s.status = "done"; });
    const fileList = [];
    const files = p.applyFiles || {};
    if (files.application) fileList.push({ name: files.application, size: "—" });
    if (files.approval) fileList.push({ name: files.approval, size: "—" });
    if (files.supplement) fileList.push({ name: files.supplement, size: "—" });
    return {
      id: `ap-${p.id}-establish`,
      type: "establish",
      typeLabel: "立项申请",
      submitted,
      phase,
      submitter: p.productOwner,
      createdAt: p.createdAt || "2025-05-01 09:00",
      submittedAt: submitted ? p.createdAt || new Date().toLocaleString("zh-CN", { hour12: false }) : null,
      missingFields: computeEstablishMissing(p),
      formData: { reason: p.applyReason || p.desc || "" },
      requireFiles: false,
      attachments: fileList.length ? fileList : p.desc ? [{ name: "立项说明.docx", size: "256KB" }] : [],
      steps,
      currentStepIndex: phase === "reviewing" ? 0 : 0,
      payload: { bu: p.bu, name: p.name, establish: p.establish },
    };
  }

  function buildApprovals(p) {
    const list = [];

    if (p.applyStatus) {
      list.push(buildEstablishApproval(p));
      return list;
    }

    if (p.id === 2) {
      list.push({
        id: `ap-${p.id}-online-draft`,
        type: "status",
        typeLabel: "上线申请",
        submitted: false,
        phase: "draft",
        submitter: p.productOwner,
        createdAt: "2025-05-29 16:00",
        submittedAt: null,
        missingFields: ["申请说明", "上线验收附件"],
        formData: { reason: "" },
        requireFiles: true,
        attachments: [],
        steps: defaultSteps(p, -1).map((s) => ({ ...s, status: "waiting" })),
        currentStepIndex: 0,
        payload: { type: "online", targetStatus: "上线" },
      });
    }

    if (p.pendingOwnerChange) {
      const oc = p.pendingOwnerChange;
      list.push({
        id: `ap-${p.id}-owner`,
        type: "ownerChange",
        typeLabel: `${oc.roleLabel}变更`,
        submitted: true,
        phase: "reviewing",
        submitter: p.productOwner,
        submittedAt: "2025-05-28 14:20",
        missingFields: [],
        requireFiles: false,
        attachments: [{ name: "负责人变更说明.docx", size: "128KB" }],
        steps: defaultSteps(p, 0),
        currentStepIndex: 0,
        payload: { ...oc, roleLabel: oc.roleLabel },
      });
    }

    if (p.statusApproval) {
      const sa = p.statusApproval;
      const steps = defaultSteps(p, 1);
      steps[0].status = "done";
      steps[0].actedAt = "2025-05-30 14:00";
      steps[1].status = "active";
      list.push({
        id: `ap-${p.id}-status`,
        type: "status",
        typeLabel: sa.typeLabel,
        submitted: true,
        phase: "reviewing",
        submitter: p.productOwner,
        submittedAt: sa.applyTime,
        missingFields: [],
        requireFiles: true,
        attachments: [
          { name: "联调测试报告.pdf", size: "2.1MB" },
          { name: "上线检查清单.xlsx", size: "890KB" },
        ],
        formData: { reason: sa.reason },
        steps,
        currentStepIndex: 1,
        payload: { type: sa.type, targetStatus: sa.targetStatus },
      });
    }

    if (p.pendingApproval && p.approvalType === "delete") {
      list.push({
        id: `ap-${p.id}-delete`,
        type: "delete",
        typeLabel: "删除申请",
        submitted: true,
        phase: "reviewing",
        submitter: p.productOwner,
        submittedAt: "2025-05-25 09:00",
        requireFiles: true,
        attachments: [{ name: "项目下线/delete说明.pdf", size: "640KB" }],
        formData: { reason: "业务迁移完成，申请删除项目档案" },
        steps: defaultSteps(p, 0),
        currentStepIndex: 0,
        payload: {},
      });
    }

    if (p.id === 7) {
      const steps = defaultSteps(p);
      steps[0].status = "done";
      steps[0].actedAt = "2024-11-01 10:00";
      steps[1].status = "done";
      steps[1].actedAt = "2024-11-05 15:00";
      list.push({
        id: `ap-${p.id}-offline-done`,
        type: "status",
        typeLabel: "下线申请",
        submitted: true,
        phase: "approved",
        submitter: p.productOwner,
        submittedAt: "2024-10-28 09:00",
        finishedAt: "2024-11-05 15:00",
        formData: { reason: "业务收缩，语料库正式下线" },
        attachments: [{ name: "下线批复.pdf", size: "480KB" }],
        steps,
        currentStepIndex: 1,
        payload: { type: "offline", targetStatus: "下线" },
      });
    }

    if (p.id === 12 && p.productOwner === "张三") {
      const steps = defaultSteps(p);
      steps[0].status = "done";
      steps[0].actedAt = "2025-04-10 11:00";
      steps[1].status = "rejected";
      steps[1].actedAt = "2025-04-12 16:30";
      list.push({
        id: `ap-${p.id}-online-rejected`,
        type: "status",
        typeLabel: "上线申请",
        submitted: true,
        phase: "rejected",
        submitter: p.productOwner,
        submittedAt: "2025-04-08 14:00",
        finishedAt: "2025-04-12 16:30",
        formData: { reason: "验收材料不完整，暂缓上线" },
        attachments: [{ name: "验收材料.zip", size: "3.2MB" }],
        steps,
        currentStepIndex: 1,
        payload: { type: "online", targetStatus: "上线" },
      });
    }

    if (p.pendingApproval && p.approvalType === "ownerChange" && !p.pendingOwnerChange) {
      list.push({
        id: `ap-${p.id}-owner-legacy`,
        type: "ownerChange",
        typeLabel: "负责人变更",
        submitted: true,
        phase: "reviewing",
        submitter: p.productOwner,
        submittedAt: "2025-05-27 11:00",
        attachments: [],
        steps: defaultSteps(p, 0),
        currentStepIndex: 0,
        payload: { roleLabel: "负责人变更" },
      });
    }

    return list;
  }

  const PROJECTS = RAW.map((p) => {
    const project = { ...p };
    project.projectId = genProjectId(project);
    project.members = buildMembers(project);
    project.timeline = buildTimeline(project);
    project.activities = seedActivities(project);
    project.attachments = project.status === "上线"
      ? [{ name: "上线验收报告.pdf", size: "1.2MB" }, { name: "发布说明.docx", size: "340KB" }]
      : project.pendingInfo
        ? []
        : [{ name: "立项批复.pdf", size: "520KB" }];
    project.approvals = buildApprovals(project);
    return project;
  });

  function getRoleId() {
    return localStorage.getItem("ipm_role") || "superAdmin";
  }

  function setRoleId(id) {
    localStorage.setItem("ipm_role", id);
  }

  function getRole() {
    return ROLES[getRoleId()] || ROLES.superAdmin;
  }

  function getProject(id) {
    return PROJECTS.find((p) => p.id === Number(id));
  }

  function statusClass(s) {
    if (s === "上线") return "status-online";
    if (s === "开发中") return "status-dev";
    return "status-offline";
  }

  function addActivity(project, activity) {
    project.activities.unshift({
      id: `${project.id}-${Date.now()}`,
      ...activity,
    });
  }

  function sortProjects(list) {
    return [...list].sort((a, b) => {
      const sa = STATUS_ORDER[a.status] ?? 9;
      const sb = STATUS_ORDER[b.status] ?? 9;
      if (sa !== sb) return sa - sb;
      const oa = a.online === "-" ? "9999" : a.online;
      const ob = b.online === "-" ? "9999" : b.online;
      if (oa !== ob) return oa.localeCompare(ob);
      return a.bu.localeCompare(b.bu, "zh-CN");
    });
  }

  function isApplyProject(p) {
    return !!p?.applyStatus;
  }

  function sortApplyProjects(list) {
    return [...list].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }

  function finishEstablishApproval(project) {
    delete project.applyStatus;
    project.projectId = genProjectId(project);
    project.pendingInfo = !project.desc?.trim();
    if (project.timeline?.[0]) {
      project.timeline[0].done = true;
      project.timeline[0].desc = "立项审批通过";
    }
  }

  global.IPM = {
    BU_CODES,
    BU_LEADS,
    ROLES,
    STATUS_ORDER,
    PEOPLE_POOL,
    PROJECTS,
    genProjectId,
    getRoleId,
    setRoleId,
    getRole,
    getProject,
    statusClass,
    addActivity,
    sortProjects,
    isApplyProject,
    sortApplyProjects,
    finishEstablishApproval,
    buildEstablishApproval,
  };
})(typeof window !== "undefined" ? window : globalThis);
