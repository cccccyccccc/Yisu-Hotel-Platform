export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/hotel-list/index',
    'pages/hotel-detail/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#2196f3',
    navigationBarTitleText: '易宿酒店',
    navigationBarTextStyle: 'white'
  },
  // 允许使用的位置接口
  permission: {
    'scope.userLocation': {
      desc: '你的位置信息将用于显示附近酒店'
    }
  }
})
