/**
 * list-page 组件 — 列表页通用骨架
 * 提供筛选栏 + 搜索框 + 下拉刷新/上拉加载 + 骨架屏/空状态/错误状态
 *
 * 用法：
 *   <list-page
 *     list="{{tasks}}" loading="{{loading}}" refreshing="{{refreshing}}"
 *     hasMore="{{hasMore}}" total="{{total}}" errorMsg="{{errorMsg}}"
 *     filterOptions="{{filterOptions}}" filterValue="{{filterValue}}"
 *     searchQuery="{{searchQuery}}"
 *     bind:refresh="onRefresh" bind:loadmore="loadNextPage"
 *     bind:search="onSearchInput" bind:filterchange="onFilterChange"
 *   >
 *     <view wx:for="{{tasks}}" wx:key="id" class="card">...</view>
 *   </list-page>
 */
Component({
  properties: {
    /** 列表数据（用于判断是否空列表） */
    list: { type: Array, value: [] },
    /** 是否正在加载 */
    loading: { type: Boolean, value: false },
    /** 是否正在下拉刷新 */
    refreshing: { type: Boolean, value: false },
    /** 是否有更多数据 */
    hasMore: { type: Boolean, value: true },
    /** 总记录数 */
    total: { type: Number, value: 0 },
    /** 错误信息 */
    errorMsg: { type: String, value: '' },
    /** 空状态提示文本 */
    emptyText: { type: String, value: '暂无数据' },
    /** 空状态补充描述 */
    emptyDesc: { type: String, value: '' },
    /** 是否显示搜索框 */
    showSearch: { type: Boolean, value: true },
    /** 搜索框占位符 */
    searchPlaceholder: { type: String, value: '搜索...' },
    /** 搜索关键词 */
    searchQuery: { type: String, value: '' },
    /** 筛选选项 [{label, value}] */
    filterOptions: { type: Array, value: [] },
    /** 当前筛选值 */
    filterValue: { type: String, value: 'ALL' },
  },

  methods: {
    /** 下拉刷新 */
    onRefresh() {
      this.triggerEvent('refresh');
    },

    /** 上拉加载更多 */
    onLoadMore() {
      if (this.properties.loading || !this.properties.hasMore) return;
      this.triggerEvent('loadmore');
    },

    /** 搜索输入 */
    onSearchInput(e) {
      this.triggerEvent('search', { value: e.detail?.value || '' });
    },

    /** 搜索提交 */
    onSearchSubmit(e) {
      this.triggerEvent('searchsubmit', { value: e.detail?.value || '' });
    },

    /** 清除搜索 */
    onSearchClear() {
      this.triggerEvent('search', { value: '' });
    },

    /** 筛选切换 */
    onFilterChange(e) {
      const value = e.currentTarget?.dataset?.value || 'ALL';
      this.triggerEvent('filterchange', { value });
    },

    /** 重新加载（点击错误重试按钮） */
    onRetry() {
      this.triggerEvent('refresh');
    },
  },
});
