import { createBrowserRouter, Navigate } from 'react-router-dom';
import AuthLayout from '@/layouts/AuthLayout/index';
import MainLayout from '@/layouts/MainLayout/index';
import Login from '@/pages/Login/index';
import Register from '@/pages/Register/index';
import MerchantHotels from '@/pages/merchant/HotelList/index';
import MerchantHotelEdit from '@/pages/merchant/HotelEdit/index';
import MerchantHotelDetail from '@/pages/merchant/HotelDetail/index';
import MerchantRooms from '@/pages/merchant/RoomList/index';
import MerchantOrders from '@/pages/merchant/OrderList/index';
import AdminHotels from '@/pages/admin/HotelList/index';
import AdminBanners from '@/pages/admin/BannerList/index';

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
      // 商户页面
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
    ],
  },
]);

export default router;
