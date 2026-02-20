export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/order-list/index',
    'pages/favorites/index',
    'pages/mine/index',
    'pages/hotel-list/index',
    'pages/hotel-detail/index',
    'pages/order-detail/index',
    'pages/order-create/index',
    'pages/review-create/index',
    'pages/announcements/index',
    'pages/announcement-detail/index',
    'pages/profile/index',
    'pages/change-password/index',
    'pages/login/index',
    'pages/register/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#2196f3',
    navigationBarTitleText: '易宿酒店',
    navigationBarTextStyle: 'white'
  },
  tabBar: {
    color: '#7A7E83',
    selectedColor: '#1890ff',
    borderStyle: 'black',
    backgroundColor: '#ffffff',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页',
        iconPath: 'assets/tab/home.png',
        selectedIconPath: 'assets/tab/home-active.png'
      },
      {
        pagePath: 'pages/order-list/index',
        text: '订单',
        iconPath: 'assets/tab/order.png',
        selectedIconPath: 'assets/tab/order-active.png'
      },
      {
        pagePath: 'pages/favorites/index',
        text: '收藏',
        iconPath: 'assets/tab/favorite.png',
        selectedIconPath: 'assets/tab/favorite-active.png'
      },
      {
        pagePath: 'pages/mine/index',
        text: '用户',
        iconPath: 'assets/tab/mine.png',
        selectedIconPath: 'assets/tab/mine-active.png'
      }
    ]
  },
  // 允许使用的位置接口
  permission: {
    'scope.userLocation': {
      desc: '你的位置信息将用于显示附近酒店'
    }
  }
})
