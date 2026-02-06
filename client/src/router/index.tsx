import { createBrowserRouter, Navigate } from 'react-router-dom';
import AuthLayout from '@/layouts/AuthLayout/index';
import MainLayout from '@/layouts/MainLayout/index';
import Login from '@/pages/Login/index';
import Register from '@/pages/Register/index';
import MerchantDashboard from '@/pages/merchant/Dashboard/index';
import MerchantHotels from '@/pages/merchant/HotelList/index';
import MerchantHotelEdit from '@/pages/merchant/HotelEdit/index';
import MerchantHotelDetail from '@/pages/merchant/HotelDetail/index';
import MerchantRooms from '@/pages/merchant/RoomList/index';
import MerchantOrders from '@/pages/merchant/OrderList/index';
import AdminHotels from '@/pages/admin/HotelList/index';
import AdminBanners from '@/pages/admin/BannerList/index';
import AdminUserList from '@/pages/admin/UserList/index';
import AdminAnnouncementList from '@/pages/admin/AnnouncementList/index';
import Profile from '@/pages/common/Profile/index';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/',
    element: <AuthLayout />,
    children: [
      {
        path: 'login',
        element: <Login />,
      },
      {
        path: 'register',
        element: <Register />,
      },
    ],
  },
  {
    path: '/',
    element: <MainLayout />,
    children: [
      // 通用页面
      {
        path: 'profile',
        element: <Profile />,
      },
      // 商户页面
      {
        path: 'merchant/dashboard',
        element: <MerchantDashboard />,
      },
      {
        path: 'merchant/hotels',
        element: <MerchantHotels />,
      },
      {
        path: 'merchant/hotels/new',
        element: <MerchantHotelEdit />,
      },
      {
        path: 'merchant/hotels/:id/edit',
        element: <MerchantHotelEdit />,
      },
      {
        path: 'merchant/hotels/:hotelId/detail',
        element: <MerchantHotelDetail />,
      },
      {
        path: 'merchant/hotels/:hotelId/rooms',
        element: <MerchantRooms />,
      },
      {
        path: 'merchant/orders',
        element: <MerchantOrders />,
      },
      // 管理员页面
      {
        path: 'admin/hotels',
        element: <AdminHotels />,
      },
      {
        path: 'admin/banners',
        element: <AdminBanners />,
      },
      {
        path: 'admin/users',
        element: <AdminUserList />,
      },
      {
        path: 'admin/announcements',
        element: <AdminAnnouncementList />,
      },
    ],
  },
]);

export default router;
