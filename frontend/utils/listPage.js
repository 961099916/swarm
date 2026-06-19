/**
 * 列表页面通用行为 — 搜索/筛选 + 下拉刷新 + 上拉加载
 *
 * 用法：
 *   const listPage = require("../../utils/listPage");
 *   Page({
 *     ...listPage.create({
 *       pageSize: 10,
 *       fetchData({ page, pageSize, searchQuery, filterValue }) {
 *         return request({ url: "/api/v1/xxx/list", data: { page, pageSize, search: searchQuery } });
 *       },
 *       parseList(res) { return res.data?.list || []; },
 *       parseTotal(res) { return res.data?.total || 0; },
 *     }),
 *     // 页面自定义 data / 方法
 *   });
 */
'use strict';

/** 默认分页大小 */
const DEFAULT_PAGE_SIZE = 10;

/**
 * 创建一个列表页面配置（包含 data + 生命周期 + 事件方法）
 * @param {object} options
 * @param {number} [options.pageSize=10] - 每页条数
 * @param {(params:{page:number,pageSize:number,searchQuery:string,filterValue:string}) => Promise} options.fetchData - 数据请求函数
 * @param {(res:any) => Array} options.parseList - 从响应中提取列表数据
 * @param {(res:any) => number} [options.parseTotal] - 从响应中提取总数（可选）
 * @param {(res:any) => boolean} [options.onDataError] - 数据加载失败时的处理
 * @param {string} [options.listKey='list'] - data 中的列表字段名
 * @param {Array<{label:string,value:string}>} [options.filterOptions] - 筛选选项
 * @returns {{data:object, onLoad:Function, onShow:Function, onRefresh:Function, onLoadMore:Function, onSearchInput:Function, onFilterChange:Function, onPullDownRefresh:Function, onReachBottom:Function}}
 */
function create(options) {
  const {
    pageSize = DEFAULT_PAGE_SIZE,
    fetchData,
    parseList,
    parseTotal,
    listKey = 'list',
    filterOptions = [],
  } = options || {};

  if (!fetchData || !parseList) {
    throw new Error('[listPage] fetchData 和 parseList 是必填参数');
  }

  return {
    data: {
      /** 列表数据 */
      [listKey]: [],
      /** 当前页码（从 1 开始） */
      page: 1,
      /** 每页条数 */
      pageSize,
      /** 总记录数 */
      total: 0,
      /** 是否正在加载（首次/翻页） */
      loading: false,
      /** 是否正在刷新 */
      refreshing: false,
      /** 是否有更多数据 */
      hasMore: true,
      /** 搜索关键词 */
      searchQuery: '',
      /** 当前筛选值 */
      filterValue: 'ALL',
      /** 筛选选项 */
      filterOptions,
      /** 空状态提示 */
      emptyText: '暂无数据',
      /** 错误信息 */
      errorMsg: '',
    },

    /**
     * 加载第一页（通常 onShow/onLoad 调用）
     */
    loadFirstPage() {
      this.data.page = 1;
      this.data.hasMore = true;
      this.setData({ loading: true, errorMsg: '' });
      this._fetchPage(1, true);
    },

    /**
     * 加载更多（上拉触底）
     */
    loadNextPage() {
      if (this.data.loading || !this.data.hasMore) return;
      const nextPage = this.data.page + 1;
      this.setData({ loading: true });
      this._fetchPage(nextPage, false);
    },

    /**
     * 下拉刷新
     */
    onRefresh() {
      this.data.page = 1;
      this.data.hasMore = true;
      this.setData({ refreshing: true, errorMsg: '' });
      this._fetchPage(1, true);
    },

    /**
     * 上拉触底加载更多（页面级 onReachBottom 转发）
     */
    onReachBottom() {
      this.loadNextPage();
    },

    /**
     * 搜索输入
     */
    onSearchInput(e) {
      const value = (e.detail?.value || '').trim();
      this.setData({ searchQuery: value, page: 1, hasMore: true });
      this._fetchPage(1, true);
    },

    /**
     * 搜索提交（键盘回车）
     */
    onSearchSubmit(e) {
      const value = (e.detail?.value || '').trim();
      if (value !== this.data.searchQuery) {
        this.setData({ searchQuery: value, page: 1, hasMore: true });
        this._fetchPage(1, true);
      }
    },

    /**
     * 筛选切换
     */
    onFilterChange(e) {
      const value = e.currentTarget?.dataset?.value || e.detail?.value || 'ALL';
      if (value === this.data.filterValue) return;
      this.setData({ filterValue: value, page: 1, hasMore: true, searchQuery: '' });
      this._fetchPage(1, true);
    },

    /** ─── 内部方法 ─── */

    _fetchPage(page, isRefresh) {
      const params = {
        page,
        pageSize: this.data.pageSize,
        searchQuery: this.data.searchQuery,
        filterValue: this.data.filterValue,
      };

      const promise = fetchData.call(this, params);

      if (!promise || typeof promise.then !== 'function') {
        console.warn('[listPage] fetchData 应返回 Promise');
        this._finishLoading(isRefresh);
        return;
      }

      promise
        .then((res) => {
          if (!res || !res.success) {
            this.setData({ errorMsg: (res && res.error) || '加载失败', loading: false, refreshing: false });
            return;
          }

          const items = parseList(res) || [];
          const total = parseTotal ? parseTotal(res) : 0;

          const key = listKey;
          if (isRefresh || page === 1) {
            this.setData({ [key]: items, total, page: 1, hasMore: items.length >= pageSize, errorMsg: '' });
          } else {
            const existing = this.data[key] || [];
            this.setData({
              [key]: [...existing, ...items],
              total,
              page,
              hasMore: items.length >= pageSize,
              errorMsg: '',
            });
          }
        })
        .catch((err) => {
          console.error('[listPage] 数据加载失败:', err);
          this.setData({ errorMsg: err.message || '网络异常，请稍后重试' });
        })
        .finally(() => {
          this._finishLoading(isRefresh);
        });
    },

    _finishLoading(isRefresh) {
      if (isRefresh) {
        this.setData({ refreshing: false, loading: false });
        // 停止微信下拉刷新动画
        if (typeof wx.stopPullDownRefresh === 'function') {
          wx.stopPullDownRefresh();
        }
      } else {
        this.setData({ loading: false });
      }
    },
  };
}

module.exports = { create, DEFAULT_PAGE_SIZE };
