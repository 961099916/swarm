// packageAdmin/tools/edit.js
const { request } = require("../../utils/request.js");

Page({
  data: {
    theme: "dark",
    isEditMode: false,
    name: "",
    description: "",
    category: "general",
    runMode: "script", // script 或 api
    method: "GET",
    endpoint: "",
    headersStr: "{}",
    bodyTemplate: "",
    responseSelector: "",
    script: `async function run(input, context) {\n  // 在此编写您的动态 JS 逻辑，可使用 fetch\n  // context.env 可提供 WEATHER_API_KEY 等授权凭证\n  return "执行成功！输入为: " + JSON.stringify(input);\n}`,
    paramsSchema: [],

    // 调试器状态
    debugInputStr: "{\n  \"city\": \"北京\"\n}",
    debugging: false,
    debugResult: "",
    debugError: "",
    debugDuration: 0,

    // 弹窗状态
    showAddParamPopup: false,
    newParamKey: "",
    newParamType: "string",
    newParamRequired: false,
    newParamDesc: ""
  },

  onLoad: function (options) {
    const app = getApp();
    if (app && app.globalData) {
      this.setData({
        theme: app.globalData.theme === 'light' ? 'theme-light' : ''
      });
      app.applyTheme(app.globalData.theme);
    }

    if (options && options.name) {
      this.setData({
        isEditMode: true,
        name: options.name
      });
      wx.setNavigationBarTitle({ title: "编辑工具" });
      this.loadToolDetails(options.name);
    } else {
      wx.setNavigationBarTitle({ title: "新增工具" });
    }
  },

  loadToolDetails: function (name) {
    wx.showLoading({ title: "加载配置中..." });
    request({ url: "/api/v1/admin/tools" })
      .then((res) => {
        wx.hideLoading();
        if (res.success && res.data) {
          const matched = res.data.find(t => t.name === name);
          if (matched) {
            this.setData({
              description: matched.description || "",
              category: matched.category || "general",
              runMode: matched.script ? "script" : "api",
              method: matched.method || "GET",
              endpoint: matched.endpoint || "",
              headersStr: matched.headers ? JSON.stringify(matched.headers, null, 2) : "{}",
              bodyTemplate: matched.bodyTemplate || "",
              responseSelector: matched.responseSelector || "",
              script: matched.script || this.data.script,
              paramsSchema: matched.paramsSchema || []
            });
          }
        }
      })
      .catch((err) => {
        wx.hideLoading();
        console.error("拉取工具详情出错:", err);
        wx.showToast({ title: "同步线上配置失败", icon: "none" });
      });
  },

  switchRunMode: function (e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ runMode: mode });
  },

  setMethod: function (e) {
    const val = e.currentTarget.dataset.val;
    this.setData({ method: val });
  },

  onNameInput: function (e) { this.setData({ name: e.detail.value }); },
  onDescriptionInput: function (e) { this.setData({ description: e.detail.value }); },
  onCategoryInput: function (e) { this.setData({ category: e.detail.value }); },
  onEndpointInput: function (e) { this.setData({ endpoint: e.detail.value }); },
  onHeadersInput: function (e) { this.setData({ headersStr: e.detail.value }); },
  onBodyTemplateInput: function (e) { this.setData({ bodyTemplate: e.detail.value }); },
  onSelectorInput: function (e) { this.setData({ responseSelector: e.detail.value }); },
  onScriptInput: function (e) { this.setData({ script: e.detail.value }); },
  onDebugInputVal: function (e) { this.setData({ debugInputStr: e.detail.value }); },

  // ─── 调试沙箱执行 ───
  onTriggerDebug: function () {
    const { runMode, script, endpoint, method, headersStr, bodyTemplate, responseSelector, debugInputStr } = this.data;
    
    let debugScript = script;
    if (runMode === "api") {
      // 若是 API 模式，由前端将 API 请求转换成轻量 JS 代码发给 debug 接口进行真机执行模拟
      debugScript = `async function run(input, context) {
        let url = "${endpoint.replace(/"/g, '\\"')}";
        const method = "${method}";
        const headers = ${headersStr || '{}'};
        let body = ${bodyTemplate ? `\`${bodyTemplate}\`` : 'null'};

        for (const key of Object.keys(input)) {
          const val = String(input[key]);
          url = url.replace(new RegExp("{{" + key + "}}", "g"), val);
        }
        if (body && method !== "GET") {
          for (const key of Object.keys(input)) {
            body = body.replace(new RegExp("{{" + key + "}}", "g"), String(input[key]));
          }
        }

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json", ...headers },
          body: method !== "GET" ? body : undefined
        });
        if (!res.ok) {
          throw new Error("接口报错 HTTP " + res.status + ": " + await res.text());
        }
        const text = await res.text();
        let json;
        try { json = JSON.parse(text); } catch(e) { return text; }
        
        const selector = "${responseSelector || ''}";
        if (selector.trim()) {
          const keys = selector.split(".");
          let val = json;
          for (const k of keys) {
            if (val && val[k] !== undefined) val = val[k];
            else { val = null; break; }
          }
          return typeof val === "string" ? val : JSON.stringify(val);
        }
        return JSON.stringify(json);
      }`;
    }

    let parsedInput = {};
    try {
      parsedInput = JSON.parse(debugInputStr);
    } catch (e) {
      wx.showToast({ title: "测试输入参数必须是合法 JSON", icon: "none" });
      return;
    }

    this.setData({
      debugging: true,
      debugResult: "",
      debugError: ""
    });

    request({
      url: "/api/v1/admin/tools/debug",
      method: "POST",
      data: {
        script: debugScript,
        input: parsedInput
      }
    })
      .then((res) => {
        if (res.success && res.data) {
          const { result, durationMs, error } = res.data;
          if (error) {
            this.setData({ debugError: error });
          } else {
            this.setData({
              debugResult: result,
              debugDuration: durationMs
            });
          }
        } else {
          this.setData({ debugError: res.error || "沙箱未知错误，执行失败" });
        }
      })
      .catch((err) => {
        this.setData({ debugError: err.message || "请求调试接口失败，请检查网络" });
      })
      .finally(() => {
        this.setData({ debugging: false });
      });
  },

  // ─── 参数 Schema 列表操作 ───
  onOpenAddParam: function () {
    this.setData({
      showAddParamPopup: true,
      newParamKey: "",
      newParamType: "string",
      newParamRequired: false,
      newParamDesc: ""
    });
  },

  onCloseAddParam: function () {
    this.setData({ showAddParamPopup: false });
  },

  onPopupVisibleChange: function (e) {
    if (!e.detail.visible) {
      this.setData({ showAddParamPopup: false });
    }
  },

  onNewParamKey: function (e) { this.setData({ newParamKey: e.detail.value }); },
  onNewParamDesc: function (e) { this.setData({ newParamDesc: e.detail.value }); },
  setNewParamType: function (e) {
    this.setData({ newParamType: e.currentTarget.dataset.type });
  },
  onNewParamRequiredChange: function (e) {
    this.setData({ newParamRequired: e.detail.checked });
  },

  onAddParamConfirm: function () {
    const { newParamKey, newParamType, newParamRequired, newParamDesc, paramsSchema } = this.data;
    if (!newParamKey?.trim()) {
      wx.showToast({ title: "参数名不能为空", icon: "none" });
      return;
    }
    const key = newParamKey.trim();
    if (paramsSchema.some(p => p.name === key)) {
      wx.showToast({ title: "参数名已存在", icon: "none" });
      return;
    }

    const newParam = {
      name: key,
      type: newParamType,
      required: newParamRequired,
      description: newParamDesc.trim() || "无描述"
    };

    this.setData({
      paramsSchema: [...paramsSchema, newParam],
      showAddParamPopup: false
    });
  },

  onRemoveParam: function (e) {
    const idx = e.currentTarget.dataset.index;
    const { paramsSchema } = this.data;
    paramsSchema.splice(idx, 1);
    this.setData({ paramsSchema });
  },

  // ─── 取消与保存 ───
  onCancel: function () {
    wx.navigateBack();
  },

  onSave: function () {
    const { isEditMode, name, description, category, runMode, method, endpoint, headersStr, bodyTemplate, responseSelector, script, paramsSchema } = this.data;

    if (!name?.trim()) {
      wx.showToast({ title: "工具标识 name 不能为空", icon: "none" });
      return;
    }

    let headers = {};
    if (runMode === "api" && headersStr) {
      try {
        headers = JSON.parse(headersStr);
      } catch (e) {
        wx.showToast({ title: "额外 Headers 必须为合法 JSON 字符串", icon: "none" });
        return;
      }
    }

    const payload = {
      name: name.trim(),
      description: description.trim() || "自定义工具",
      category: category.trim() || "general",
      paramsSchema: paramsSchema,
      script: runMode === "script" ? script.trim() : null,
      endpoint: runMode === "api" ? endpoint.trim() : null,
      method: runMode === "api" ? method : "GET",
      headers,
      bodyTemplate: runMode === "api" ? bodyTemplate.trim() : null,
      responseSelector: runMode === "api" ? responseSelector.trim() : null
    };

    this.setData({ saving: true });

    const url = isEditMode ? "/api/v1/admin/tools/update" : "/api/v1/admin/tools/create";
    const reqMethod = isEditMode ? "PUT" : "POST";

    request({
      url,
      method: reqMethod,
      data: payload
    })
      .then((res) => {
        this.setData({ saving: false });
        if (res.success) {
          wx.showToast({ title: "配置已保存上线", icon: "success" });
          setTimeout(() => {
            wx.navigateBack();
          }, 1000);
        } else {
          wx.showToast({ title: res.error || "配置保存失败", icon: "none" });
        }
      })
      .catch((err) => {
        this.setData({ saving: false });
        console.error("保存工具失败:", err);
        wx.showToast({ title: "网络异常，保存失败", icon: "none" });
      });
  }
});
